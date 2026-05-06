import { NextRequest, NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { testBridge } from '@/lib/tenant/test-bridge'

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
    .select('id, name')
    .eq('status', 'active')

  if (!hotels || hotels.length === 0) {
    return NextResponse.json({ ok: true, total: 0, results: [] })
  }

  const results = await Promise.allSettled(hotels.map((h) => testBridge(h.id)))
  const summary = results.map((r, i) => ({
    hotel: hotels[i].name,
    hotelId: hotels[i].id,
    ok: r.status === 'fulfilled' && r.value.ok,
    message: r.status === 'fulfilled' ? r.value.message : 'Beklenmeyen hata',
    latencyMs: r.status === 'fulfilled' ? r.value.latencyMs : 0,
  }))

  const healthyCount = summary.filter((s) => s.ok).length

  return NextResponse.json({
    ok: true,
    total: hotels.length,
    healthy: healthyCount,
    unhealthy: hotels.length - healthyCount,
    results: summary,
    checkedAt: new Date().toISOString(),
  })
}
