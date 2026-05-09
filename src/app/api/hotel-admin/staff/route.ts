// GET /api/hotel-admin/staff?department=X
// POST /api/hotel-admin/staff

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { listStaff, upsertStaff } from '@/lib/hotel-admin/staff-client';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import type { DepartmentKey, StaffInput } from '@/lib/hotel-admin/types';
import { logAudit } from '@/lib/auth/audit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const department = searchParams.get('department') as DepartmentKey | null;

  // Yetki: manager sadece kendi departmanını görebilir
  const allowed = getAllowedDepartments(admin.role);
  if (department && !allowed.includes(department)) {
    return NextResponse.json({ error: 'Bu departmana erişim yetkiniz yok.' }, { status: 403 });
  }

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug);
    const staff = await listStaff(tenant.hotelSupabase, department ?? undefined);
    return NextResponse.json({ staff });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }

    const input = body as StaffInput;

    // Yetki: manager sadece kendi departmanına ekleyebilir
    const allowed = getAllowedDepartments(admin.role);
    if (!allowed.includes(input.department_key)) {
      return NextResponse.json({ error: 'Bu departmana personel ekleme yetkiniz yok.' }, { status: 403 });
    }

    const tenant = await resolveTenantBySlug(admin.hotel_slug);
    const staff = await upsertStaff(tenant.hotelSupabase, input);

    // Audit log
    await logAudit({
      actorId: admin.sub,
      actorUsername: admin.username,
      action: 'hotel_staff.create',
      resourceType: 'department_staff',
      resourceId: staff.id,
      hotelId: tenant.hotelId,
      details: { department: input.department_key, full_name: input.full_name },
    }).catch(() => {});

    return NextResponse.json({ staff }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
