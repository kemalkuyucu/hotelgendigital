/**
 * Modul 17b — In-House List API
 * GET /api/hotel-admin/[slug]/inhouse/list?filter=tomorrow&start=...&end=...
 *
 * Query parametreleri:
 *   filter: "today" | "tomorrow" | "range"
 *   start:  YYYY-MM-DD (sadece filter=range ise)
 *   end:    YYYY-MM-DD (sadece filter=range ise)
 *
 * Yetki: hotel_owner veya front_office_manager
 * Siralama: room_number ASC
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

function getTodayISO(): string {
  // Server time (UTC+3 proxy icin simple UTC kullaniyoruz, UI tarafinda gosterim Turkce)
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dy = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function getTomorrowISO(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dy = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const admin = await getHotelAdminFromCookie()
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json(
      { error: 'Bu sayfaya erişim yetkiniz yok.' },
      { status: 403 },
    )
  }

  const { slug } = await params
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  // ── Query parametreleri ────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl
  const filter = searchParams.get('filter') ?? 'tomorrow'
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  let dateStart: string
  let dateEnd: string

  if (filter === 'today') {
    dateStart = getTodayISO()
    dateEnd = dateStart
  } else if (filter === 'tomorrow') {
    dateStart = getTomorrowISO()
    dateEnd = dateStart
  } else if (filter === 'range') {
    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'range filtresi icin start ve end parametreleri zorunludur.' },
        { status: 400 },
      )
    }
    // Basit format dogrulamasi
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) || !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
      return NextResponse.json(
        { error: 'Tarih formati YYYY-MM-DD olmalidir.' },
        { status: 400 },
      )
    }
    dateStart = startParam
    dateEnd = endParam
  } else {
    return NextResponse.json(
      { error: 'Gecersiz filter degeri. today | tomorrow | range bekleniyor.' },
      { status: 400 },
    )
  }

  console.log(`[inhouse/list] slug=${slug} filter=${filter} dateStart=${dateStart} dateEnd=${dateEnd}`)

  try {
    const tenant = await resolveTenantBySlug(slug)

    // ── Sorgu ──────────────────────────────────────────────────────────────
    let query = tenant.hotelSupabase
      .from('inhouse_guests_v2')
      .select(
        'id, room_number, agency, guest_name, guest_count, check_in_date, check_out_date, telegram_id, whatsapp_id, status',
      )
      .eq('status', 'active')
      .order('room_number', { ascending: true })

    if (dateStart === dateEnd) {
      query = query.eq('check_out_date', dateStart)
    } else {
      query = query.gte('check_out_date', dateStart).lte('check_out_date', dateEnd)
    }

    const { data, error } = await query

    if (error) {
      console.error('[inhouse/list] DB error:', error.message)
      return NextResponse.json(
        { error: 'Misafir listesi alınamadı: ' + error.message },
        { status: 500 },
      )
    }

    const guests = data ?? []

    console.log(`[inhouse/list] Found ${guests.length} guests for date range ${dateStart}..${dateEnd}`)

    return NextResponse.json({
      guests,
      meta: {
        filter,
        dateStart,
        dateEnd,
        count: guests.length,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.'
    console.error('[inhouse/list] Fatal:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
