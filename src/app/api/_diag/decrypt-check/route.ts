import { NextResponse } from 'next/server'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials'

// =============================================================================
// GECICI TESHIS ROUTE — silinecek (hotelgen-v4)
// GET /api/_diag/decrypt-check
// regnum-hotels-belek icin bridge_credentials decrypt edilince supabaseUrl ne
// cikiyor GORMEK icin. Ham URL veya key ASLA response'a girmez; sadece
// length / first8 / startsWithHttps + ENCRYPTION_MASTER_KEY durumu doner.
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLUG = 'regnum-hotels-belek'

export async function GET() {
  const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY ? 'SET' : 'MISSING'

  try {
    // getDecryptedBridge hotel_id (UUID) bekliyor; once slug -> id coz
    const central = getCentralSupabase()
    const { data: hotel } = await central
      .from('hotels')
      .select('id')
      .eq('slug', SLUG)
      .maybeSingle()

    if (!hotel?.id) {
      return NextResponse.json({
        ok: false,
        stage: 'resolve-slug',
        hotelFound: false,
        encryptionMasterKey,
      })
    }

    const bridge = await getDecryptedBridge(hotel.id)

    if (!bridge) {
      return NextResponse.json({
        ok: false,
        stage: 'decrypt',
        bridgeFound: false,
        encryptionMasterKey,
      })
    }

    const url = bridge.supabaseUrl ?? ''
    return NextResponse.json({
      ok: true,
      encryptionMasterKey,
      supabaseUrl: {
        length: url.length,
        first8: url.slice(0, 8),
        startsWithHttps: url.startsWith('https://'),
      },
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'exception',
      encryptionMasterKey,
      error: (e as Error).message,
    })
  }
}
