// PATCH /api/hotel-admin/staff/[sid]
// DELETE /api/hotel-admin/staff/[sid]

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { upsertStaff, deleteStaff, listStaff } from '@/lib/hotel-admin/staff-client';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import type { StaffInput } from '@/lib/hotel-admin/types';
import { logAudit } from '@/lib/auth/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { sid } = await params;

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }

    const input = body as StaffInput;
    input.id = sid;

    // department_key gerekli
    if (!input.department_key) {
      return NextResponse.json({ error: 'department_key zorunludur.' }, { status: 400 });
    }

    // Yetki kontrolü
    const allowed = getAllowedDepartments(admin.role);
    if (!allowed.includes(input.department_key)) {
      return NextResponse.json({ error: 'Bu departmana erişim yetkiniz yok.' }, { status: 403 });
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug);
    const staff = await upsertStaff(tenant.hotelSupabase, input);

    await logAudit({
      actorId: admin.sub,
      actorUsername: admin.username,
      action: 'hotel_staff.update',
      resourceType: 'department_staff',
      resourceId: sid,
      hotelId: tenant.hotelId,
      details: { department: input.department_key },
    }).catch(() => {});

    return NextResponse.json({ staff });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { sid } = await params;

  // Önce personeli bul → department kontrolü için
  const allowed = getAllowedDepartments(admin.role);

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug);

    // Personeli bul
    const allStaff = await listStaff(tenant.hotelSupabase);
    const target = allStaff.find((s) => s.id === sid);
    if (!target) {
      return NextResponse.json({ error: 'Personel bulunamadı.' }, { status: 404 });
    }

    if (!allowed.includes(target.department_key)) {
      return NextResponse.json({ error: 'Bu personeli silme yetkiniz yok.' }, { status: 403 });
    }

    await deleteStaff(tenant.hotelSupabase, sid);

    await logAudit({
      actorId: admin.sub,
      actorUsername: admin.username,
      action: 'hotel_staff.delete',
      resourceType: 'department_staff',
      resourceId: sid,
      hotelId: tenant.hotelId,
      details: { full_name: target.full_name, department: target.department_key },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
