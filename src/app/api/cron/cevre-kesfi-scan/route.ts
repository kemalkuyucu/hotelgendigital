import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { queryPerplexity } from '@/lib/perplexity/client'
import { PERPLEXITY_CATEGORIES, getCategoryByTag } from '@/lib/perplexity/categories'
import type { InterestTag } from '@/lib/perplexity/types'

// Fluid compute (Hobby) ile 300sn'ye kadar calisabilir — 3 otel x 10 kategori Perplexity icin gerekli
export const maxDuration = 300

/**
 * Cevre Kesfi otomatik tarama cron'u — ADIM A2 (TAM tarama + insert)
 * cron-job.org Mon+Fri tetikler. force-refresh: her calismada 10 kategoriyi yeniden tarar.
 * Her otel icin: baglan -> adres oku -> 10 kategori dongusu -> queryPerplexity ->
 * eski kaydi sil (delete-then-insert) -> yeni insert (7 gun expires_at).
 * Hata yutma: bir otel/kategori hatasi digerlerini bozmaz (webhook-health deseni).
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
    return NextResponse.json({ ok: true, total: 0, results: [] })
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

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const results: Array<{
    hotel: string
    scanned: number
    inserted: number
    failed: number
    failedTags: string[]
  }> = []

  for (const hotel of hotels) {
    const summary = { hotel: hotel.name as string, scanned: 0, inserted: 0, failed: 0, failedTags: [] as string[] }
    try {
      const client = await getHotelSupabase(hotel.id as string)
      if (!client) {
        results.push(summary)
        continue
      }

      const { data: settings } = await client
        .from('hotel_settings')
        .select('address')
        .limit(1)
        .maybeSingle()

      const address = settings?.address
      if (!address) {
        results.push(summary)
        continue
      }

      // 10 kategoriyi sirayla tara (force-refresh)
      for (const category of PERPLEXITY_CATEGORIES) {
        const tag = category.tag
        summary.scanned++
        try {
          const result = await queryPerplexity(tag as InterestTag, address)
          const cat = getCategoryByTag(tag)
          const queryText = cat ? cat.prompt_template.replace('{address}', address) : tag

          // delete-then-insert: eski kaydi temizle, tek taze kayit kalsin
          await client
            .from('perplexity_discoveries')
            .delete()
            .eq('interest_tag', tag)

          const { error: insertError } = await client
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
            summary.failed++
            summary.failedTags.push(tag)
          } else {
            summary.inserted++
          }
        } catch {
          // kategori-bazli hata digerlerini bozmasin
          summary.failed++
          summary.failedTags.push(tag)
        }
      }
    } catch {
      // otel-bazli hata digerlerini bozmasin
    }
    results.push(summary)
  }

  return NextResponse.json({
    ok: true,
    step: 'A2-scan',
    total: hotels.length,
    results,
    checkedAt: new Date().toISOString(),
  })
}
