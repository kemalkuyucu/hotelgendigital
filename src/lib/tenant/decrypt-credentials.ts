import { getCentralSupabase } from '@/lib/supabase-client'
import { decryptCredential } from '@/lib/encryption'

export type DecryptedBridge = {
  hotelId: string
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
  manychatApiKey: string | null
  telegramBotToken: string | null
  telegramBotUsername: string | null
  manychatWorkspaceId: string | null
  whatsappBusinessId: string | null
}

export async function getDecryptedBridge(hotelId: string): Promise<DecryptedBridge | null> {
  const supabase = getCentralSupabase()

  // FIX 1: single() yerine maybeSingle() — 0 satır döndüğünde PGRST116 atmaz, null döner.
  // Transient hata durumunda 1 kez retry (kısa 300ms bekleme).
  async function fetchBridge() {
    return supabase
      .from('bridge_credentials')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle()
  }

  let { data, error } = await fetchBridge()

  if (error) {
    // FIX 1: PostgREST hata mesajını logla + 1 retry
    console.warn(`[bridge] fetch error hotelId=${hotelId} (retry 1/1): code=${error.code} msg=${error.message}`)
    await new Promise((r) => setTimeout(r, 300))
    const retry = await fetchBridge()
    data = retry.data
    error = retry.error
    if (error) {
      console.error(`[bridge] fetch FAILED after retry hotelId=${hotelId}: code=${error.code} msg=${error.message}`)
      return null
    }
  }

  if (!data) return null
  if (!data.supabase_url_encrypted) return null // henüz doldurulmamış

  // NOT: decrypt hatası sessizce null'a çevrilmiyoruz — caller somut mesaj alsın
  try {
    return {
      hotelId: data.hotel_id,
      supabaseUrl: await decryptCredential(data.supabase_url_encrypted),
      supabaseAnonKey: await decryptCredential(data.supabase_anon_key_encrypted),
      supabaseServiceKey: await decryptCredential(data.supabase_service_key_encrypted),
      manychatApiKey: data.manychat_api_key_encrypted
        ? await decryptCredential(data.manychat_api_key_encrypted)
        : null,
      telegramBotToken: data.telegram_bot_token_encrypted
        ? await decryptCredential(data.telegram_bot_token_encrypted)
        : null,
      telegramBotUsername: data.telegram_bot_username ?? null,
      manychatWorkspaceId: data.manychat_workspace_id ?? null,
      whatsappBusinessId: data.whatsapp_business_id ?? null,
    }
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    console.error('[bridge] decrypt failed for hotel', hotelId, msg)
    // Sessizce null döndürmek yerine fırlat — test fonksiyonu somut mesaj gösterebilsin
    throw new Error(`Şifre çözme başarısız (hotel=${hotelId}): ${msg}`)
  }
}
