import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Bu işlem sadece süper admin yetkisi gerektirir' }, { status: 403 })
  }

  const { id: hotelId } = await params
  const supabase = getCentralSupabase()

  const { data: hotel, error: fetchError } = await supabase
    .from('hotels')
    .select('id, name, slug, deleted_at')
    .eq('id', hotelId)
    .single()

  if (fetchError || !hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı' }, { status: 404 })
  }

  if (!hotel.deleted_at) {
    return NextResponse.json({ error: 'Otel silinmiş değil' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('hotels')
    .update({
      status: 'active',
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', hotelId)

  if (updateError) {
    return NextResponse.json({ error: 'Geri yükleme başarısız: ' + updateError.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    actor_username: admin.username,
    action: 'hotel.restore',
    resource_type: 'hotel',
    hotel_id: hotelId,
    details: { hotel_name: hotel.name, hotel_slug: hotel.slug, restored_by: admin.username },
    ip_address: request.headers.get('x-forwarded-for') ?? null,
  })

  return NextResponse.json({ success: true })
}
