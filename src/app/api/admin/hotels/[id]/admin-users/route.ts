// GET  /api/admin/hotels/[id]/admin-users   → list
// POST /api/admin/hotels/[id]/admin-users   → create

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/auth/audit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id: hotelId } = await params;

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .select('id, username, full_name, role, is_active, last_login_at, created_at, updated_at')
      .order('created_at');

    if (error) throw new Error(error.message);
    return NextResponse.json({ users: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id: hotelId } = await params;

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    if (
      typeof b.username !== 'string' ||
      typeof b.full_name !== 'string' ||
      typeof b.role !== 'string' ||
      typeof b.password !== 'string'
    ) {
      return NextResponse.json(
        { error: 'username, full_name, role ve password zorunludur.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(b.password as string, 10);

    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .insert({
        username: b.username,
        password_hash: passwordHash,
        full_name: b.full_name,
        role: b.role,
      })
      .select('id, username, full_name, role, is_active, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' }, { status: 409 });
      }
      throw new Error(error.message);
    }

    await logAudit({
      actorId: admin.id as string,
      actorUsername: admin.username as string,
      action: 'hotel_admin_user.create',
      resourceType: 'hotel_admin_users',
      resourceId: (data as Record<string, unknown>).id as string,
      hotelId,
      details: { username: b.username, role: b.role },
    }).catch(() => {});

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
