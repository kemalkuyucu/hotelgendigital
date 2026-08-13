import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'
import { logAudit } from '@/lib/auth/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/hotels/[id]/purge-hold  — OTOMATIK kalici silmeyi duraklat/devam ettir.
 * Body: { hold: boolean }
 *
 * NEDEN VAR: `purge_hold` bugune kadar yalniz SQL ile cevrilebiliyordu, Central
 * kimlikleri ise SADECE prod'da duruyor -> "su oteli simdilik silmeyin" demek
 * icin SQL Editor acmak gerekiyordu. Geri sayimi durdurmanin panelden mumkun
 * olmasi, geri alinamaz silmenin ONUNDEKI tek acil-durum frenidir.
 *
 * YETKI: delete / restore / purge route'lariyla AYNI desen — `getSessionAdmin`
 * + `role === 'super_admin'`. Kendi kontrolu YAZMAZ.
 *
 * `confirmSlug` ISTENMEZ (purge route'unun aksine): bu islem GERI ALINABILIR —
 * yanlis satira basan admin ayni dugmeye tekrar basar. §3-30g'nin slug kapisi
 * GERI ALINAMAZ islemler icindir; her dugmeye yayilirsa acil-durum freni
 * kullanilmaz hale gelir.
 *
 * KAPSAM: yalniz SOFT-DELETE EDILMIS otel. Silinmemis otelde purge zaten
 * kosmaz; orada bayrak cevirmek "korunuyor" yanilsamasi uretirdi.
 */
export async function PATCH(
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

  let hold: boolean
  try {
    const body = (await request.json()) as { hold?: unknown }
    if (typeof body.hold !== 'boolean') {
      return NextResponse.json({ error: 'hold alanı true/false olmalı' }, { status: 400 })
    }
    hold = body.hold
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const supabase = getCentralSupabase()
  const { data: hotel, error: fetchError } = await supabase
    .from('hotels')
    .select('id, name, slug, deleted_at, purge_hold')
    .eq('id', hotelId)
    .maybeSingle()

  if (fetchError) {
    // Detay yalniz server log'una; istemciye sabit metin.
    console.error('[purge-hold] select hatasi:', fetchError.code, fetchError.message)
    return NextResponse.json({ error: 'Otel bilgisi okunamadı' }, { status: 500 })
  }
  if (!hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı' }, { status: 404 })
  }
  if (!hotel.deleted_at) {
    return NextResponse.json(
      { error: 'Otel silinmiş değil (otomatik kalıcı silme zaten çalışmaz)' },
      { status: 409 },
    )
  }

  const { error: updateError } = await supabase
    .from('hotels')
    .update({ purge_hold: hold })
    .eq('id', hotelId)

  if (updateError) {
    console.error('[purge-hold] update hatasi:', updateError.code, updateError.message)
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 })
  }

  await logAudit({
    actorId: admin.id as string,
    actorUsername: admin.username as string,
    action: hold ? 'hotel.purge_hold.on' : 'hotel.purge_hold.off',
    resourceType: 'hotel',
    resourceId: hotelId,
    hotelId,
    details: {
      hotel_slug: hotel.slug,
      hotel_name: hotel.name,
      deleted_at: hotel.deleted_at,
      purge_hold: hold,
    },
    ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
  })

  console.log('[purge-hold] slug=%s hold=%s actor=%s', hotel.slug, hold, admin.username)
  return NextResponse.json({ success: true, purge_hold: hold })
}
