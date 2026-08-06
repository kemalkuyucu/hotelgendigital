// GET /api/hotel-admin/[slug]/guests/[id] — Tek misafir
// PATCH /api/hotel-admin/[slug]/guests/[id] — Güncelle
// DELETE /api/hotel-admin/[slug]/guests/[id] — is_active=false (soft)

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const { slug, id } = await params;
  if (slug !== admin.hotel_slug) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });

  try {
    const tenant = await resolveTenantBySlug(slug);
    const { data, error } = await tenant.hotelSupabase
      .from('inhouse_guests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
    return NextResponse.json({ guest: data });
  } catch (err) {
    console.error('[hotel-admin-guests]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const { slug, id } = await params;
  if (slug !== admin.hotel_slug) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });

  try {
    const body = await req.json() as Record<string, unknown>;

    const updateData: Record<string, unknown> = {};

    // Scalar güncellenebilir alanlar
    const scalarFields = ['room_number', 'first_name', 'last_name', 'phone', 'email', 'language', 'gender', 'package', 'check_in_date', 'check_out_date', 'notes'];
    for (const key of scalarFields) {
      if (key in body) updateData[key] = body[key];
    }

    // is_active boolean
    if ('is_active' in body) {
      updateData['is_active'] = Boolean(body.is_active);
    }

    // full_name: first_name veya last_name değiştiyse yeniden hesapla
    if ('first_name' in body || 'last_name' in body) {
      const fn = 'first_name' in body ? String(body.first_name ?? '').trim() : '';
      const ln = 'last_name' in body ? String(body.last_name ?? '').trim() : '';
      if (fn || ln) {
        updateData['full_name'] = [fn, ln].filter(Boolean).join(' ');
      }
    }

    const tenant = await resolveTenantBySlug(slug);
    const { data, error } = await tenant.hotelSupabase
      .from('inhouse_guests')
      .update(updateData)
      .eq('id', id)
      .select('id')
      .single();

    if (error || !data) return NextResponse.json({ error: 'Güncelleme başarısız.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hotel-admin-guests]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const { slug, id } = await params;
  if (slug !== admin.hotel_slug) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });

  try {
    const tenant = await resolveTenantBySlug(slug);
    const { error } = await tenant.hotelSupabase
      .from('inhouse_guests')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hotel-admin-guests]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
