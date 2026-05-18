/**
 * Modul 17a — Import API
 * POST /api/hotel-admin/[slug]/inhouse/import
 *
 * Body: { mapping: ColumnMapping, file_base64: string, file_name?: string }
 *
 * Islemi:
 * 1. excel_column_mapping tablosuna mapping'i UPSERT eder (otel bazinda hatirlama)
 * 2. Excel'i parse eder, mapping'e gore 6 alani cikarir
 *    - Tarih parse HATASI: TUM upload iptal edilir (ya hep ya hic)
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
// Turkce ve Ingilizce ay isimleri (buyuk/kucuk harf duyarsiz)
// ---------------------------------------------------------------------------
const MONTH_MAP: Record<string, number> = {
  // Turkce
  ocak: 1,  subat: 2,  mart: 3,   nisan: 4,  mayis: 5,  haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
  // Ingilizce (3-harf kisaltma)
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// ---------------------------------------------------------------------------
// parseFlexibleDate — gercek PMS Excel formatlarini destekler
//
// Kabul edilenler:
//   1. JavaScript Date objesi
//   2. YYYY-MM-DD
//   3. DD.MM.YYYY
//   4. DD/MM/YYYY
//   5. DD-MM-YYYY  (gun-ay-yil, tire ile)
//   6. DD Ay YYYY  (Turkce veya Ingilizce ay adi)
//   7. Excel serial number (number)
//
// Reddedilenler:
//   - MM/DD/YYYY (Amerikan format — belirsizlik riski)
//   - Parse edilemeyen her turlu deger -> hata firlatir
// ---------------------------------------------------------------------------
function parseFlexibleDate(val: unknown, context?: string): string {
  const ctx = context ?? String(val)

  const fail = () => {
    throw new Error(
      `Tarih formati anlasilmadi: '${ctx}'. Lutfen DD.MM.YYYY veya YYYY-MM-DD formati kullanin.`
    )
  }

  // 1. JavaScript Date objesi
  if (val instanceof Date) {
    if (isNaN(val.getTime())) fail()
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 7. Excel serial number (number)
  if (typeof val === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(val)
    if (!jsDate) fail()
    const y = jsDate.y
    const m = String(jsDate.m).padStart(2, '0')
    const d = String(jsDate.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof val !== 'string') fail()

  const s = (val as string).trim()
  if (!s) fail()

  // 2. YYYY-MM-DD  (ISO format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }

  // 3 & 4. DD.MM.YYYY  veya  DD/MM/YYYY
  //    Not: tire (DD-MM-YYYY) formati asagida ayri yakalanir
  const dotSlash = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dotSlash) {
    const [, d, mo, y] = dotSlash
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // 5. DD-MM-YYYY  (tire ile, gun-ay-yil)
  //    YYYY-MM-DD zaten yukarda yakalanmis, dolayisiyla burada
  //    sadece 1-2 haneli gun ile baslayanlar kalmis olur.
  const dashDMY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashDMY) {
    const [, d, mo, y] = dashDMY
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // 6. DD Ay YYYY  (Turkce veya Ingilizce ay adi)
  const textMonth = s.match(/^(\d{1,2})\s+([A-Za-zçğıöşüÇĞİÖŞÜ]+)\s+(\d{4})$/)
  if (textMonth) {
    const [, d, monthStr, y] = textMonth
    const monthNum = MONTH_MAP[monthStr.toLowerCase()]
    if (!monthNum) fail()
    return `${y}-${String(monthNum).padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // 2 haneli yil destegi (opsiyonel ek): DD.MM.YY
  const twoDigitYear = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/)
  if (twoDigitYear) {
    const [, d, mo, y] = twoDigitYear
    const fullY = parseInt(y) < 50 ? `20${y}` : `19${y}`
    return `${fullY}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  fail()
  // TypeScript icin — asla buraya gelinmez
  return ''
}

// ---------------------------------------------------------------------------
// Excel row -> GuestRow donusumu
// rowIndex: 0-tabanli veri satir indeksi (baslik haric); hata mesajinda gosterilir
// Hata firlatir — caller tum upload'i iptal eder (ya hep ya hic)
// ---------------------------------------------------------------------------
function extractGuest(
  row: Record<string, unknown>,
  mapping: ColumnMapping,
  rowIndex: number,
): GuestRow {
  const rowLabel = `${rowIndex + 2}. satir` // Excel'de 1. satir baslik, veri 2'den baslar

  const roomRaw = mapping.room_number ? row[mapping.room_number] : null
  const nameRaw = mapping.guest_name ? row[mapping.guest_name] : null
  const checkInRaw = mapping.check_in ? row[mapping.check_in] : null
  const checkOutRaw = mapping.check_out ? row[mapping.check_out] : null

  const room_number = String(roomRaw ?? '').trim()
  const guest_name = String(nameRaw ?? '').trim()

  // Bos satirlari sessizce atla (tamamen bos satirlar olabilir)
  if (!room_number && !guest_name) {
    throw new SkipRowError()
  }

  let check_in_date: string
  let check_out_date: string

  try {
    check_in_date = parseFlexibleDate(checkInRaw, String(checkInRaw ?? ''))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${rowLabel}: ${msg}`)
  }

  try {
    check_out_date = parseFlexibleDate(checkOutRaw, String(checkOutRaw ?? ''))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${rowLabel}: ${msg}`)
  }

  if (!room_number) throw new Error(`${rowLabel}: Oda numarasi bos.`)
  if (!guest_name) throw new Error(`${rowLabel}: Misafir adi bos.`)

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

// Bos satirlari isaretlemek icin ozel hata sinifi
class SkipRowError extends Error {
  constructor() { super('skip') }
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

    // Gecerli satirlari cikar — HATA VARSA TUM UPLOAD IPTAL EDILIR (ya hep ya hic)
    const guestRows: GuestRow[] = []
    for (let i = 0; i < rawRows.length; i++) {
      try {
        const guest = extractGuest(rawRows[i], mapping, i)
        guestRows.push(guest)
      } catch (e) {
        if (e instanceof SkipRowError) continue // tamamen bos satir, atla
        // Gercek hata — tum upload'i durdur
        throw e
      }
    }

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
