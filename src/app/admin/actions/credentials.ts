'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getSessionAdmin } from '@/lib/auth/session'
import { logAudit } from '@/lib/auth/audit'
import { encryptCredential } from '@/lib/encryption'
import { clearHotelClientCache } from '@/lib/tenant/get-hotel-client'
import { testBridgeWithTelegram } from '@/lib/tenant/test-bridge'
import { refreshTelegramWebhook } from '@/app/admin/(protected)/hotels/[id]/actions'

export async function saveCredentialsAction(hotelId: string, formData: FormData) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  // Helper: encrypt only if value is provided (empty = keep existing)
  const enc = async (key: string): Promise<string | null> => {
    const v = String(formData.get(key) ?? '').trim()
    return v ? encryptCredential(v) : null
  }

  const update: Record<string, unknown> = {
    hotel_id: hotelId, // upsert için gerekli
    manychat_workspace_id: String(formData.get('manychat_workspace_id') ?? '').trim() || null,
    telegram_bot_username: String(formData.get('telegram_bot_username') ?? '').trim() || null,
    whatsapp_business_id: String(formData.get('whatsapp_business_id') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }

  // Encrypted fields — only update if a new value was provided
  const supabaseUrl = await enc('supabase_url')
  const supabaseAnon = await enc('supabase_anon_key')
  const supabaseSvc = await enc('supabase_service_key')
  const manychat = await enc('manychat_api_key')
  const telegram = await enc('telegram_bot_token')

  if (supabaseUrl) update.supabase_url_encrypted = supabaseUrl
  if (supabaseAnon) update.supabase_anon_key_encrypted = supabaseAnon
  if (supabaseSvc) update.supabase_service_key_encrypted = supabaseSvc
  if (manychat) update.manychat_api_key_encrypted = manychat
  if (telegram) update.telegram_bot_token_encrypted = telegram

  const supabase = getCentralSupabase()

  // Kaydet öncesi is_healthy=false yap — eski sağlıklı durumu temizle
  update.is_healthy = false
  update.last_verified_at = null

  // BUG FIX: .update() → .upsert() — eğer kayıt yoksa oluştur, varsa güncelle
  const { error: updateError } = await supabase
    .from('bridge_credentials')
    .upsert(update, { onConflict: 'hotel_id' })

  if (updateError) {
    console.error('[credentials] DB upsert error:', updateError.message)
  }

  // Cache'i temizle — yeni credential'lar bir sonraki istekte kullanılsın
  clearHotelClientCache(hotelId)

  // Eğer Telegram bot token yeni girilmişse → webhook'u otomatik yenile (401 fix)
  if (telegram) {
    // Hotel slug'ını bul
    const { data: hotelRow } = await supabase
      .from('hotels')
      .select('slug')
      .eq('id', hotelId)
      .single()
    if (hotelRow?.slug) {
      const webhookResult = await refreshTelegramWebhook(hotelRow.slug)
      console.log(`[credentials] webhook kayıt: ${webhookResult.ok ? 'BAŞARILI' : 'BAŞARISIZ'} — ${webhookResult.message}`)
    }
  }

  // OTOMATİK BAĞLANTI TESTİ — Kaydet sonrası bridge + Telegram'ı hemen doğrula
  try {
    const testResult = await testBridgeWithTelegram(hotelId)
    console.log(`[credentials] otomatik test: ${testResult.ok ? 'BAŞARILI' : 'BAŞARISIZ'} — ${testResult.message}`)

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'credentials.auto_test',
      resourceType: 'bridge_credentials',
      hotelId,
      details: { ok: testResult.ok, message: testResult.message, latencyMs: testResult.latencyMs },
    })

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'credentials.update',
      resourceType: 'bridge_credentials',
      hotelId,
    })

    revalidatePath(`/admin/hotels/${hotelId}/credentials`)
    if (testResult.ok) {
      redirect(`/admin/hotels/${hotelId}/credentials?saved=1&tested=ok`)
    } else {
      // Hata mesajını URL-encode et (max 200 karakter)
      const errParam = encodeURIComponent(testResult.message.slice(0, 200))
      redirect(`/admin/hotels/${hotelId}/credentials?saved=1&tested=fail&err=${errParam}`)
    }
  } catch (testErr) {
    console.error('[credentials] otomatik test hatası:', testErr)
    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'credentials.update',
      resourceType: 'bridge_credentials',
      hotelId,
    })
    revalidatePath(`/admin/hotels/${hotelId}/credentials`)
    redirect(`/admin/hotels/${hotelId}/credentials?saved=1&tested=fail&err=Test+calistirilamadi`)
  }
}
