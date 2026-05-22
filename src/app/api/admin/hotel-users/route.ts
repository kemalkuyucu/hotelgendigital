// GET /api/admin/hotel-users?hotelId=<uuid>
// Modül 22 Adım 1 — Süper Admin Kullanıcı Yönetimi (listeleme)
// Seçilen otelin tenant DB'sinden hotel_admin_users okur.
// Şifre hash'i ASLA döndürülmez.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { getCentralSupabase } from '@/lib/supabase-client';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: sadece super_admin ────────────────────────────────────────────────
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Bu işlem yalnızca super_admin tarafından yapılabilir.' },
      { status: 403 }
    );
  }

  const hotelId = req.nextUrl.searchParams.get('hotelId');
  if (!hotelId) {
    return NextResponse.json({ error: 'hotelId parametresi gereklidir.' }, { status: 400 });
  }

  // ── Otelin central DB'deki bilgilerini doğrula ──────────────────────────────
  const central = getCentralSupabase();
  const { data: hotel, error: hotelError } = await central
    .from('hotels')
    .select('id, name, slug, status')
    .eq('id', hotelId)
    .maybeSingle();

  if (hotelError || !hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı.' }, { status: 404 });
  }

  // ── Tenant DB'ye bridge ile bağlan, kullanıcıları çek ──────────────────────
  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);

    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .select('id, username, full_name, role, is_active, created_at')
      // password_hash sütunu SEÇİLMEZ — güvenlik gereği
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[hotel-users] tenant query error:', error);
      return NextResponse.json(
        { error: 'Kullanıcılar alınırken hata oluştu: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug },
      users: data ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    console.error('[hotel-users] bridge error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
