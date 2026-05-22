// PATCH /api/admin/hotel-users/[userId]/role
// Modül 22 Adım 2 — Rol değiştirme

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';

export const dynamic = 'force-dynamic';

const VALID_ROLES = [
  'hotel_owner',
  'front_office_manager',
  'housekeeping_manager',
  'technical_manager',
  'fb_manager',
  'guest_relation_manager',
  'spa_manager',
  'animation_manager',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (admin.role !== 'super_admin') return NextResponse.json({ error: 'Yalnızca super_admin.' }, { status: 403 });

  const { userId } = await params;

  let body: { hotelId?: string; role?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const { hotelId, role } = body;
  if (!hotelId || !role) {
    return NextResponse.json({ error: 'hotelId ve role zorunludur.' }, { status: 400 });
  }
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: `Geçersiz rol: ${role}` }, { status: 400 });
  }

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { error } = await hotelSupabase
      .from('hotel_admin_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[hotel-users role] update error:', error);
      return NextResponse.json({ error: 'Rol güncellenemedi: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    console.error('[hotel-users role] bridge error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
