import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getHotelClient } from '@/lib/tenant/get-hotel-client'
import { getCentralSupabase } from '@/lib/supabase-client'
import { logAudit } from '@/lib/auth/audit'
import { hashPassword } from '@/lib/auth/password'

// =============================================================================
// POST /api/admin/hotels/[id]/create-first-admin
// Body: { username, password, email, full_name? }
// Tenant DB'ye hotel_admin_users INSERT (bcrypt cost=12, role='hotel_owner').
// is_healthy = true UPDATE (bridge_credentials).
// Sadece super_admin rolü kullanabilir.
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden: super_admin required' }, { status: 403 })
  }

  const { id } = await params

  let body: { username?: string; password?: string; email?: string; full_name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { username, password, email, full_name } = body
  if (!username || !password || !email) {
    return NextResponse.json(
      { ok: false, error: 'username, password ve email gerekli' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: 'Şifre en az 6 karakter olmalı' },
      { status: 400 }
    )
  }

  // 1) Tenant client al (service role)
  const tenantClient = await getHotelClient(id, { mode: 'service' })
  if (!tenantClient) {
    return NextResponse.json(
      { ok: false, error: 'Tenant bağlantısı kurulamadı. Önce migration\'ları çalıştırın.' },
      { status: 400 }
    )
  }

  // 2) Şifreyi hash'le (bcrypt cost=12)
  const passwordHash = await hashPassword(password)

  // 3) hotel_admin_users tablosuna INSERT
  const { error: insertError } = await tenantClient.from('hotel_admin_users').insert({
    username,
    password_hash: passwordHash,
    full_name: full_name ?? username,
    role: 'hotel_owner',
    is_active: true,
  })

  if (insertError) {
    // Duplicate username
    if (insertError.code === '23505') {
      return NextResponse.json(
        { ok: false, error: `"${username}" kullanıcı adı zaten mevcut` },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { ok: false, error: `Kullanıcı oluşturulamadı: ${insertError.message}` },
      { status: 500 }
    )
  }

  // 4) Central: is_healthy = true
  const central = getCentralSupabase()
  await central
    .from('bridge_credentials')
    .update({ is_healthy: true })
    .eq('hotel_id', id)

  // 5) Audit log: first_admin_created + completed
  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.onboarding.first_admin_created',
    resourceType: 'hotel',
    hotelId: id,
    details: { username, email, role: 'hotel_owner' },
  })

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.onboarding.completed',
    resourceType: 'hotel',
    hotelId: id,
    details: { is_healthy: true },
  })

  return NextResponse.json({ ok: true })
}
