import { NextRequest, NextResponse } from 'next/server'
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import { invalidateSummary } from '@/lib/knowledge/cache'

// ── Legacy Turkish → English fact_key normalization map ──────────────────────
// Eski Türkçe anahtar adlarını şablon sistemiyle (factTemplates.ts) uyumlu
// İngilizce anahtarlara dönüştürür. GET sırasında uygulanır; DB'ye dokunmaz.
const LEGACY_KEY_MAP: Record<string, string> = {
  otel_adi:               'hotel_name',
  otel_telefonu:          'hotel_phone',
  otel_email:             'hotel_email',
  otel_adresi:            'hotel_address',
  giris_saati:            'check_in_time',
  cikis_saati:            'check_out_time',
  pansiyon_konsepti:      'concept_type',
  kahvalti_baslangic:     'breakfast_start',
  kahvalti_bitis:         'breakfast_end',
  havuz_acilis:           'pool_open',
  havuz_kapanis:          'pool_close',
  plaj_acilis:            'beach_open',
  plaj_kapanis:           'beach_close',
  wifi_ssid:              'wifi_ssid',
  wifi_sifre:             'wifi_password',
  wifi_sifresi:           'wifi_password',
  oda_servisi_saatleri:   'room_service_hours',
  oda_servisi_ucretli_mi: 'room_service_paid',
}

function normalizeFactKey(key: string): string {
  return LEGACY_KEY_MAP[key] ?? key
}

// ── GET /api/manager/knowledge ────────────────────────────────────────────────
export async function GET() {
  try {
    const manager = await getManagerOrHotelAdmin()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = manager.hotel_slug
      ? (await resolveTenantBySlug(manager.hotel_slug)).hotelSupabase
      : getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('hotel_facts')
      .select('id, fact_key, fact_label, fact_value, category, is_active, display_order, created_at, updated_at')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[knowledge GET] query error:', error)
      return NextResponse.json(
        { error: 'Bilgi tabanı getirilemedi', detail: error.message },
        { status: 500 }
      )
    }

    // Normalize legacy Turkish keys → English so mergeFactsWithTemplates() matches correctly.
    // Duplicate resolution in TWO passes, so a demoted row NEVER collides in the panel's dbMap
    // (which is keyed by fact_key). Losers are not dropped — they are returned so the panel still
    // renders them (silent-swallow guard: a masked row still reaches the bot via fetchKnowledgeFacts,
    // so the manager must be able to see and delete it).
    //   Pass 1 — canonical rows (fact_key already === its normalized key) claim the normalized slot
    //     FIRST; latest updated_at wins, any same-key duplicate loses with its raw key.
    //   Pass 2 — legacy Turkish-alias rows (raw !== normalized): they take the slot only if it is
    //     still free; if a canonical row already holds it the alias ALWAYS loses (canonical wins,
    //     regardless of updated_at); two aliases contesting one slot → latest updated_at wins.
    // Because a loser is only ever a Turkish-alias row (or an alias beaten by another alias), it
    // keeps a raw TR fact_key that is never a template key → it falls to the 'custom' branch, so a
    // loser's key can never equal the winner's canonical key → dbMap collision is impossible.
    type FactRow = NonNullable<typeof data>[number]
    const rows = data ?? []
    const seen = new Map<string, FactRow>()   // normalizedKey → winning row
    const losers: FactRow[] = []              // displaced rows, RAW fact_key kept

    // Pass 1 — canonical (already-English) rows.
    for (const row of rows) {
      if (row.fact_key !== normalizeFactKey(row.fact_key)) continue
      const existing = seen.get(row.fact_key)
      if (!existing) {
        seen.set(row.fact_key, row)
      } else if (row.updated_at > existing.updated_at) {
        losers.push(existing)
        seen.set(row.fact_key, row)
      } else {
        losers.push(row)
      }
    }

    // Pass 2 — legacy Turkish-alias rows.
    for (const row of rows) {
      const normalizedKey = normalizeFactKey(row.fact_key)
      if (row.fact_key === normalizedKey) continue
      const existing = seen.get(normalizedKey)
      if (!existing) {
        seen.set(normalizedKey, row)                 // free slot → alias wins the canonical key
      } else if (existing.fact_key === normalizedKey) {
        losers.push(row)                             // slot held by a canonical row → alias always loses
      } else if (row.updated_at > existing.updated_at) {
        losers.push(existing)                        // two aliases: latest wins
        seen.set(normalizedKey, row)
      } else {
        losers.push(row)
      }
    }

    const winners = Array.from(seen.entries()).map(([normalizedKey, row]) => ({
      ...row,
      fact_key: normalizedKey,
    }))

    return NextResponse.json({ facts: [...winners, ...losers] }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge GET] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi tabanı getirilemedi', detail: message },
      { status: 500 }
    )
  }
}

// ── POST /api/manager/knowledge ───────────────────────────────────────────────
// UPSERT: aynı fact_key zaten varsa güncelle, yoksa ekle.
export async function POST(req: NextRequest) {
  try {
    const manager = await getManagerOrHotelAdmin()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fact_key, fact_label, fact_value, category, is_active, display_order: bodyOrder } = body

    // Basic validation
    if (!fact_key || !fact_label || !fact_value) {
      return NextResponse.json(
        { error: 'fact_key, fact_label ve fact_value zorunludur' },
        { status: 400 }
      )
    }

    const normalizedKey = fact_key.trim().toLowerCase()

    const tenant = manager.hotel_slug ? await resolveTenantBySlug(manager.hotel_slug) : null
    const supabase = tenant ? tenant.hotelSupabase : getDemoHotelSupabase()

    // ── Check if a row with this fact_key already exists (UPSERT logic) ──────
    // Includes legacy Turkish aliases so saving 'hotel_name' also finds 'otel_adi'.
    const legacyKeys = Object.entries(LEGACY_KEY_MAP)
      .filter(([, eng]) => eng === normalizedKey)
      .map(([tr]) => tr)
    const keysToCheck = [normalizedKey, ...legacyKeys]

    const { data: existing } = await supabase
      .from('hotel_facts')
      .select('id, display_order')
      .in('fact_key', keysToCheck)
      // If multiple duplicates exist (bug), grab the latest one
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // UPDATE the existing row
      const { data, error } = await supabase
        .from('hotel_facts')
        .update({
          fact_key:  normalizedKey,          // normalize key if it was Turkish
          fact_label: fact_label.trim(),
          fact_value: fact_value.trim(),
          category:  category ?? 'general',
          is_active: is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[knowledge POST/upsert update] error:', error)
        return NextResponse.json(
          { error: 'Bilgi güncellenemedi', detail: error.message },
          { status: 500 }
        )
      }

      // CLAUDE.md: her knowledge CRUD sonrasi bot bayat bilgi dondurmesin diye cache iptal
      if (tenant) invalidateSummary(tenant.hotelId)
      return NextResponse.json({ fact: data }, { status: 200 })
    }

    // ── INSERT new row ────────────────────────────────────────────────────────
    // Calculate next display_order only when inserting
    let nextOrder = typeof bodyOrder === 'number' ? bodyOrder : undefined
    if (nextOrder === undefined) {
      const { data: maxRow } = await supabase
        .from('hotel_facts')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextOrder = (maxRow?.display_order ?? -1) + 1
    }

    const { data, error } = await supabase
      .from('hotel_facts')
      .insert({
        fact_key:      normalizedKey,
        fact_label:    fact_label.trim(),
        fact_value:    fact_value.trim(),
        category:      category ?? 'general',
        is_active:     is_active ?? true,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('[knowledge POST] insert error:', error)
      return NextResponse.json(
        { error: 'Bilgi eklenemedi', detail: error.message },
        { status: 500 }
      )
    }

    // CLAUDE.md: her knowledge CRUD sonrasi bot bayat bilgi dondurmesin diye cache iptal
    if (tenant) invalidateSummary(tenant.hotelId)
    return NextResponse.json({ fact: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge POST] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi eklenemedi', detail: message },
      { status: 500 }
    )
  }
}
