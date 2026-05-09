// Modül 8 — Hotel Admin Auth (JWT, jose, hg_hotel_session cookie)
// Master admin auth'tan (hg_admin_session, /lib/auth/session.ts) TAMAMEN AYRI

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { resolveTenantBySlug } from './tenant';
import type { HotelAdminUser, HotelAdminJwtPayload, HotelAdminRole } from './types';

const COOKIE_NAME = 'hg_hotel_session';
const SESSION_HOURS = 8;
const JWT_ALG = 'HS256';

function getJwtSecret(): Uint8Array {
  const secret = process.env.HOTEL_ADMIN_JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'hotel-admin-dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

export interface LoginResult {
  ok: true;
  user: HotelAdminUser;
  token: string;
}
export interface LoginError {
  ok: false;
  error: string;
}

export async function hotelAdminLogin(
  hotelSlug: string,
  username: string,
  password: string
): Promise<LoginResult | LoginError> {
  try {
    const tenant = await resolveTenantBySlug(hotelSlug);

    // Kullanıcıyı bul
    const { data: user, error } = await tenant.hotelSupabase
      .from('hotel_admin_users')
      .select('id, username, password_hash, full_name, role, is_active, last_login_at, created_at, updated_at')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return { ok: false, error: 'Kullanıcı bulunamadı veya hesap pasif.' };
    }

    const typedUser = user as HotelAdminUser & { password_hash: string };

    // Şifre doğrula
    const valid = await bcrypt.compare(password, typedUser.password_hash);
    if (!valid) {
      return { ok: false, error: 'Şifre hatalı.' };
    }

    // last_login_at güncelle (fire-and-forget)
    tenant.hotelSupabase
      .from('hotel_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', typedUser.id)
      .then(() => {});

    // JWT oluştur
    const payload: HotelAdminJwtPayload = {
      sub: typedUser.id,
      username: typedUser.username,
      full_name: typedUser.full_name,
      role: typedUser.role as HotelAdminRole,
      hotel_slug: hotelSlug,
      hotel_id: tenant.hotelId,
    };

    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(getJwtSecret());

    // Cookie set
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    const { password_hash: _ph, ...safeUser } = typedUser;
    return { ok: true, user: safeUser as HotelAdminUser, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Giriş yapılamadı.';
    console.error('[hotelAdminLogin]', msg);
    return { ok: false, error: 'Sunucu hatası: ' + msg };
  }
}

// ---------------------------------------------------------------------------
// GET CURRENT USER FROM COOKIE
// ---------------------------------------------------------------------------

export async function getHotelAdminFromCookie(): Promise<HotelAdminJwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as HotelAdminJwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

export async function hotelAdminLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
