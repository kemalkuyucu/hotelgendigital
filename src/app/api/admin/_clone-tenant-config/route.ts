import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSessionAdmin } from '@/lib/auth/session'
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug'
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// POST /api/admin/_clone-tenant-config
// GEÇİCİ / TEK SEFERLİK: Kaynak tenant'tan hedef tenant'a SADECE config/içerik
// tablolarını kopyalar. Misafir / konuşma / operasyon tablolarına DOKUNMAZ.
// Sadece super_admin kullanabilir.
// Env'ler Vercel ortamından otomatik gelir (CENTRAL_*, ENCRYPTION_MASTER_KEY).
// =============================================================================

const SOURCE: string = 'green-park-otel-demo'
const TARGET: string = 'regnum-hotels-belek'

const BATCH = 500

// Kopyalanacak tablolar — bu SIRADA (FK parent → child korunur):
//   hotel_documents        → document_chunks
//   technical_subcategories → technical_staff_subcategories
//   knowledge_documents    → knowledge_sections
const CONFIG_TABLES = [
  'hotel_settings',
  'hotel_facts',
  'departments',
  'department_staff',
  'technical_subcategories',
  'reservation_links',
  'perplexity_discoveries',
  'excel_column_mapping',
  'hotel_documents',
  'knowledge_documents',
  'document_chunks',
  'technical_staff_subcategories',
  'knowledge_sections',
] as const

// DOKUNULMAYANLAR (kod bunlara erişmez):
//   hotel_admin_users (Regnum admin'i zaten var) + tüm operasyonel tablolar:
//   conversations, bot_messages, ai_intents, forwarded_messages,
//   conversation_summary, customer_facts(_archive), guest_facts, requests,
//   sla_events, sla_violations, critical_word_escalations,
//   fb_room_service_orders, verification_attempts, inhouse_guests,
//   inhouse_guests_v2, inhouse_upload_history, inhouse_archive,
//   late_checkout_notifications, pending_guest_matches, allergic_guests,
//   guest_allergens, allergen_notification_log, lost_items, dnd_list,
//   knowledge_answers, schema_migrations

// ---------------------------------------------------------------------------
// Bir slug için service_role tenant client kur (bridge'ten decrypt ederek).
// ---------------------------------------------------------------------------
async function resolveTenantClient(slug: string): Promise<{
  client: SupabaseClient
  hotelId: string
  name: string
}> {
  const hotel = await getHotelBySlug(slug)
  if (!hotel) throw new Error(`Otel bulunamadı (slug=${slug})`)

  const bridge = await getDecryptedBridge(hotel.id)
  if (!bridge) throw new Error(`Bridge credentials bulunamadı (slug=${slug}, id=${hotel.id})`)

  const client = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return { client, hotelId: hotel.id, name: hotel.name }
}

// ---------------------------------------------------------------------------
// Tek bir tabloyu kaynaktan hedefe kopyala.
//   - Kaynaktan SELECT * (tüm satırlar).
//   - Hedefe id'ler dahil upsert (onConflict: 'id'); hedef TEMİZLENMEZ.
//   - Döner: kopyalanan satır sayısı.
// ---------------------------------------------------------------------------
async function copyTable(
  source: SupabaseClient,
  target: SupabaseClient,
  table: string
): Promise<number> {
  const { data: rows, error: selErr } = await source.from(table).select('*')
  if (selErr) throw new Error(`SELECT hatası [${table}]: ${selErr.message}`)

  const all = rows ?? []
  if (all.length === 0) return 0

  let written = 0
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH)
    const { error: upErr } = await target.from(table).upsert(chunk, { onConflict: 'id' })
    if (upErr) {
      throw new Error(`UPSERT hatası [${table}] (batch ${i}-${i + chunk.length}): ${upErr.message}`)
    }
    written += chunk.length
  }

  return written
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST() {
  // --- Yetki kontrolü: sadece super_admin (diğer /api/admin route'larıyla aynı) ---
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden: super_admin required' }, { status: 403 })
  }

  if (SOURCE === TARGET) {
    return NextResponse.json({ ok: false, error: 'SOURCE ve TARGET aynı olamaz' }, { status: 400 })
  }

  try {
    const src = await resolveTenantClient(SOURCE)
    const tgt = await resolveTenantClient(TARGET)

    if (src.hotelId === tgt.hotelId) {
      return NextResponse.json(
        { ok: false, error: 'Kaynak ve hedef aynı otel (aynı hotelId)' },
        { status: 400 }
      )
    }

    const results: { table: string; copied: number | null; error?: string }[] = []

    for (const table of CONFIG_TABLES) {
      try {
        const n = await copyTable(src.client, tgt.client, table)
        results.push({ table, copied: n })
      } catch (e) {
        results.push({ table, copied: null, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const totalRows = results.reduce((acc, r) => acc + (r.copied ?? 0), 0)
    const errors = results.filter((r) => r.copied === null)

    return NextResponse.json({
      ok: errors.length === 0,
      source: { slug: SOURCE, name: src.name },
      target: { slug: TARGET, name: tgt.name },
      tables: results,
      total_rows: totalRows,
      table_count: results.length,
      error_count: errors.length,
      errors: errors.map((e) => ({ table: e.table, error: e.error })),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
