import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth: sadece süper admin ──────────────────────────────
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Bu işlem sadece süper admin yetkisi gerektirir' }, { status: 403 })
  }

  const { id: hotelId } = await params
  const supabase = getCentralSupabase()

  // ── Otel var mı ve zaten silinmiş mi? ────────────────────
  const { data: hotel, error: fetchError } = await supabase
    .from('hotels')
    .select('id, name, slug, deleted_at')
    .eq('id', hotelId)
    .single()

  if (fetchError || !hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı' }, { status: 404 })
  }

  if (hotel.deleted_at) {
    return NextResponse.json({ error: 'Otel zaten silinmiş' }, { status: 409 })
  }

  // ── Soft delete ───────────────────────────────────────────
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('hotels')
    .update({
      status: 'deleted',
      deleted_at: now,
      deleted_by: admin.username,
    })
    .eq('id', hotelId)

  if (updateError) {
    console.error('[hotel-delete] update error:', updateError)
    return NextResponse.json({ error: 'Silme işlemi başarısız' }, { status: 500 })
  }

  // ── Audit log ─────────────────────────────────────────────
  await supabase.from('audit_log').insert({
    actor_username: admin.username,
    action: 'hotel.soft_delete',
    resource_type: 'hotel',
    hotel_id: hotelId,
    details: {
      hotel_name: hotel.name,
      hotel_slug: hotel.slug,
      deleted_at: now,
      deleted_by: admin.username,
    },
    ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
  })

  return NextResponse.json({ success: true, deleted_at: now })
}
