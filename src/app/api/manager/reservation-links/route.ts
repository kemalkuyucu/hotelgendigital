/**
 * /api/manager/reservation-links
 * Modül: Rezervasyon Linkleri (Faz 1)
 *
 * GET    — Tüm aktif + arşivlenmiş linkleri sort_order ASC sıralar, döndürür.
 *           Yetki: hotel_owner | front_office_manager
 * POST   — Yeni link ekle.
 *           Yetki: hotel_owner | front_office_manager
 * PATCH  — Link güncelle (label, url, sort_order, is_active).
 *           Yetki: hotel_owner | front_office_manager
 * DELETE — HARD DELETE YOK → is_active=false (arşivle).
 *           Yetki: hotel_owner | front_office_manager
 *
 * Rol kontrolü SERVER'da yapılır; client'tan role kabul edilmez.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'

// Hangi roller bu modülü yönetebilir
const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

function isAllowed(role: string): role is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role)
}

// Basit URL format doğrulaması (http / https ile başlamalı)
function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url.trim())
}

// ─────────────────────────────────────────────
// GET — Linkleri listele (sort_order ASC)
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const admin = await getHotelAdminFromCookie()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAllowed(admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    const { data, error } = await tenant.hotelSupabase
      .from('reservation_links')
      .select('id, label, url, sort_order, is_official, is_active, created_at, created_by')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[reservation-links] GET error:', error)
      return NextResponse.json({ error: 'Linkler getirilemedi' }, { status: 500 })
    }

    return NextResponse.json({ links: data ?? [] }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reservation-links] GET unexpected:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST — Yeni link ekle
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const admin = await getHotelAdminFromCookie()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAllowed(admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { label, url, sort_order, is_official } = body as {
      label?: string
      url?: string
      sort_order?: number
      is_official?: boolean
    }

    if (!label || typeof label !== 'string' || label.trim() === '') {
      return NextResponse.json({ error: 'label zorunludur' }, { status: 400 })
    }
    if (!url || typeof url !== 'string' || !isValidUrl(url)) {
      return NextResponse.json({ error: 'Geçerli bir URL giriniz (http/https ile başlamalı)' }, { status: 400 })
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    const { data, error } = await tenant.hotelSupabase
      .from('reservation_links')
      .insert({
        label: label.trim(),
        url: url.trim(),
        sort_order: typeof sort_order === 'number' ? sort_order : 99,
        is_official: typeof is_official === 'boolean' ? is_official : false,
        is_active: true,
        created_by: admin.full_name ?? admin.username,
      })
      .select()
      .single()

    if (error) {
      console.error('[reservation-links] POST error:', error)
      return NextResponse.json({ error: 'Link eklenemedi' }, { status: 500 })
    }

    return NextResponse.json({ link: data }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reservation-links] POST unexpected:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// PATCH — Link güncelle
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getHotelAdminFromCookie()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAllowed(admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, label, url, sort_order, is_active, is_official } = body as {
      id?: string
      label?: string
      url?: string
      sort_order?: number
      is_active?: boolean
      is_official?: boolean
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })
    }
    if (url !== undefined && !isValidUrl(url)) {
      return NextResponse.json({ error: 'Geçerli bir URL giriniz (http/https ile başlamalı)' }, { status: 400 })
    }

    // Sadece değiştirilmek istenen alanları güncelle
    const updates: Record<string, unknown> = {}
    if (label !== undefined) updates.label = String(label).trim()
    if (url !== undefined) updates.url = String(url).trim()
    if (typeof sort_order === 'number') updates.sort_order = sort_order
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (typeof is_official === 'boolean') updates.is_official = is_official

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 })
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    const { data, error } = await tenant.hotelSupabase
      .from('reservation_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[reservation-links] PATCH error:', error)
      return NextResponse.json({ error: 'Link güncellenemedi' }, { status: 500 })
    }

    return NextResponse.json({ link: data }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reservation-links] PATCH unexpected:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// DELETE — HARD DELETE YOK; is_active=false (arşivle)
// ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getHotelAdminFromCookie()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAllowed(admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id zorunludur (query param)' }, { status: 400 })
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug)

    const { data, error } = await tenant.hotelSupabase
      .from('reservation_links')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[reservation-links] DELETE(archive) error:', error)
      return NextResponse.json({ error: 'Link arşivlenemedi' }, { status: 500 })
    }

    return NextResponse.json({ archived: data }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reservation-links] DELETE unexpected:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
