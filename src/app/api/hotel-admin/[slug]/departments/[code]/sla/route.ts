/**
 * PATCH /api/hotel-admin/[slug]/departments/[code]/sla
 * SLA dakika ayarlarını günceller.
 * Body: { sla_minutes: number, reception_sla_minutes: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; code: string }> }
) {
  const { slug, code } = await params;

  const admin = await getHotelAdminFromCookie();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // TENANT IZOLASYONU: URL'deki slug SALDIRGAN GIRDISIDIR. Bu kontrol olmadan
  // A otelinin admin'i `/api/hotel-admin/<B-oteli>/departments/.../sla` cagirip
  // B'nin SLA ayarini YAZABILIYORDU (resolveTenantBySlug slug'a gore B'nin DB
  // client'ini doner; service_role RLS'i bypass eder). middleware.ts bu yolu
  // KORUMAZ — matcher'i `/hotel-admin/:slug/:path*`, yani `/api/...` disarida.
  // Ayni kontrol diger tum [slug] route'larinda zaten mevcuttu.
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { sla_minutes?: number; reception_sla_minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const slaMinutes = typeof body.sla_minutes === 'number' ? Math.max(1, Math.min(60, body.sla_minutes)) : undefined;
  const receptionSlaMinutes = typeof body.reception_sla_minutes === 'number' ? Math.max(1, Math.min(120, body.reception_sla_minutes)) : undefined;

  if (slaMinutes === undefined && receptionSlaMinutes === undefined) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
  }

  const updates: Record<string, number> = {};
  if (slaMinutes !== undefined) updates.sla_minutes = slaMinutes;
  if (receptionSlaMinutes !== undefined) updates.reception_sla_minutes = receptionSlaMinutes;

  try {
    const tenant = await resolveTenantBySlug(slug);
    const { error } = await tenant.hotelSupabase
      .from('departments')
      .update(updates)
      .eq('code', code);

    if (error) {
      console.error('[sla-api] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: updates });
  } catch (err) {
    console.error('[sla-api] error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

/** GET: departman SLA değerlerini oku */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; code: string }> }
) {
  const { slug, code } = await params;

  const admin = await getHotelAdminFromCookie();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // TENANT IZOLASYONU — PATCH ile ayni gerekce (okuma tarafi).
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const tenant = await resolveTenantBySlug(slug);
    const { data, error } = await tenant.hotelSupabase
      .from('departments')
      .select('code, display_name, sla_minutes, reception_sla_minutes')
      .eq('code', code)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'department not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[sla-api] get error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
