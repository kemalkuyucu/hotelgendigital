// GET /api/hotel-admin/[slug]/department-staff
// Departman personelini listeler — rol bazlı filtre (API seviyesinde)
// hotel_owner → tüm departmanlar (salt okunur)
// dept_manager → sadece kendi departmanı

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import type { DepartmentKey } from '@/lib/hotel-admin/types';

export interface DepartmentStaffRow {
  id: string;
  department_key: string;
  full_name: string;
  role_title: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  whatsapp_id: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  const admin = await getHotelAdminFromCookie();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  // Slug güvenlik kontrolü
  if (admin.hotel_slug !== slug) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 });
  }

  // Giriş yapan kullanıcının erişebildiği departmanlar
  const allowedDepts = getAllowedDepartments(admin.role);

  // ?department= query parametresi (opsiyonel, sadece manager için)
  const { searchParams } = new URL(req.url);
  const deptParam = searchParams.get('department') as DepartmentKey | null;

  // Departman filtresi güvenlik kontrolü
  if (deptParam && !allowedDepts.includes(deptParam)) {
    return NextResponse.json(
      { error: 'Bu departmana erişim yetkiniz yok.' },
      { status: 403 }
    );
  }

  try {
    const tenant = await resolveTenantBySlug(slug);

    // Sorgu: sadece izin verilen departmanlar
    let query = tenant.hotelSupabase
      .from('department_staff')
      .select(
        'id, department_key, full_name, role_title, telegram_user_id, telegram_username, whatsapp_id, is_active, created_at, created_by'
      )
      .in('department_key', allowedDepts)
      .order('department_key', { ascending: true })
      .order('full_name', { ascending: true });

    // Ek departman filtresi varsa uygula
    if (deptParam) {
      query = query.eq('department_key', deptParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ staff: data as DepartmentStaffRow[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
