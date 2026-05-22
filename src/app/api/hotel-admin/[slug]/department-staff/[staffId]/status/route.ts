// PATCH /api/hotel-admin/[slug]/department-staff/[staffId]/status
// Personeli arşivle / geri al (is_active toggle)
// ─ Sadece departman müdürü yapabilir (hotel_owner → 403)
// ─ Müdür SADECE kendi departmanının personelini değiştirebilir (server kontrolü)
// ─ HARD DELETE yok

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
): Promise<NextResponse> {
  const { slug, staffId } = await params;

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

  // Müdürün erişebildiği departmanlar
  const allowedDepts = getAllowedDepartments(admin.role);
  if (allowedDepts.length === 0) {
    return NextResponse.json(
      { error: 'Bu rolün departman yetkisi yok.' },
      { status: 403 }
    );
  }

  // İstek gövdesi
  let body: { isActive?: boolean };
  try {
    body = await req.json() as { isActive?: boolean };
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: '"isActive" boolean değer olmalı.' }, { status: 400 });
  }

  try {
    const tenant = await resolveTenantBySlug(slug);

    // Önce kaydı çek — department_key'i doğrula (başka dept staffId'sine erişim engeli)
    const { data: existing, error: fetchError } = await tenant.hotelSupabase
      .from('department_staff')
      .select('id, department_key, is_active')
      .eq('id', staffId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Personel bulunamadı.' }, { status: 404 });
    }

    const row = existing as { id: string; department_key: string; is_active: boolean };

    // ★ Kritik: müdür başka departmanın personelini değiştiremez
    if (!allowedDepts.includes(row.department_key as never)) {
      return NextResponse.json(
        { error: 'Bu personel sizin departmanınıza ait değil.' },
        { status: 403 }
      );
    }

    // is_active güncelle
    const { data: updated, error: updateError } = await tenant.hotelSupabase
      .from('department_staff')
      .update({ is_active: body.isActive })
      .eq('id', staffId)
      .select(
        'id, department_key, full_name, role_title, telegram_user_id, telegram_username, whatsapp_id, is_active, created_at, created_by'
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ staff: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
