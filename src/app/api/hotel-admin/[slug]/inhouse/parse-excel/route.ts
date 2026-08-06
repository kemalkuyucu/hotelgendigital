/**
 * Modul 17a — Parse Excel API
 * POST /api/hotel-admin/[slug]/inhouse/parse-excel
 *
 * FormData ile .xlsx / .xls dosyasi alir.
 * xlsx kutuphanesi ile parse eder, kolon basliklarini ve ilk 3 satiri cikarir.
 * Haiku AI (claude-haiku-4-5-20251001) ile kolon mapping tahmini yapar.
 * Daha once kaydedilmis mapping varsa da dondurur.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

interface ColumnMapping {
  room_number: string | null
  agency: string | null
  guest_name: string | null
  guest_count: string | null
  check_in: string | null
  check_out: string | null
}

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

  try {
    // Dosyayi oku
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // xlsx ile parse et
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'Excel dosyası boş veya geçersiz.' }, { status: 400 })
    }

    const sheet = workbook.Sheets[sheetName]
    // header: 1 -> ilk satiri baslik olarak kullan, defval: '' -> bos hucreleri bos string yap
    // Two-step cast required: xlsx returns unknown[][] with header:1 but generic param expects row objects
    const rows = (XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false, // tarihleri string olarak al
    }) as unknown) as unknown[][]

    if (rows.length < 1) {
      return NextResponse.json({ error: 'Excel dosyasında veri bulunamadı.' }, { status: 400 })
    }

    // Ilk satir = basliklar
    const headers = (rows[0] as unknown[]).map((h) => String(h ?? '').trim()).filter(Boolean)

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Excel başlık satırı boş.' }, { status: 400 })
    }

    // Ilk 3 veri satirini al
    const dataRows = rows.slice(1, 4)
    const sample_rows = dataRows.map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => {
        obj[h] = (row as unknown[])[i] ?? ''
      })
      return obj
    })

    console.log('[parse-excel] Parsed headers:', headers)
    console.log('[parse-excel] Sample rows count:', sample_rows.length)

    // Haiku API cagri
    let suggested_mapping: ColumnMapping = {
      room_number: null,
      agency: null,
      guest_name: null,
      guest_count: null,
      check_in: null,
      check_out: null,
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey })

        const systemPrompt = `Sen otel yonetim sistemine entegre bir kolon eslestirme asistanisin. Sana verilen Excel kolon basliklarindan asagidaki 6 alana eslestirme yap: room_number (oda numarasi), agency (acente, varsa), guest_name (misafir ad soyad), guest_count (kisi sayisi), check_in (giris tarihi), check_out (cikis tarihi). Cevap formati JSON: room_number, agency, guest_name, guest_count, check_in, check_out alanlari icin Excel kolon basligini ata. Eger emin degilsen null koy. JSON disinda hicbir sey yazma.`

        const userMsg = `Excel kolon basliklari: [${headers.map(h => `"${h}"`).join(', ')}]\n\nOrnek veri satirlari:\n${JSON.stringify(sample_rows, null, 2)}`

        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        })

        const rawText = message.content
          .filter((c) => c.type === 'text')
          .map((c) => (c as { type: 'text'; text: string }).text)
          .join('')

        console.log('[parse-excel] Haiku raw response:', rawText)

        // JSON parse — bazen markdown code block gelir, temizle
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleaned) as Partial<ColumnMapping>

        suggested_mapping = {
          room_number: parsed.room_number ?? null,
          agency: parsed.agency ?? null,
          guest_name: parsed.guest_name ?? null,
          guest_count: parsed.guest_count ?? null,
          check_in: parsed.check_in ?? null,
          check_out: parsed.check_out ?? null,
        }

        console.log('[parse-excel] Suggested mapping:', suggested_mapping)
      } catch (haikuErr) {
        console.error('[parse-excel] Haiku API error:', haikuErr)
        // Haiku hatasi kritik degil, devam et
      }
    } else {
      console.warn('[parse-excel] ANTHROPIC_API_KEY missing, skipping Haiku call')
    }

    // Kayitli mapping'i al (varsa)
    let saved_mapping: ColumnMapping | null = null
    try {
      const tenant = await resolveTenantBySlug(slug)
      const { data: savedData } = await tenant.hotelSupabase
        .from('excel_column_mapping')
        .select('room_number_col, agency_col, guest_name_col, guest_count_col, check_in_col, check_out_col')
        .eq('hotel_slug', slug)
        .single()

      if (savedData) {
        saved_mapping = {
          room_number: savedData.room_number_col ?? null,
          agency: savedData.agency_col ?? null,
          guest_name: savedData.guest_name_col ?? null,
          guest_count: savedData.guest_count_col ?? null,
          check_in: savedData.check_in_col ?? null,
          check_out: savedData.check_out_col ?? null,
        }
        console.log('[parse-excel] Found saved mapping:', saved_mapping)
      }
    } catch {
      // Kayitli mapping yoksa sorun degil
    }

    return NextResponse.json({
      headers,
      sample_rows,
      suggested_mapping,
      saved_mapping,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.'
    console.error('[parse-excel] Error:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
