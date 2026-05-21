import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// POST /api/admin/hotels/[id]/test-connection
// Body: { url, anon, service_key }
// Body'den gelen credentials ile canlı bağlantı testi yapar.
// Veritabanına KAYDETMEZ — pure test.
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

  const t0 = Date.now()

  try {
    // URL format doğrulama
    const parsedUrl = new URL(url)
    if (!parsedUrl.hostname.includes('supabase')) {
      return NextResponse.json({
        ok: false,
        error: 'URL geçerli bir Supabase project URL\'si değil',
      })
    }

    // Service role key ile geçici client oluştur
    const testClient = createClient(url, service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Basit bir sistem sorgusu — information_schema.tables üzerinden
    const { error } = await testClient
      .from('schema_migrations')
      .select('version')
      .limit(1)

    const latencyMs = Date.now() - t0

    // schema_migrations yoksa da tamam — bağlantı kuruldu demek
    if (error && error.code !== 'PGRST116' && error.message?.includes('does not exist') === false) {
      // Gerçek bağlantı hatası
      if (
        error.message?.toLowerCase().includes('fetch') ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('invalid api key') ||
        error.message?.toLowerCase().includes('jwt') ||
        error.code === 'PGRST301'
      ) {
        return NextResponse.json({
          ok: false,
          error: `Bağlantı hatası: ${error.message}`,
          latencyMs,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Bağlantı başarılı (${latencyMs}ms)`,
      latencyMs,
      hotelId: id,
    })
  } catch (e) {
    const latencyMs = Date.now() - t0
    const errMsg = e instanceof Error ? e.message : String(e)

    // URL geçersizse
    if (errMsg.includes('Invalid URL') || errMsg.includes('Failed to construct')) {
      return NextResponse.json({ ok: false, error: 'Geçersiz Supabase URL formatı', latencyMs })
    }

    return NextResponse.json({
      ok: false,
      error: `Bağlantı testi başarısız: ${errMsg}`,
      latencyMs,
    })
  }
}
