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
  const { data, error } = await supabase
    .from('bridge_credentials')
    .select('*')
    .eq('hotel_id', hotelId)
    .single()

  if (error || !data) return null
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
