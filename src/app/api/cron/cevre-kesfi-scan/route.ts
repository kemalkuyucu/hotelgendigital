import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cevre Kesfi otomatik tarama cron'u — ADIM A1 (ISKELET, davranis yok)
 * cron-job.org Mon+Fri tetikler. Bu adimda Perplexity CAGRISI YOK, INSERT YOK.
 * Sadece: auth + central'dan aktif oteller + her otele baglan + adresi oku + RAPOR.
 * queryPerplexity ve insert ADIM A2'de eklenecek.
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

  // health-check ile ayni tenant baglanti desenı
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

  const results: Array<{ hotel: string; connected: boolean; hasAddress: boolean }> = []

  for (const hotel of hotels) {
    let connected = false
    let hasAddress = false
    try {
      const client = await getHotelSupabase(hotel.id as string)
      if (client) {
        connected = true
        const { data: settings } = await client
          .from('hotel_settings')
          .select('address')
          .limit(1)
          .maybeSingle()
        hasAddress = Boolean(settings?.address)
      }
    } catch {
      // otel-bazli hata digerlerini bozmasin
    }
    results.push({ hotel: hotel.name as string, connected, hasAddress })
  }

  return NextResponse.json({
    ok: true,
    step: 'A1-skeleton',
    total: hotels.length,
    results,
    checkedAt: new Date().toISOString(),
  })
}
