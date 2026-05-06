import { getHotelClient } from './get-hotel-client'
import { getCentralSupabase } from '@/lib/supabase-client'

export type BridgeTestResult = {
  ok: boolean
  message: string
  latencyMs: number
  details?: Record<string, unknown>
}

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
