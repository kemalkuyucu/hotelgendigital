// PATCH /api/admin/hotel-users/[userId]/status
// Modül 22 Adım 2 — Aktif/Pasif değiştirme
// HARD DELETE YOK — sadece is_active toggle (arşiv mantığı).

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (admin.role !== 'super_admin') return NextResponse.json({ error: 'Yalnızca super_admin.' }, { status: 403 });

  const { userId } = await params;

  let body: { hotelId?: string; isActive?: boolean };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const { hotelId, isActive } = body;
  if (!hotelId || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'hotelId ve isActive (boolean) zorunludur.' }, { status: 400 });
  }

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { error } = await hotelSupabase
      .from('hotel_admin_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[hotel-users status] update error:', error);
      return NextResponse.json({ error: 'Durum güncellenemedi' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hotel-users status] bridge error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
