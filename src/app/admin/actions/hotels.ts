'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getSessionAdmin } from '@/lib/auth/session'
import { logAudit } from '@/lib/auth/audit'
import { sendEmail } from '@/lib/email/client'
import { hotelWelcomeEmail } from '@/lib/email/templates/hotel-welcome'

export async function createHotelAction(formData: FormData) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  const supabase = getCentralSupabase()
  const payload = {
    name: String(formData.get('name')),
    slug: String(formData.get('slug')),
    package_id: String(formData.get('package_id')),
    contact_name: String(formData.get('contact_name') ?? '') || null,
    contact_email: String(formData.get('contact_email') ?? '') || null,
    contact_phone: String(formData.get('contact_phone') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
    is_demo: formData.get('is_demo') === 'on',
    status: 'active',
  }

  const { data: hotel, error } = await supabase
    .from('hotels')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Bootstrap empty bridge_credentials row
  await supabase.from('bridge_credentials').insert({
    hotel_id: hotel.id,
    encryption_key_version: 1,
    is_healthy: false,
  })

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.create',
    resourceType: 'hotel',
    resourceId: hotel.id,
    hotelId: hotel.id,
    details: { name: payload.name },
  })

  revalidatePath('/admin/hotels')

  // Yeni otel oluşturulunca contact_email varsa hoşgeldin maili gönder
  if (payload.contact_email) {
    const { html, text } = hotelWelcomeEmail({
      hotelName: payload.name,
      contactName: payload.contact_name ?? null,
      adminUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/admin`
        : 'https://hotelgen-v2.vercel.app/admin',
    })
    // Fire-and-forget — email gönderim hatası otel oluşturmayı engellemesin
    sendEmail({
      to: payload.contact_email,
      subject: `${payload.name} — HotelGen sistemine eklendi`,
      html,
      text,
    }).catch((err) => console.error('[email] hotel welcome failed', err))
  }

  redirect(`/admin/hotels/${hotel.id}`)
}

export async function updateHotelAction(id: string, formData: FormData) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  const supabase = getCentralSupabase()
  const payload = {
    name: String(formData.get('name')),
    slug: String(formData.get('slug')),
    package_id: String(formData.get('package_id')),
    contact_name: String(formData.get('contact_name') ?? '') || null,
    contact_email: String(formData.get('contact_email') ?? '') || null,
    contact_phone: String(formData.get('contact_phone') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
    status: String(formData.get('status') ?? 'active'),
    updated_at: new Date().toISOString(),
  }

  await supabase.from('hotels').update(payload).eq('id', id)

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.update',
    resourceType: 'hotel',
    resourceId: id,
    hotelId: id,
    details: { name: payload.name },
  })

  revalidatePath('/admin/hotels')
  revalidatePath(`/admin/hotels/${id}`)
  redirect('/admin/hotels')
}
