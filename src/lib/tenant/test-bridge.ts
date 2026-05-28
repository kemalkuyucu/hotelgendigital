import { getHotelClient } from './get-hotel-client'
import { getDecryptedBridge } from './decrypt-credentials'
import { getCentralSupabase } from '@/lib/supabase-client'

export type BridgeTestResult = {
  ok: boolean
  message: string
  latencyMs: number
  details?: Record<string, unknown>
}

// =============================================================================
// testBridge — Sadece Supabase bağlantısı
// =============================================================================
export async function testBridge(hotelId: string): Promise<BridgeTestResult> {
  const t0 = Date.now()
  const central = getCentralSupabase()

  try {
    const client = await getHotelClient(hotelId)
    if (!client) {
      const result: BridgeTestResult = {
        ok: false,
        message: 'Bridge credentials eksik veya çözülemedi',
        latencyMs: Date.now() - t0,
      }
      await persistResult(hotelId, result, central)
      return result
    }

    // Demo Hotel'in standart tablolarından birini sorgulayalım — departments güvenli
    const { error, count } = await client
      .from('departments')
      .select('*', { count: 'exact', head: true })

    const latencyMs = Date.now() - t0

    if (error) {
      const result: BridgeTestResult = {
        ok: false,
        message: `DB hatası: ${error.message}`,
        latencyMs,
        details: { code: error.code, hint: error.hint ?? null },
      }
      await persistResult(hotelId, result, central)
      return result
    }

    const result: BridgeTestResult = {
      ok: true,
      message: `Bağlantı başarılı (${count ?? 0} departman)`,
      latencyMs,
      details: { departmentCount: count ?? 0 },
    }
    await persistResult(hotelId, result, central)
    return result
  } catch (e) {
    const latencyMs = Date.now() - t0
    const result: BridgeTestResult = {
      ok: false,
      message: `Beklenmeyen hata: ${(e as Error).message}`,
      latencyMs,
    }
    await persistResult(hotelId, result, central)
    return result
  }
}

// =============================================================================
// testBridgeWithTelegram — Supabase + Telegram getMe doğrulaması
// Credentials kaydından sonra otomatik doğrulama için kullanılır.
// is_healthy = true ancak ikisi de başarılıysa.
// =============================================================================
export async function testBridgeWithTelegram(hotelId: string): Promise<BridgeTestResult> {
  const t0 = Date.now()
  const central = getCentralSupabase()

  // 1) Bridge decrypt
  let bridge
  try {
    bridge = await getDecryptedBridge(hotelId)
  } catch (e) {
    const result: BridgeTestResult = {
      ok: false,
      message: `Credentials şifre çözme hatası: ${(e as Error).message}`,
      latencyMs: Date.now() - t0,
    }
    await persistResult(hotelId, result, central)
    return result
  }

  if (!bridge) {
    const result: BridgeTestResult = {
      ok: false,
      message: 'Bridge credentials eksik — Supabase URL/Key ve Bot Token girilmeli',
      latencyMs: Date.now() - t0,
    }
    await persistResult(hotelId, result, central)
    return result
  }

  // 2) Supabase bağlantı testi
  let supabaseOk = false
  let supabaseMsg = ''
  let supabaseLatency = 0
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const testClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const t1 = Date.now()
    const { error } = await testClient
      .from('departments')
      .select('*', { count: 'exact', head: true })
    supabaseLatency = Date.now() - t1

    if (error) {
      // Kimlik doğrulama hataları → somut mesaj
      if (
        error.message?.toLowerCase().includes('invalid api key') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.code === 'PGRST301'
      ) {
        supabaseMsg = `Supabase Anon/Service Key reddedildi: ${error.message}`
      } else if (
        error.message?.toLowerCase().includes('fetch') ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('enotfound')
      ) {
        supabaseMsg = `Supabase URL ulaşılamıyor — URL doğru mu?`
      } else {
        // Tablo yok vs → bağlantı var ama tablo eksik
        supabaseOk = true
        supabaseMsg = 'Supabase bağlantısı OK'
      }
    } else {
      supabaseOk = true
      supabaseMsg = 'Supabase bağlantısı OK'
    }
  } catch (e) {
    supabaseMsg = `Supabase test hatası: ${(e as Error).message}`
  }

  // 3) Telegram getMe testi (eğer token varsa)
  let telegramOk = true // Token yoksa skip (isteğe bağlı alan)
  let telegramMsg = 'Telegram token girilmemiş (atlandı)'

  if (bridge.telegramBotToken) {
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${bridge.telegramBotToken}/getMe`,
        { method: 'GET' }
      )
      const tgData = await tgRes.json()
      if (tgData.ok) {
        telegramOk = true
        telegramMsg = `Telegram bot geçerli: @${tgData.result?.username ?? 'unknown'}`
      } else {
        telegramOk = false
        telegramMsg = `Telegram bot token geçersiz: ${tgData.description ?? 'Unauthorized'}`
      }
    } catch (e) {
      telegramOk = false
      telegramMsg = `Telegram API erişim hatası: ${(e as Error).message}`
    }
  }

  const latencyMs = Date.now() - t0
  const overallOk = supabaseOk && telegramOk

  // Somut birleşik mesaj
  let message: string
  if (overallOk) {
    message = `Sağlıklı — ${supabaseMsg}; ${telegramMsg}`
  } else if (!supabaseOk && !telegramOk) {
    message = `${supabaseMsg} | ${telegramMsg}`
  } else if (!supabaseOk) {
    message = supabaseMsg
  } else {
    message = telegramMsg
  }

  const result: BridgeTestResult = {
    ok: overallOk,
    message,
    latencyMs,
    details: {
      supabaseOk,
      supabaseMsg,
      supabaseLatency,
      telegramOk,
      telegramMsg,
    },
  }

  await persistResult(hotelId, result, central)
  return result
}

// =============================================================================
// persistResult — bridge_credentials + system_health güncelle
// =============================================================================
type CentralClient = ReturnType<typeof getCentralSupabase>

async function persistResult(
  hotelId: string,
  result: BridgeTestResult,
  central: CentralClient
) {
  const now = new Date().toISOString()
  // bridge_credentials tablosunu güncelle
  await central
    .from('bridge_credentials')
    .update({ is_healthy: result.ok, last_verified_at: now })
    .eq('hotel_id', hotelId)
  // system_health tablosuna kayıt at
  await central.from('system_health').insert({
    hotel_id: hotelId,
    check_type: 'bridge_supabase',
    status: result.ok ? 'healthy' : 'unhealthy',
    details: {
      message: result.message,
      latencyMs: result.latencyMs,
      ...(result.details ?? {}),
    },
    checked_at: now,
  })
}
