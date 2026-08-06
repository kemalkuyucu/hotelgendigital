import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase, getDemoHotelSupabase } from '@/lib/supabase-client'
import { runSlaCheck } from '@/lib/sla/check-runner'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Authorization kontrolü — Bearer token ile güvenli erişim
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
    return NextResponse.json({ ok: true, processed: 0, results: [] })
  }

  const hotelEntries = hotels.map((h) => ({
    id: h.id as string,
    slug: (h.slug ?? h.name) as string,
    status: h.status as string,
  }))

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

  let results: { hotelSlug: string; eventId: string; action: string }[] = []
  try {
    results = await runSlaCheck(hotelEntries, getHotelSupabase)
  } catch (err) {
    console.error('[run-sla-check] error:', err)
    return NextResponse.json({ error: 'SLA check failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
