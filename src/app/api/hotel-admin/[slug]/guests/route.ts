// GET /api/hotel-admin/[slug]/guests — Liste (filtre + arama)
// POST /api/hotel-admin/[slug]/guests — Yeni misafir ekle

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { sanitizeOrFilterValue } from '@/lib/utils/postgrest-filter';

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
  const activeFilter = searchParams.get('status'); // 'active' | 'all'
  const search = searchParams.get('search') ?? '';

  try {
    const tenant = await resolveTenantBySlug(slug);
    let query = tenant.hotelSupabase
      .from('inhouse_guests')
      .select('id, room_number, first_name, last_name, full_name, phone, email, language, package, check_in_date, check_out_date, is_active, notes, created_at')
      .order('check_in_date', { ascending: false });

    if (activeFilter === 'active') {
      query = query.eq('is_active', true);
    }

    if (search) {
      // PostgREST filtre injection'i: ayraclar (`,` `(` `)` `.`) temizlenir.
      const safeSearch = sanitizeOrFilterValue(search);
      if (safeSearch) {
        query = query.or(`room_number.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%`);
      }
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
    if (!body.room_number || !body.last_name || !body.check_in_date || !body.check_out_date) {
      return NextResponse.json({ error: 'room_number, last_name, check_in_date, check_out_date zorunludur.' }, { status: 400 });
    }

    const firstName = body.first_name ? String(body.first_name).trim() : '';
    const lastName = String(body.last_name).trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

    const tenant = await resolveTenantBySlug(slug);
    const { data, error } = await tenant.hotelSupabase
      .from('inhouse_guests')
      .insert({
        room_number: String(body.room_number).trim(),
        first_name: firstName || null,
        last_name: lastName,
        full_name: fullName,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        language: body.language ? String(body.language) : 'tr',
        gender: body.gender ? String(body.gender) : null,
        package: body.package ? String(body.package) : null,
        check_in_date: String(body.check_in_date),
        check_out_date: String(body.check_out_date),
        is_active: isActive,
        notes: body.notes ? String(body.notes).trim() : null,
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
