import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { testBridge } from '@/lib/tenant/test-bridge'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import { runSlaCheck } from '@/lib/sla/check-runner'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Cron secret kontrolü
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

  // ── Health check ──────────────────────────────────────────────────────────
  const results = await Promise.allSettled(hotels.map((h) => testBridge(h.id)))
  const summary = results.map((r, i) => ({
    hotel: hotels[i].name,
    hotelId: hotels[i].id,
    ok: r.status === 'fulfilled' && r.value.ok,
    message: r.status === 'fulfilled' ? r.value.message : 'Beklenmeyen hata',
    latencyMs: r.status === 'fulfilled' ? r.value.latencyMs : 0,
  }))

  const healthyCount = summary.filter((s) => s.ok).length

  // ── Modül 11: SLA Check (her dakika) ─────────────────────────────────────
  // Demo hotel için doğrudan getDemoHotelSupabase; diğerleri için bridge.
  // Bu yaklaşım Vercel Hobby plan cron limitini (2) aşmadan SLA scan yapar.
  let slaResults: { hotelSlug: string; eventId: string; action: string }[] = []
  try {
    const hotelEntries = hotels.map((h) => ({
      id: h.id as string,
      slug: (h.slug ?? h.name) as string,
      status: h.status as string,
    }))

    const getHotelSupabase = async (hotelId: string): Promise<SupabaseClient | null> => {
      // Demo hotel: doğrudan env'den
      if (hotelId === process.env.DEMO_HOTEL_ID) {
        try { return getDemoHotelSupabase() } catch { return null }
      }
      // Diğer oteller: bridge üzerinden (production)
      try {
        const { getHotelClient } = await import('@/lib/tenant/get-hotel-client')
        return await getHotelClient(hotelId)
      } catch {
        return null
      }
    }

    slaResults = await runSlaCheck(hotelEntries, getHotelSupabase)
  } catch (slaErr) {
    console.error('[health-check] SLA check error:', slaErr)
  }

  return NextResponse.json({
    ok: true,
    total: hotels.length,
    healthy: healthyCount,
    unhealthy: hotels.length - healthyCount,
    results: summary,
    checkedAt: new Date().toISOString(),
    sla: {
      processed: slaResults.length,
      results: slaResults,
    },
  })
}
