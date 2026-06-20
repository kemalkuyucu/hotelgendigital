import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { queryPerplexity } from '@/lib/perplexity/client'
import { PERPLEXITY_CATEGORIES, getCategoryByTag } from '@/lib/perplexity/categories'
import type { InterestTag } from '@/lib/perplexity/types'

// Fluid compute (Hobby) ile 300sn'ye kadar calisabilir — tek otel x 10 kategori icin yeterli
export const maxDuration = 300

/**
 * Cevre Kesfi otomatik tarama cron'u — ADIM A3 (ROUND-ROBIN, tek otel/tetik)
 * cron-job.org gunde 1 kez tetikler. Her tetik EN ESKI taranan oteli secip sadece onu tarar.
 * Bu sayede her tetik ~10 cagri (~15sn) — cron-job.org 30sn timeout'una sigar, log temiz.
 * Otel sayisi artarsa cron degismez; sira otomatik yonetilir.
 * Secilen otel icin: 10 kategori force-refresh, delete-then-insert, 7 gun expires_at.
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

  // ── 1) SIRA SECIMI: her otelin en yeni created_at'ini oku (Perplexity YOK, hizli) ──
  // En eski (veya hic taranmamis) otel oncelikli. Round-robin boylece olusur.
  let target: { id: string; name: string; client: SupabaseClient } | null = null
  let oldestTime = Number.POSITIVE_INFINITY

  for (const hotel of hotels) {
    try {
      const client = await getHotelSupabase(hotel.id as string)
      if (!client) continue

      const { data: latest } = await client
        .from('perplexity_discoveries')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Hic kayit yoksa en oncelikli (zaman 0 kabul)
      const t = latest?.created_at ? new Date(latest.created_at).getTime() : 0
      if (t < oldestTime) {
        oldestTime = t
        target = { id: hotel.id as string, name: hotel.name as string, client }
      }
    } catch {
      // otel-bazli hata sira secimini bozmasin
      continue
    }
  }

  if (!target) {
    return NextResponse.json({ ok: true, total: hotels.length, scanned: null, reason: 'no_reachable_hotel' })
  }

  // ── 2) SECILEN OTELI TARA: adres oku, 10 kategori force-refresh ──
  const { data: settings } = await target.client
    .from('hotel_settings')
    .select('address')
    .limit(1)
    .maybeSingle()

  const address = settings?.address
  if (!address) {
    return NextResponse.json({ ok: true, total: hotels.length, scanned: target.name, inserted: 0, reason: 'no_address' })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  let inserted = 0
  let failed = 0
  const failedTags: string[] = []

  for (const category of PERPLEXITY_CATEGORIES) {
    const tag = category.tag
    try {
      const result = await queryPerplexity(tag as InterestTag, address)
      const cat = getCategoryByTag(tag)
      const queryText = cat ? cat.prompt_template.replace('{address}', address) : tag

      // delete-then-insert: eski kaydi temizle, tek taze kayit kalsin
      await target.client
        .from('perplexity_discoveries')
        .delete()
        .eq('interest_tag', tag)

      const { error: insertError } = await target.client
        .from('perplexity_discoveries')
        .insert({
          interest_tag: tag,
          query_text: queryText,
          results: result.places,
          raw_response: result.raw_response,
          sources: result.sources,
          model_used: result.model_used,
          tokens_used: result.tokens_used,
          expires_at: expiresAt,
        })

      if (insertError) {
        failed++
        failedTags.push(tag)
      } else {
        inserted++
      }
    } catch {
      failed++
      failedTags.push(tag)
    }
  }

  return NextResponse.json({
    ok: true,
    step: 'A3-roundrobin',
    total: hotels.length,
    scanned: target.name,
    inserted,
    failed,
    failedTags,
    checkedAt: new Date().toISOString(),
  })
}
