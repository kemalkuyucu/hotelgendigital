import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'
import { logAudit } from '@/lib/auth/audit'

// =============================================================================
// POST /api/admin/hotels
// Wizard Adım 1: Oteli oluştur + boş bridge_credentials kaydı aç.
// Sadece super_admin rolü kullanabilir.
// =============================================================================

export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden: super_admin required' }, { status: 403 })
  }

  let body: {
    name?: string
    slug?: string
    package_id?: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    address?: string
    is_demo?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.slug || !body.package_id) {
    return NextResponse.json({ error: 'name, slug and package_id are required' }, { status: 400 })
  }

  const supabase = getCentralSupabase()

  // Slug benzersizlik kontrolü
  const { data: existing } = await supabase
    .from('hotels')
    .select('id')
    .eq('slug', body.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `Slug "${body.slug}" zaten kullanımda` }, { status: 409 })
  }

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .insert({
      name: body.name,
      slug: body.slug,
      package_id: body.package_id,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      address: body.address || null,
      is_demo: body.is_demo ?? false,
      status: 'active',
    })
    .select('id, slug')
    .single()

  if (hotelError || !hotel) {
    return NextResponse.json({ error: hotelError?.message ?? 'Hotel oluşturulamadı' }, { status: 500 })
  }

  // Boş bridge_credentials satırı aç (is_healthy=false)
  await supabase.from('bridge_credentials').insert({
    hotel_id: hotel.id,
    encryption_key_version: 1,
    is_healthy: false,
  })

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.onboarding.started',
    resourceType: 'hotel',
    resourceId: hotel.id,
    hotelId: hotel.id,
    details: { name: body.name, slug: body.slug },
  })

  return NextResponse.json({ id: hotel.id, slug: hotel.slug })
}
