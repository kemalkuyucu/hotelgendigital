import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { testBridgeWithTelegram } from '@/lib/tenant/test-bridge'
import { logAudit } from '@/lib/auth/audit'
import { clearHotelClientCache } from '@/lib/tenant/get-hotel-client'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  // Önbelleği temizle ki yeni credential'lar varsa onları kullansın
  clearHotelClientCache(id)
  // testBridgeWithTelegram: Supabase + Telegram getMe doğrulaması
  const result = await testBridgeWithTelegram(id)

  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'bridge.test',
    resourceType: 'bridge_credentials',
    hotelId: id,
    details: { ok: result.ok, latencyMs: result.latencyMs, message: result.message },
  })

  return NextResponse.json(result)
}
