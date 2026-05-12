import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase, getDemoHotelSupabase } from '@/lib/supabase-client'
import { runSlaCheck } from '@/lib/sla/check-runner'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * GET /api/admin/run-sla-check
 *
 * Manuel SLA scan endpoint. Demo testlerinde curl veya tarayıcıdan
 * tetiklemek için kullanılır. Production'da health-check cron'u
 * saatte bir otomatik çalıştırır.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Response: { processed: N, results: [...] }
 */
export async function GET(req: NextRequest) {
  // ── Auth kontrolü ────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Aktif otelleri çek ────────────────────────────────────────────────────
  const supabase = getCentralSupabase()
  const { data: hotels, error: hotelsError } = await supabase
    .from('hotels')
    .select('id, name, slug, status')
    .eq('status', 'active')

  if (hotelsError) {
    console.error('[run-sla-check] hotels fetch error:', hotelsError)
    return NextResponse.json(
      { error: 'Failed to fetch hotels', detail: hotelsError.message },
      { status: 500 },
    )
  }

  if (!hotels || hotels.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  // ── Hotel-specific Supabase client resolver ───────────────────────────────
  const getHotelSupabase = async (hotelId: string): Promise<SupabaseClient | null> => {
    if (hotelId === process.env.DEMO_HOTEL_ID) {
      try {
        return getDemoHotelSupabase()
      } catch {
        return null
      }
    }
    try {
      const { getHotelClient } = await import('@/lib/tenant/get-hotel-client')
      return await getHotelClient(hotelId)
    } catch {
      return null
    }
  }

  // ── SLA check çalıştır ────────────────────────────────────────────────────
  const hotelEntries = hotels.map((h) => ({
    id: h.id as string,
    slug: (h.slug ?? h.name) as string,
    status: h.status as string,
  }))

  let slaResults: { hotelSlug: string; eventId: string; action: string }[] = []
  try {
    slaResults = await runSlaCheck(hotelEntries, getHotelSupabase)
  } catch (err) {
    console.error('[run-sla-check] runSlaCheck error:', err)
    return NextResponse.json(
      { error: 'SLA check failed', detail: String(err) },
      { status: 500 },
    )
  }

  console.log(`[run-sla-check] Manual trigger: processed ${slaResults.length} events`)

  return NextResponse.json({
    processed: slaResults.length,
    results: slaResults,
    ranAt: new Date().toISOString(),
    hotels: hotelEntries.map((h) => h.slug),
  })
}
