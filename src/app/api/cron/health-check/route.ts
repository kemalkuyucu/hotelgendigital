import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { testBridge } from '@/lib/tenant/test-bridge'
import { getDemoHotelSupabase } from '@/lib/supabase-client'
import { runSlaCheck } from '@/lib/sla/check-runner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runDeptChatHealthCheck } from '@/lib/telegram/dept-chat-health';
import { runWebhookHealthCheck } from '@/lib/telegram/webhook-health';
import { runCevreKesfiScan } from '@/lib/perplexity/cevre-scan-runner'

export const maxDuration = 60

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
  let deptChatResults = { checked: 0, invalid: 0, details: [] as Array<{ hotel: string; code: string; chatId: string }> }
  let webhookResults = { checked: 0, repaired: 0, failed: 0, details: [] as Array<{ hotel: string; action: string; reason: string }> }
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

    // Dept chat_id sağlık kontrolü — getHotelSupabase aynı scope'ta yeniden kullanılır.
    try {
      const deptHotelEntries = hotels.map((h) => ({
        id: h.id as string,
        name: h.name as string,
        slug: (h.slug ?? h.name) as string,
      }))
      deptChatResults = await runDeptChatHealthCheck(deptHotelEntries, getHotelSupabase)
    } catch (deptErr) {
      console.error('[health-check] dept chat_id check error:', deptErr)
    }

    // Webhook saglik kontrolu + otomatik onarim
    try {
      const webhookHotelEntries = hotels.map((h) => ({
        id: h.id as string,
        name: h.name as string,
        slug: (h.slug ?? h.name) as string,
      }))
      webhookResults = await runWebhookHealthCheck(webhookHotelEntries)
    } catch (whErr) {
      console.error('[health-check] webhook check error:', whErr)
    }

    // Cevre Kesfi piggyback — SLA'dan SONRA, kendi try/catch'inde (SLA'yi ETKILEMEZ)
    try {
      await runCevreKesfiScan(hotelEntries, getHotelSupabase, { maxCalls: 3 })
    } catch (e) {
      console.warn('[cevre] piggyback skipped', e)
    }
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
    deptChat: deptChatResults,
    webhook: webhookResults,
  })
}
