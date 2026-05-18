/**
 * Modul 17a — Import API
 * POST /api/hotel-admin/[slug]/inhouse/import
 *
 * Body: { mapping: ColumnMapping, file_base64: string, file_name?: string }
 *
 * Islemi:
 * 1. excel_column_mapping tablosuna mapping'i UPSERT eder (otel bazinda hatirlama)
 * 2. Excel'i parse eder, mapping'e gore 6 alani cikarir
 * 3. inhouse_guests_v2'ye toplu islem:
 *    - Yeni room_number + check_in_date -> INSERT
 *    - Mevcut active ama Excel'de yok -> status=archived
 *    - Mevcut active Excel'de de var -> UPDATE
 * 4. inhouse_upload_history'ye 1 satir ekler
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

interface ColumnMapping {
  room_number: string | null
  agency: string | null
  guest_name: string | null
  guest_count: string | null
  check_in: string | null
  check_out: string | null
}

interface GuestRow {
  room_number: string
  agency: string | null
  guest_name: string
  guest_count: number
  check_in_date: string
  check_out_date: string
}

// ---------------------------------------------------------------------------
// Tarih parse yardimcisi
// Excel serial number veya string tarih kabul eder
// ---------------------------------------------------------------------------
function parseDate(val: unknown): string | null {
  if (!val) return null

  // Excel serial number (number)
  if (typeof val === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(val)
    if (jsDate) {
      const y = jsDate.y
      const m = String(jsDate.m).padStart(2, '0')
      const d = String(jsDate.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  // Date object
  if (val instanceof Date) {
    const iso = val.toISOString().split('T')[0]
    return iso
  }

  // String - cesitli formatlar: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return null

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

    // DD.MM.YYYY veya DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (m1) {
      const [, d, mo, y] = m1
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // D.M.YYYY
    const m2 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)
    if (m2) {
      const [, d, mo, y] = m2
      const fullY = parseInt(y) < 50 ? `20${y}` : `19${y}`
      return `${fullY}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Excel row -> GuestRow donusumu
// ---------------------------------------------------------------------------
function extractGuest(row: Record<string, unknown>, mapping: ColumnMapping): GuestRow | null {
  const roomRaw = mapping.room_number ? row[mapping.room_number] : null
  const nameRaw = mapping.guest_name ? row[mapping.guest_name] : null
  const checkInRaw = mapping.check_in ? row[mapping.check_in] : null
  const checkOutRaw = mapping.check_out ? row[mapping.check_out] : null

  const room_number = String(roomRaw ?? '').trim()
  const guest_name = String(nameRaw ?? '').trim()
  const check_in_date = parseDate(checkInRaw)
  const check_out_date = parseDate(checkOutRaw)

  // Zorunlu alanlar bos veya null ise satiri atla
  if (!room_number || !guest_name || !check_in_date || !check_out_date) return null

  const agencyRaw = mapping.agency ? row[mapping.agency] : null
  const countRaw = mapping.guest_count ? row[mapping.guest_count] : null
  const guest_count = parseInt(String(countRaw ?? '1')) || 1

  return {
    room_number,
    agency: agencyRaw ? String(agencyRaw).trim() || null : null,
    guest_name,
    guest_count,
    check_in_date,
    check_out_date,
  }
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  // Auth
  const admin = await getHotelAdminFromCookie()
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok.' }, { status: 403 })
  }
  const { slug } = await params
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 })
  }

  const body = await req.json() as {
    mapping: ColumnMapping
    file_base64: string
    file_name?: string
  }

  if (!body.mapping || !body.file_base64) {
    return NextResponse.json({ error: 'mapping ve file_base64 zorunludur.' }, { status: 400 })
  }

  const { mapping, file_base64, file_name } = body
  const batch_id = randomUUID()

  let inserted = 0
  let updated = 0
  let archived = 0
  let total_rows = 0

  try {
    const tenant = await resolveTenantBySlug(slug)

    // ---- 1. Mapping kaydet (UPSERT) ----
    const { error: mappingErr } = await tenant.hotelSupabase
      .from('excel_column_mapping')
      .upsert({
        hotel_slug: slug,
        room_number_col: mapping.room_number,
        agency_col: mapping.agency,
        guest_name_col: mapping.guest_name,
        guest_count_col: mapping.guest_count,
        check_in_col: mapping.check_in,
        check_out_col: mapping.check_out,
      }, { onConflict: 'hotel_slug' })

    if (mappingErr) {
      console.error('[import] Mapping upsert error:', mappingErr.message)
    } else {
      console.log('[import] Mapping saved for slug:', slug)
    }

    // ---- 2. Excel parse ----
    const buffer = Buffer.from(file_base64, 'base64')
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })

    total_rows = rawRows.length
    console.log('[import] Total raw rows:', total_rows)

    // Gecerli satirlari cikar
    const guestRows: GuestRow[] = rawRows
      .map((row) => extractGuest(row, mapping))
      .filter((g): g is GuestRow => g !== null)

    console.log('[import] Valid guest rows:', guestRows.length)

    // ---- 3. Mevcut aktif kayitlari al ----
    const { data: existingRows, error: fetchErr } = await tenant.hotelSupabase
      .from('inhouse_guests_v2')
      .select('id, room_number, check_in_date, guest_name, guest_count, check_out_date, agency')
      .eq('status', 'active')

    if (fetchErr) throw new Error('Mevcut kayitlar okunamadi: ' + fetchErr.message)

    type ExistingRow = {
      id: string
      room_number: string
      check_in_date: string
      guest_name: string
      guest_count: number
      check_out_date: string
      agency: string | null
    }

    const existing = (existingRows ?? []) as ExistingRow[]

    // Arama haritasi: "room_number::check_in_date" -> row
    const existingMap = new Map<string, ExistingRow>()
    for (const e of existing) {
      const key = `${e.room_number}::${e.check_in_date}`
      existingMap.set(key, e)
    }

    // Yeni Excel key seti
    const newKeySet = new Set<string>()
    for (const g of guestRows) {
      newKeySet.add(`${g.room_number}::${g.check_in_date}`)
    }

    // ---- 4. Toplu islem ----
    const toInsert: GuestRow[] = []
    const toUpdate: Array<{ id: string } & GuestRow> = []

    for (const g of guestRows) {
      const key = `${g.room_number}::${g.check_in_date}`
      const ex = existingMap.get(key)
      if (!ex) {
        toInsert.push(g)
      } else {
        // Degisiklik varsa update
        if (
          ex.guest_name !== g.guest_name ||
          ex.guest_count !== g.guest_count ||
          ex.check_out_date !== g.check_out_date ||
          ex.agency !== g.agency
        ) {
          toUpdate.push({ id: ex.id, ...g })
        }
      }
    }

    // Archive: mevcut active ama artik Excel'de yok
    const toArchiveIds: string[] = []
    for (const e of existing) {
      const key = `${e.room_number}::${e.check_in_date}`
      if (!newKeySet.has(key)) {
        toArchiveIds.push(e.id)
      }
    }

    // INSERT
    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((g) => ({
        room_number: g.room_number,
        agency: g.agency,
        guest_name: g.guest_name,
        guest_count: g.guest_count,
        check_in_date: g.check_in_date,
        check_out_date: g.check_out_date,
        status: 'active',
        upload_batch_id: batch_id,
      }))
      const { error: insertErr } = await tenant.hotelSupabase
        .from('inhouse_guests_v2')
        .insert(insertPayload)
      if (insertErr) throw new Error('Insert hatasi: ' + insertErr.message)
      inserted = toInsert.length
      console.log('[import] Inserted:', inserted)
    }

    // UPDATE (birer birer — performans sonrasi batch'e donusturulebilir)
    for (const g of toUpdate) {
      const { error: updateErr } = await tenant.hotelSupabase
        .from('inhouse_guests_v2')
        .update({
          guest_name: g.guest_name,
          guest_count: g.guest_count,
          check_out_date: g.check_out_date,
          agency: g.agency,
          upload_batch_id: batch_id,
        })
        .eq('id', g.id)
      if (updateErr) console.error('[import] Update error for id', g.id, ':', updateErr.message)
      else updated++
    }
    console.log('[import] Updated:', updated)

    // ARCHIVE
    if (toArchiveIds.length > 0) {
      const { error: archiveErr } = await tenant.hotelSupabase
        .from('inhouse_guests_v2')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .in('id', toArchiveIds)
      if (archiveErr) throw new Error('Archive hatasi: ' + archiveErr.message)
      archived = toArchiveIds.length
      console.log('[import] Archived:', archived)
    }

    // ---- 5. Gecmis kaydi ----
    const { error: histErr } = await tenant.hotelSupabase
      .from('inhouse_upload_history')
      .insert({
        batch_id,
        hotel_slug: slug,
        uploaded_by: admin.username,
        file_name: file_name ?? null,
        inserted_count: inserted,
        updated_count: updated,
        archived_count: archived,
        total_rows,
        status: 'success',
      })

    if (histErr) {
      console.error('[import] History insert error:', histErr.message)
    }

    return NextResponse.json({
      inserted,
      updated,
      archived,
      batch_id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.'
    console.error('[import] Fatal error:', msg)

    // Hata gecmisini kaydetmeye calis
    try {
      const tenant = await resolveTenantBySlug(slug)
      await tenant.hotelSupabase.from('inhouse_upload_history').insert({
        batch_id,
        hotel_slug: slug,
        uploaded_by: admin.username,
        file_name: file_name ?? null,
        inserted_count: inserted,
        updated_count: updated,
        archived_count: archived,
        total_rows,
        status: 'failed',
        error_detail: msg,
      })
    } catch { /* ignore */ }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
