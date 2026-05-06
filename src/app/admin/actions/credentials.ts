'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCentralServerClient } from '@/lib/supabase/central-server'
import { getSessionAdmin } from '@/lib/auth/session'
import { logAudit } from '@/lib/auth/audit'
import { encryptCredential } from '@/lib/encryption'

export async function saveCredentialsAction(hotelId: string, formData: FormData) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  // Helper: encrypt only if value is provided (empty = keep existing)
  const enc = async (key: string): Promise<string | null> => {
    const v = String(formData.get(key) ?? '').trim()
    return v ? encryptCredential(v) : null
  }

  const update: Record<string, unknown> = {
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

  const supabase = await getCentralServerClient()
  await supabase.from('bridge_credentials').update(update).eq('hotel_id', hotelId)

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'credentials.update',
    resourceType: 'bridge_credentials',
    hotelId,
  })

  revalidatePath(`/admin/hotels/${hotelId}/credentials`)
  redirect(`/admin/hotels/${hotelId}/credentials?saved=1`)
}
