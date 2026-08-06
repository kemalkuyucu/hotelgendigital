// GET  /api/admin/hotel-users?hotelId=<uuid>  → list users
// POST /api/admin/hotel-users                  → create user
// Modül 22 Adım 1+2 — Süper Admin Kullanıcı Yönetimi
// Şifre hash'i ASLA döndürülmez / loglanmaz.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { getCentralSupabase } from '@/lib/supabase-client';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// ─── Ortak auth guard ──────────────────────────────────────────────────────────
async function requireSuperAdmin() {
  const admin = await getSessionAdmin();
  if (!admin) return { admin: null, err: NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 }) };
  if (admin.role !== 'super_admin') return { admin: null, err: NextResponse.json({ error: 'Yalnızca super_admin.' }, { status: 403 }) };
  return { admin, err: null };
}

// ─── GET — kullanıcı listesi ───────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { err } = await requireSuperAdmin();
  if (err) return err;

  const hotelId = req.nextUrl.searchParams.get('hotelId');
  if (!hotelId) {
    return NextResponse.json({ error: 'hotelId parametresi gereklidir.' }, { status: 400 });
  }

  // Otelin central DB'deki varlığını doğrula
  const central = getCentralSupabase();
  const { data: hotel, error: hotelError } = await central
    .from('hotels')
    .select('id, name, slug, status')
    .eq('id', hotelId)
    .maybeSingle();

  if (hotelError || !hotel) {
    return NextResponse.json({ error: 'Otel bulunamadı.' }, { status: 404 });
  }

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .select('id, username, full_name, role, is_active, created_at')
      // password_hash sütunu SEÇİLMEZ — güvenlik gereği
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[hotel-users GET] tenant query error:', error);
      return NextResponse.json({ error: 'Kullanıcılar alınırken hata' }, { status: 500 });
    }

    return NextResponse.json({
      hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug },
      users: data ?? [],
    });
  } catch (err) {
    console.error('[hotel-users GET] bridge error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ─── POST — yeni kullanıcı oluştur ────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { err } = await requireSuperAdmin();
  if (err) return err;

  let body: { hotelId?: string; username?: string; full_name?: string; role?: string; password?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const { hotelId, username, full_name, role, password } = body;

  if (!hotelId || !username || !full_name || !role || !password) {
    return NextResponse.json(
      { error: 'hotelId, username, full_name, role ve password zorunludur.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Şifre en az 8 karakter olmalıdır.' }, { status: 400 });
  }

  // Şifreyi hash'le — cost 12, plain text asla saklanmaz
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { hotelSupabase } = await resolveTenantByHotelId(hotelId);
    const { data, error } = await hotelSupabase
      .from('hotel_admin_users')
      .insert({
        username: username.trim().toLowerCase(),
        password_hash: passwordHash,
        full_name: full_name.trim(),
        role,
        is_active: true,
      })
      .select('id, username, full_name, role, is_active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' }, { status: 409 });
      }
      console.error('[hotel-users POST] insert error:', error);
      return NextResponse.json({ error: 'Kullanıcı oluşturulamadı' }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (err) {
    console.error('[hotel-users POST] bridge error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

