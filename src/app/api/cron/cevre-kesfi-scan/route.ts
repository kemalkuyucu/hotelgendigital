import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runCevreKesfiScan } from '@/lib/perplexity/cevre-scan-runner'

// Tek otel + tek kategori/tetik ~6sn surer; 300 fazlasiyla yeterli (guvenli ust sinir)
export const maxDuration = 300

/**
 * Cevre Kesfi otomatik tarama cron'u — ADIM A4 (kategori-bazli round-robin)
 * cron-job.org SAATLIK tetikler. Cekirdek mantik runCevreKesfiScan'a tasindi
 * (health-check piggyback ile paylasilir). Bu route en fazla maxCalls kadar
 * (otel,kategori) ciftini tarar.
 * Repo deseni korunur: sirali await, waitUntil/fire-and-forget YOK.
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

  const summary = await runCevreKesfiScan(hotels, getHotelSupabase, { maxCalls: 10 })
  return NextResponse.json({ ok: true, total: hotels.length, ...summary, checkedAt: new Date().toISOString() })
}
