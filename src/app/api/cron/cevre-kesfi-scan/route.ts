import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { queryPerplexity } from '@/lib/perplexity/client'
import { PERPLEXITY_CATEGORIES, getCategoryByTag } from '@/lib/perplexity/categories'
import type { InterestTag } from '@/lib/perplexity/types'

// Tek otel + tek kategori/tetik ~6sn surer; 300 fazlasiyla yeterli (guvenli ust sinir)
export const maxDuration = 300

/**
 * Cevre Kesfi otomatik tarama cron'u — ADIM A4 (kategori-bazli round-robin)
 * cron-job.org SAATLIK tetikler. Her tetik EN ESKI (otel, kategori) ciftini secip
 * SADECE o tek kategoriyi tarar (1 Perplexity cagrisi, ~6sn) — cron-job.org 30sn'ye rahat sigar.
 * Repo deseni korunur: sirali await, waitUntil/fire-and-forget YOK.
 * 3 otel x 10 kategori = 30 cift; saatlik tetikle ~30 saatte tam tur.
 */
export async function POST(req: NextRequest) {
  // Auth — health-check ile birebir ayni desen
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getCentralSupabase()
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, slug, status')
    .eq('status', 'active')

  if (!hotels || hotels.length === 0) {
    return NextResponse.json({ ok: true, total: 0, scanned: null })
  }

  // health-check ile ayni tenant baglanti deseni
  const getHotelSupabase = async (hotelId: string): Promise<SupabaseClient | null> => {
    if (hotelId === process.env.DEMO_HOTEL_ID) {
      try { return getDemoHotelSupabase() } catch { return null }
    }
    try {
      const { getHotelClient } = await import('@/lib/tenant/get-hotel-client')
      return await getHotelClient(hotelId)
    } catch {
      return null
    }
  }

  const ALL_TAGS = PERPLEXITY_CATEGORIES.map((c) => c.tag)

  // ── SIRA SECIMI: tum (otel, kategori) ciftleri arasinda EN ESKI olani sec ──
  // Her otelin tenant DB'sinde mevcut kategorilerin created_at'ini oku (Perplexity YOK).
  // Eksik (hic taranmamis) kategori en oncelikli (zaman 0).
  let target: {
    hotelId: string
    hotelName: string
    client: SupabaseClient
    tag: string
  } | null = null
  let oldestTime = Number.POSITIVE_INFINITY

  for (const hotel of hotels) {
    try {
      const client = await getHotelSupabase(hotel.id as string)
      if (!client) continue

      // Bu otelin mevcut kategorilerinin en yeni created_at'lerini topla
      const { data: rows } = await client
        .from('perplexity_discoveries')
        .select('interest_tag, created_at')
        .order('created_at', { ascending: false })

      // tag -> en yeni created_at (ms) haritasi
      const latestByTag = new Map<string, number>()
      for (const row of rows ?? []) {
        const tag = row.interest_tag as string
        if (!latestByTag.has(tag)) {
          latestByTag.set(tag, row.created_at ? new Date(row.created_at).getTime() : 0)
        }
      }

      // Bu otelin her kategorisi icin: kayit yoksa 0 (en oncelikli), varsa zamani
      for (const tag of ALL_TAGS) {
        const t = latestByTag.has(tag) ? (latestByTag.get(tag) as number) : 0
        if (t < oldestTime) {
          oldestTime = t
          target = {
            hotelId: hotel.id as string,
            hotelName: hotel.name as string,
            client,
            tag,
          }
        }
      }
    } catch {
      // otel-bazli hata sira secimini bozmasin
      continue
    }
  }

  if (!target) {
    return NextResponse.json({ ok: true, total: hotels.length, scanned: null, reason: 'no_reachable_hotel' })
  }

  // ── SECILEN (otel, kategori) CIFTINI TARA ──
  const { data: settings } = await target.client
    .from('hotel_settings')
    .select('address')
    .limit(1)
    .maybeSingle()

  const address = settings?.address
  if (!address) {
    return NextResponse.json({
      ok: true,
      total: hotels.length,
      scanned: target.hotelName,
      tag: target.tag,
      inserted: 0,
      reason: 'no_address',
    })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  let inserted = 0
  let failedReason: string | null = null

  try {
    const result = await queryPerplexity(target.tag as InterestTag, address)
    const cat = getCategoryByTag(target.tag)
    const queryText = cat ? cat.prompt_template.replace('{address}', address) : target.tag

    // delete-then-insert: bu otel+tag icin eski kaydi temizle, tek taze kayit kalsin
    await target.client
      .from('perplexity_discoveries')
      .delete()
      .eq('interest_tag', target.tag)

    const { error: insertError } = await target.client
      .from('perplexity_discoveries')
      .insert({
        interest_tag: target.tag,
        query_text: queryText,
        results: result.places,
        raw_response: result.raw_response,
        sources: result.sources,
        model_used: result.model_used,
        tokens_used: result.tokens_used,
        expires_at: expiresAt,
      })

    if (insertError) {
      failedReason = insertError.message
    } else {
      inserted = 1
    }
  } catch (e) {
    failedReason = (e as Error).message
  }

  return NextResponse.json({
    ok: true,
    step: 'A4-category-roundrobin',
    total: hotels.length,
    scanned: target.hotelName,
    tag: target.tag,
    inserted,
    failedReason,
    checkedAt: new Date().toISOString(),
  })
}
