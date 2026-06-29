import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { getCentralSupabase } from '@/lib/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// /api/hotel-admin/[slug]/report-recipients
// Rapor alıcıları CENTRAL DB'de (report_recipients) tutulur — hotel DB'de DEĞİL.
// hotel_id, Central hotels tablosundan slug ile çözülür.
// Yetki: getHotelAdminFromCookie + admin.hotel_slug === slug (başka otel erişemez).
// ---------------------------------------------------------------------------

type Platform = 'telegram' | 'whatsapp';
const VALID_PLATFORMS: Platform[] = ['telegram', 'whatsapp'];

/** slug -> Central hotels.id çöz. Bulunamazsa null. */
async function resolveHotelId(
  central: ReturnType<typeof getCentralSupabase>,
  slug: string
): Promise<string | null> {
  const { data, error } = await central
    .from('hotels')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Ortak auth: { error, status } döner (hata varsa), yoksa null. */
async function authorize(slug: string): Promise<{ error: string; status: number } | null> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return { error: 'unauthorized', status: 401 };
  if (admin.hotel_slug !== slug) return { error: 'forbidden', status: 403 };
  return null;
}

// ---------------------------------------------------------------------------
// GET — o otelin rapor alıcılarını listele
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const denied = await authorize(slug);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    const central = getCentralSupabase();
    const hotelId = await resolveHotelId(central, slug);
    if (!hotelId) return NextResponse.json({ error: 'hotel_not_found' }, { status: 404 });

    const { data, error } = await central
      .from('report_recipients')
      .select('id, first_name, last_name, platform, platform_id, created_at')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error('[report-recipients GET]', msg);
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — yeni alıcı ekle
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const denied = await authorize(slug);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
    const platformId = typeof body.platform_id === 'string' ? body.platform_id.trim() : '';

    if (!firstName) return NextResponse.json({ error: 'first_name boş olamaz' }, { status: 400 });
    if (!lastName) return NextResponse.json({ error: 'last_name boş olamaz' }, { status: 400 });
    if (!VALID_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        { error: "platform 'telegram' veya 'whatsapp' olmalı" },
        { status: 400 }
      );
    }
    if (!platformId) return NextResponse.json({ error: 'platform_id boş olamaz' }, { status: 400 });

    const central = getCentralSupabase();
    const hotelId = await resolveHotelId(central, slug);
    if (!hotelId) return NextResponse.json({ error: 'hotel_not_found' }, { status: 404 });

    const { data, error } = await central
      .from('report_recipients')
      .insert({
        hotel_id: hotelId,
        first_name: firstName,
        last_name: lastName,
        platform,
        platform_id: platformId,
      })
      .select('id, first_name, last_name, platform, platform_id, created_at')
      .single();

    if (error) {
      // Postgres unique violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Bu alıcı (platform + platform_id) zaten kayıtlı.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error('[report-recipients POST]', msg);
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — alıcı sil (sadece bu otele ait satır)
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const denied = await authorize(slug);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    // id: body {id} veya ?id=
    let id = new URL(req.url).searchParams.get('id')?.trim() ?? '';
    if (!id) {
      try {
        const body = (await req.json()) as Record<string, unknown>;
        if (typeof body.id === 'string') id = body.id.trim();
      } catch {
        // body yoksa sorun değil; query param'a düşeriz
      }
    }
    if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

    const central = getCentralSupabase();
    const hotelId = await resolveHotelId(central, slug);
    if (!hotelId) return NextResponse.json({ error: 'hotel_not_found' }, { status: 404 });

    // hotel_id eşleşme şartı: başka otelin satırı silinemez
    const { data, error } = await central
      .from('report_recipients')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select('id');

    if (error) {
      return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error('[report-recipients DELETE]', msg);
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 });
  }
}
