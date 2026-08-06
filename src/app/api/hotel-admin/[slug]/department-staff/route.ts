// GET  /api/hotel-admin/[slug]/department-staff  → listele (rol bazlı)
// POST /api/hotel-admin/[slug]/department-staff  → personel ekle (sadece departman müdürü)
// hotel_owner → GET salt okunur, POST yasak
// dept_manager → GET kendi dept, POST kendi dept

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
      console.error('[hotel-admin-department-staff]', error);
      return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }

    return NextResponse.json({ staff: data as DepartmentStaffRow[] });
  } catch (err) {
    console.error('[hotel-admin-department-staff]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Personel ekle (sadece departman müdürü)
// ---------------------------------------------------------------------------
export async function POST(
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

  // Otel sahibi yazamaz
  if (admin.role === 'hotel_owner') {
    return NextResponse.json(
      { error: 'Otel sahibi bu işlemi yapamaz. Salt okunur erişim.' },
      { status: 403 }
    );
  }

  // Müdürün departmanı — CLIENT'TAN KABUL EDİLMEZ
  const allowedDepts = getAllowedDepartments(admin.role);
  const departmentKey = allowedDepts[0] as DepartmentKey | undefined;
  if (!departmentKey) {
    return NextResponse.json(
      { error: 'Bu rolün departman yetkisi yok.' },
      { status: 403 }
    );
  }

  let body: { full_name?: string; whatsapp_id?: string; telegram_id?: string };
  try {
    body = await req.json() as { full_name?: string; whatsapp_id?: string; telegram_id?: string };
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const fullName = (body.full_name ?? '').trim();
  if (!fullName) {
    return NextResponse.json({ error: 'Ad Soyad zorunludur.' }, { status: 400 });
  }

  const whatsappId = (body.whatsapp_id ?? '').trim() || null;
  const telegramId = (body.telegram_id ?? '').trim() || null;

  // En az bir platform ID zorunlu
  if (!whatsappId && !telegramId) {
    return NextResponse.json(
      { error: 'En az bir platform ID\'si girin (WhatsApp veya Telegram).' },
      { status: 400 }
    );
  }

  try {
    const tenant = await resolveTenantBySlug(slug);

    const { data, error } = await tenant.hotelSupabase
      .from('department_staff')
      .insert({
        department_key: departmentKey,
        full_name: fullName,
        whatsapp_id: whatsappId,
        telegram_user_id: telegramId,
        is_active: true,
        created_by: admin.username,
      })
      .select(
        'id, department_key, full_name, role_title, telegram_user_id, telegram_username, whatsapp_id, is_active, created_at, created_by'
      )
      .single();

    if (error) {
      console.error('[hotel-admin-department-staff]', error);
      return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }

    return NextResponse.json({ staff: data as DepartmentStaffRow }, { status: 201 });
  } catch (err) {
    console.error('[hotel-admin-department-staff]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
