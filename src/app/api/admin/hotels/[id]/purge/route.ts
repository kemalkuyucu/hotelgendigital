import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'
import { purgeHotel } from '@/lib/hotels/purge-hotel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/hotels/[id]/purge  — KALICI SILME (geri alinamaz).
 * Body: { confirmSlug: string }
 *
 * IKI KAPI (25.otu kurali — URL'deki tanimlayici SALDIRGAN GIRDISIDIR):
 *   1. ROL: yalniz super_admin (delete/restore ile AYNI desen).
 *   2. KIMLIK: URL'deki [id] ile govdedeki confirmSlug AYNI oteli gostermek
 *      ZORUNDA. Kullanici modalda slug'i ELLE yazar; boylece "yanlis satira
 *      tikladim" hatasi silmeye donusemez.
 *
 * Silme mantigi BURADA DEGIL: tek kaynak src/lib/hotels/purge-hotel.ts
 * (cron ile ayni sira, ayni mezar tasi, ayni denetim kaydi).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Bu işlem sadece süper admin yetkisi gerektirir' }, { status: 403 })
  }

  const { id: hotelId } = await params

  let confirmSlug = ''
  try {
    const body = (await request.json()) as { confirmSlug?: unknown }
    confirmSlug = typeof body.confirmSlug === 'string' ? body.confirmSlug.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const supabase = getCentralSupabase()
  const { data: hotel, error: fetchError } = await supabase
    .from('hotels')
    .select('id, slug, deleted_at')
    .eq('id', hotelId)
    .maybeSingle()

  if (fetchError) {
    console.error('[hotel-purge] route select hatasi:', fetchError.code, fetchError.message)
    return NextResponse.json({ error: 'Otel bilgisi okunamadı' }, { status: 500 })
  }
  if (!hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı' }, { status: 404 })
  }
  if (confirmSlug !== hotel.slug) {
    return NextResponse.json({ error: 'Onay metni otel slug ile eşleşmiyor' }, { status: 400 })
  }
  if (!hotel.deleted_at) {
    return NextResponse.json(
      { error: 'Önce otel silinmeli (Silinmiş sekmesinde olmayan otel kalıcı silinemez)' },
      { status: 409 },
    )
  }

  const result = await purgeHotel({
    slug: hotel.slug as string,
    mode: 'manual',
    actor: admin.username,
    now: new Date(),
  })

  if (!result.ok) {
    // Detay (adim/kod) server log'unda; istemciye sabit metin.
    const message =
      result.reason === 'not_found'
        ? 'Otel bulunamadı'
        : result.reason === 'not_deleted'
          ? 'Otel önce silinmiş olmalı'
          : 'Kalıcı silme başarısız — işlem yarım kalmış olabilir, sunucu kaydını kontrol edin'
    const status = result.reason === 'not_found' ? 404 : result.reason === 'not_deleted' ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
