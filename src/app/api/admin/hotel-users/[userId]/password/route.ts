// PATCH /api/admin/hotel-users/[userId]/password
// Modül 22 Adım 2 — Şifre sıfırlama (bcrypt cost=12)
// Plain text ASLA loglanmaz, sadece hash saklanır.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (admin.role !== 'super_admin') return NextResponse.json({ error: 'Yalnızca super_admin.' }, { status: 403 });

  const { userId } = await params;

  let body: { hotelId?: string; newPassword?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const { hotelId, newPassword } = body;
  if (!hotelId || !newPassword) {
    return NextResponse.json({ error: 'hotelId ve newPassword zorunludur.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Şifre en az 8 karakter olmalıdır.' }, { status: 400 });
  }

  // Hash — cost 12
  const passwordHash = await bcrypt.hash(newPassword, 12);

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { error } = await hotelSupabase
      .from('hotel_admin_users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[hotel-users password] update error:', error);
      return NextResponse.json({ error: 'Şifre güncellenemedi' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hotel-users password] bridge error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
