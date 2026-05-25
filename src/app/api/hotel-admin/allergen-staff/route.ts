// GET  /api/hotel-admin/allergen-staff
//   → is_active=true personeli döndür (fb + front_office)
//   Fields: id, full_name, role_title, department_key, telegram_user_id,
//           is_allergen_primary, is_allergen_backup, is_manager
//
// PATCH /api/hotel-admin/allergen-staff
//   Body: { staffId, is_allergen_primary?, is_allergen_backup?, is_manager? }
//   Yetki: hotel_owner VEYA fb_manager (bayrak güncellemesi)
//
// Rol SERVER'da JWT cookie'den türetilir; client'tan kabul edilmez.

import { NextRequest, NextResponse } from 'next/server'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'

// Yetki: alerjen bayrakları için hotel_owner veya fb_manager
const ALLERGEN_ALLOWED_ROLES = new Set(['hotel_owner', 'fb_manager'])

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie()
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })

  if (!ALLERGEN_ALLOWED_ROLES.has(admin.role)) {
    return NextResponse.json(
      { error: 'Bu işlem için hotel_owner veya fb_manager yetkisi gereklidir.' },
      { status: 403 }
    )
  }

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    const { data, error } = await tenant.hotelSupabase
      .from('department_staff')
      .select(
        'id, full_name, role_title, department_key, telegram_user_id, is_allergen_primary, is_allergen_backup, is_manager'
      )
      .eq('is_active', true)
      .in('department_key', ['fb', 'front_office'])
      .order('department_key')
      .order('full_name')

    if (error) {
      console.error('[allergen-staff/GET] DB error:', error)
      return NextResponse.json({ error: 'Personel listesi alınamadı.', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ staff: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.'
    console.error('[allergen-staff/GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie()
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })

  if (!ALLERGEN_ALLOWED_ROLES.has(admin.role)) {
    return NextResponse.json(
      { error: 'Bu işlem için hotel_owner veya fb_manager yetkisi gereklidir.' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 })
  }

  const { staffId, is_allergen_primary, is_allergen_backup, is_manager } = body as Record<string, unknown>

  if (typeof staffId !== 'string' || !staffId) {
    return NextResponse.json({ error: 'staffId zorunludur.' }, { status: 400 })
  }

  // En az bir bayrak gönderilmeli
  const updatePayload: Record<string, unknown> = {}
  if (typeof is_allergen_primary === 'boolean') updatePayload.is_allergen_primary = is_allergen_primary
  if (typeof is_allergen_backup === 'boolean')   updatePayload.is_allergen_backup   = is_allergen_backup
  if (typeof is_manager === 'boolean')            updatePayload.is_manager           = is_manager

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: 'En az bir bayrak (is_allergen_primary, is_allergen_backup, is_manager) gönderilmelidir.' },
      { status: 400 }
    )
  }

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    // Personeli doğrula + telegram_user_id kontrolü için çek
    const { data: existing, error: fetchError } = await tenant.hotelSupabase
      .from('department_staff')
      .select('id, full_name, telegram_user_id, department_key, is_active, is_allergen_primary, is_allergen_backup, is_manager')
      .eq('id', staffId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Personel bulunamadı.' }, { status: 404 })
    }

    // Soft-delete kuralı: pasif personele işlem yapılamaz
    if (!existing.is_active) {
      return NextResponse.json({ error: 'Pasif personelin bayrakları güncellenemez.' }, { status: 400 })
    }

    // Güncelle
    const { data: updated, error: updateError } = await tenant.hotelSupabase
      .from('department_staff')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', staffId)
      .select('id, full_name, role_title, department_key, telegram_user_id, is_allergen_primary, is_allergen_backup, is_manager')
      .single()

    if (updateError) {
      console.error('[allergen-staff/PATCH] DB error:', updateError)
      return NextResponse.json({ error: 'Güncelleme başarısız.', detail: updateError.message }, { status: 500 })
    }

    // KURAL: is_allergen_primary işaretliyse ve telegram_user_id yoksa uyar (engelleme yok)
    const warnings: string[] = []
    const isNowPrimary = typeof is_allergen_primary === 'boolean'
      ? is_allergen_primary
      : existing.is_allergen_primary ?? false

    if (isNowPrimary && !existing.telegram_user_id) {
      warnings.push(`${existing.full_name} için Telegram ID tanımlı değil — alerjen bildirimi iletilemez.`)
    }

    return NextResponse.json({
      success: true,
      staff: updated,
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.'
    console.error('[allergen-staff/PATCH]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
