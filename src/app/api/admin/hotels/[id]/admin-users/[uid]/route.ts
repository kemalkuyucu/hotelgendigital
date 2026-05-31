// PATCH  /api/admin/hotels/[id]/admin-users/[uid]  → şifre sıfırla / update
// DELETE /api/admin/hotels/[id]/admin-users/[uid]  → soft delete

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/auth/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> }
): Promise<NextResponse> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  const { id: hotelId, uid } = await params;

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof b.full_name === 'string') updateData.full_name = b.full_name;
    if (typeof b.role === 'string') updateData.role = b.role;
    if (typeof b.is_active === 'boolean') updateData.is_active = b.is_active;

    // Şifre sıfırlama
    if (typeof b.password === 'string' && b.password.length > 0) {
      updateData.password_hash = await bcrypt.hash(b.password as string, 12);
    }

    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .update(updateData)
      .eq('id', uid)
      .select('id, username, full_name, role, is_active, last_login_at, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    await logAudit({
      actorId: admin.id as string,
      actorUsername: admin.username as string,
      action: 'hotel_admin_user.update',
      resourceType: 'hotel_admin_users',
      resourceId: uid,
      hotelId,
      details: { fields: Object.keys(updateData).filter((k) => k !== 'updated_at') },
    }).catch(() => {});

    return NextResponse.json({ user: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> }
): Promise<NextResponse> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  const { id: hotelId, uid } = await params;

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { error } = await hotelSupabase
      .from('hotel_admin_users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', uid);

    if (error) throw new Error(error.message);

    await logAudit({
      actorId: admin.id as string,
      actorUsername: admin.username as string,
      action: 'hotel_admin_user.delete',
      resourceType: 'hotel_admin_users',
      resourceId: uid,
      hotelId,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
