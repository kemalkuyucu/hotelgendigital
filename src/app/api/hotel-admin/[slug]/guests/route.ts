// GET /api/hotel-admin/[slug]/guests — Liste (filtre + arama)
// POST /api/hotel-admin/[slug]/guests — Yeni misafir ekle

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok.' }, { status: 403 });
  }

  const { slug } = await params;
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status'); // 'active' | 'all'
  const search = searchParams.get('search') ?? '';

  try {
    const tenant = await resolveTenantBySlug(slug);
    let query = tenant.hotelSupabase
      .from('inhouse_guests')
      .select('id, room_no, first_name, last_name, full_name, phone, email, language, package, check_in_date, check_out_date, status, notes, created_at')
      .order('check_in_date', { ascending: false });

    if (statusFilter === 'active') {
      query = query.eq('status', 'active');
    }

    if (search) {
      // room_no veya last_name ilike arama
      query = query.or(`room_no.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ guests: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok.' }, { status: 403 });
  }

  const { slug } = await params;
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    // Zorunlu alan validasyonu
    if (!body.room_no || !body.last_name || !body.check_in_date || !body.check_out_date) {
      return NextResponse.json({ error: 'room_no, last_name, check_in_date, check_out_date zorunludur.' }, { status: 400 });
    }

    const tenant = await resolveTenantBySlug(slug);
    const { data, error } = await tenant.hotelSupabase
      .from('inhouse_guests')
      .insert({
        room_no: String(body.room_no).trim(),
        first_name: body.first_name ? String(body.first_name).trim() : null,
        last_name: String(body.last_name).trim(),
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        language: body.language ? String(body.language) : 'tr',
        package: body.package ? String(body.package) : null,
        check_in_date: String(body.check_in_date),
        check_out_date: String(body.check_out_date),
        status: body.status ? String(body.status) : 'active',
        notes: body.notes ? String(body.notes).trim() : null,
        created_by_user_id: admin.sub,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ guest: data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
