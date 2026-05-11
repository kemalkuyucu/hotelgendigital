// GET /api/hotel-admin/[slug]/guests/[id] — Tek misafir
// PATCH /api/hotel-admin/[slug]/guests/[id] — Güncelle
// DELETE /api/hotel-admin/[slug]/guests/[id] — Status=cancelled (soft)

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
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
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

    // Güncellenebilir alanlar
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ['room_no', 'first_name', 'last_name', 'phone', 'email', 'language', 'package', 'check_in_date', 'check_out_date', 'status', 'notes'];
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key];
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
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
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
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
