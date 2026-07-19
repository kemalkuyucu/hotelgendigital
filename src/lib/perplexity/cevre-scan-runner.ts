/**
 * Cevre Kesfi tarama cekirdegi (runSlaCheck deseni).
 * cevre-kesfi-scan/route.ts'ten cikarildi; hem cron route hem health-check
 * piggyback ayni fonksiyonu cagirir. Cagiran taraf hotelEntries + getHotelSupabase
 * saglar (health-check ile birebir ayni sozlesme).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { queryPerplexity } from '@/lib/perplexity/client'
import { PERPLEXITY_CATEGORIES, getCategoryByTag } from '@/lib/perplexity/categories'
import type { InterestTag } from '@/lib/perplexity/types'

type HotelEntry = { id: string; name?: string; slug?: string; status?: string }
type GetHotelSupabase = (hotelId: string) => Promise<SupabaseClient | null>

export type CevreKesfiScanOpts = {
  /** Bu tetikte en fazla kac (otel,kategori) taransin (Perplexity cagrisi = maliyet). */
  maxCalls?: number
  /** Bir kategori bu saatten daha yeniyse aday sayilmaz (taze kabul edilir). */
  staleHours?: number
}

export type CevreKesfiScanSummary = {
  scanned: Array<{ hotel: string; tag: string }>
  skipped: number
  errors: Array<{ hotel: string; tag: string; reason: string }>
}

export async function runCevreKesfiScan(
  hotelEntries: HotelEntry[],
  getHotelSupabase: GetHotelSupabase,
  opts: CevreKesfiScanOpts = {},
): Promise<CevreKesfiScanSummary> {
  const maxCalls = opts.maxCalls ?? 1
  const staleHours = opts.staleHours ?? 20
  const staleMs = staleHours * 60 * 60 * 1000
  const now = Date.now()

  // SADECE 'perplexity' modundaki kategoriler taranir; kb_only/disabled Perplexity cagrisi harcamaz.
  const ALL_TAGS = PERPLEXITY_CATEGORIES.filter((c) => c.mode === 'perplexity').map((c) => c.tag)

  const scanned: Array<{ hotel: string; tag: string }> = []
  const errors: Array<{ hotel: string; tag: string; reason: string }> = []
  let skipped = 0

  // ── ADAY TOPLAMA: her (otel,kategori) icin en yeni created_at ──
  // Aday = hic taranmamis (created_at yok) VEYA yasi > staleHours.
  type Candidate = {
    hotelName: string
    client: SupabaseClient
    tag: string
    age: number // ms; hic taranmamis = Number.POSITIVE_INFINITY (en oncelikli)
  }
  const candidates: Candidate[] = []

  for (const hotel of hotelEntries) {
    let client: SupabaseClient | null = null
    try {
      client = await getHotelSupabase(hotel.id)
    } catch {
      continue // otel-bazli hata sira secimini bozmasin
    }
    if (!client) continue

    const hotelName = (hotel.name ?? hotel.slug ?? hotel.id) as string

    let rows: Array<{ interest_tag: string; created_at: string | null }> = []
    try {
      const { data } = await client
        .from('perplexity_discoveries')
        .select('interest_tag, created_at')
        .order('created_at', { ascending: false })
      rows = (data ?? []) as Array<{ interest_tag: string; created_at: string | null }>
    } catch {
      continue
    }

    // tag -> en yeni created_at (ms)
    const latestByTag = new Map<string, number>()
    for (const row of rows) {
      const tag = row.interest_tag
      if (!latestByTag.has(tag)) {
        latestByTag.set(tag, row.created_at ? new Date(row.created_at).getTime() : 0)
      }
    }

    for (const tag of ALL_TAGS) {
      if (latestByTag.has(tag)) {
        const age = now - (latestByTag.get(tag) as number)
        if (age > staleMs) {
          candidates.push({ hotelName, client, tag, age })
        }
      } else {
        candidates.push({ hotelName, client, tag, age: Number.POSITIVE_INFINITY })
      }
    }
  }

  // En bayattan sirala (buyuk age = daha oncelikli). Infinity-Infinity=NaN kacinilir.
  candidates.sort((a, b) => (a.age === b.age ? 0 : a.age > b.age ? -1 : 1))

  // ── ILK maxCalls ADAYI TARA (her biri KENDI try/catch'inde) ──
  for (const cand of candidates.slice(0, maxCalls)) {
    try {
      const { data: settings } = await cand.client
        .from('hotel_settings')
        .select('address')
        .limit(1)
        .maybeSingle()

      const address = settings?.address
      if (!address) {
        skipped++ // adres bossa hotel'i atla
        continue
      }

      const result = await queryPerplexity(cand.tag as InterestTag, address)
      const cat = getCategoryByTag(cand.tag)
      const queryText = cat ? cat.prompt_template.replace('{address}', address) : cand.tag
      // 30 gunluk TTL: gunluk piggyback tazelemesi altinda kayitlar surekli taze kalir
      const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()

      // delete-then-insert: bu otel+tag icin eski kaydi temizle, tek taze kayit kalsin
      await cand.client
        .from('perplexity_discoveries')
        .delete()
        .eq('interest_tag', cand.tag)

      const { error: insertError } = await cand.client
        .from('perplexity_discoveries')
        .insert({
          interest_tag: cand.tag,
          query_text: queryText,
          results: result.places,
          raw_response: result.raw_response,
          sources: result.sources,
          model_used: result.model_used,
          tokens_used: result.tokens_used,
          expires_at: expiresAt,
        })

      if (insertError) {
        errors.push({ hotel: cand.hotelName, tag: cand.tag, reason: insertError.message })
      } else {
        scanned.push({ hotel: cand.hotelName, tag: cand.tag })
      }
    } catch (e) {
      errors.push({ hotel: cand.hotelName, tag: cand.tag, reason: (e as Error).message })
    }
  }

  return { scanned, skipped, errors }
}
