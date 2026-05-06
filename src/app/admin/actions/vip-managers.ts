'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCentralServerClient } from '@/lib/supabase/central-server'
import { getSessionAdmin } from '@/lib/auth/session'
import { logAudit } from '@/lib/auth/audit'

export async function createVipManagerAction(hotelId: string, formData: FormData) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  const supabase = await getCentralServerClient()
  await supabase.from('vip_managers').insert({
    hotel_id: hotelId,
    full_name: String(formData.get('full_name')),
    email: String(formData.get('email') ?? '').trim() || null,
    whatsapp_id: String(formData.get('whatsapp_id') ?? '').trim() || null,
    telegram_id: String(formData.get('telegram_id') ?? '').trim() || null,
    preferred_channel: String(formData.get('preferred_channel') ?? 'email'),
    preferred_language: String(formData.get('preferred_language') ?? 'tr'),
    receives_voice_reports: formData.get('receives_voice_reports') === 'on',
    is_active: true,
  })

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'vip_manager.create',
    resourceType: 'vip_manager',
    hotelId,
  })

  revalidatePath(`/admin/hotels/${hotelId}/vip-managers`)
}

export async function deleteVipManagerAction(hotelId: string, vipId: string) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  const supabase = await getCentralServerClient()
  await supabase.from('vip_managers').delete().eq('id', vipId)

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'vip_manager.delete',
    resourceType: 'vip_manager',
    resourceId: vipId,
    hotelId,
  })

  revalidatePath(`/admin/hotels/${hotelId}/vip-managers`)
}
