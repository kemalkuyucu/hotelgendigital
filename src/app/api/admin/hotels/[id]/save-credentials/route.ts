import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'
import { encryptCredential } from '@/lib/encryption'
import { logAudit } from '@/lib/auth/audit'

// =============================================================================
// POST /api/admin/hotels/[id]/save-credentials
// Body: { url, anon, service_key }
// 3 değeri AES-256-GCM ile şifreler, bridge_credentials UPSERT yapar.
// is_healthy = false (migration henüz çalışmadı).
// Sadece super_admin rolü kullanabilir.
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden: super_admin required' }, { status: 403 })
  }

  const { id } = await params

  let body: { url?: string; anon?: string; service_key?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, anon, service_key } = body
  if (!url || !anon || !service_key) {
    return NextResponse.json({ ok: false, error: 'url, anon ve service_key gerekli' }, { status: 400 })
  }

  try {
    const [encUrl, encAnon, encServiceKey] = await Promise.all([
      encryptCredential(url),
      encryptCredential(anon),
      encryptCredential(service_key),
    ])

    const supabase = getCentralSupabase()

    const { error } = await supabase
      .from('bridge_credentials')
      .upsert(
        {
          hotel_id: id,
          supabase_url_encrypted: encUrl,
          supabase_anon_key_encrypted: encAnon,
          supabase_service_key_encrypted: encServiceKey,
          encryption_key_version: 1,
          is_healthy: false,
        },
        { onConflict: 'hotel_id' }
      )

    if (error) {
      console.error('[hotels-save-credentials]', error);
      return NextResponse.json({ ok: false, error: 'Kayıt hatası' }, { status: 500 })
    }

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'hotel.onboarding.credentials_saved',
      resourceType: 'bridge_credentials',
      hotelId: id,
      details: { url_domain: new URL(url).hostname },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: `Şifreleme hatası: ${errMsg}` }, { status: 500 })
  }
}
