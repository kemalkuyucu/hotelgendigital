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

// ---------------------------------------------------------------------------
// DUAL-AUTH: hg_manager_session (super_admin) VEYA hg_hotel_session (hotel admin)
// ---------------------------------------------------------------------------
// Manager panelinden hotel-admin paneline geçişte route'ların her iki
// cookie'yi de kabul etmesi için kullanılır.
// Dönen değer null değilse istek yetkilendirilmiş demektir.
// ---------------------------------------------------------------------------

export interface DualAuthIdentity {
  source: 'manager_session' | 'hotel_session';
  id: string;
  username?: string;
  full_name?: string;
  role: string;
  hotel_slug?: string;
  hotel_id?: string;
}

export async function getManagerOrHotelAdmin(): Promise<DualAuthIdentity | null> {
  // 1. Önce hg_manager_session dene (mevcut super_admin akışı bozulmasın)
  try {
    const { getCentralSupabase } = await import('@/lib/supabase-client');
    const crypto = (await import('crypto')).default;
    const cookieStore = await cookies();
    const managerToken = cookieStore.get('hg_manager_session')?.value;
    if (managerToken) {
      const tokenHash = crypto.createHash('sha256').update(managerToken).digest('hex');
      const supabase = getCentralSupabase();
      const { data: session } = await supabase
        .from('master_admin_sessions')
        .select('admin_id, expires_at')
        .eq('token_hash', tokenHash)
        .single();
      if (session && new Date(session.expires_at) >= new Date()) {
        const { data: manager } = await supabase
          .from('master_admins')
          .select('id, username, full_name, role, is_active')
          .eq('id', session.admin_id)
          .eq('role', 'super_admin')
          .single();
        if (manager && manager.is_active) {
          // last_activity güncelle (fire-and-forget)
          supabase
            .from('master_admin_sessions')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('token_hash', tokenHash)
            .then(() => {});
          return {
            source: 'manager_session',
            id: manager.id,
            username: manager.username,
            full_name: manager.full_name,
            role: manager.role,
          };
        }
      }
    }
  } catch {
    // manager session yoksa veya hata varsa hotel session'a geç
  }

  // 2. hg_hotel_session JWT dene (hotel-admin paneli)
  const hotelAdmin = await getHotelAdminFromCookie();
  if (hotelAdmin) {
    return {
      source: 'hotel_session',
      id: hotelAdmin.sub,
      username: hotelAdmin.username,
      full_name: hotelAdmin.full_name,
      role: hotelAdmin.role,
      hotel_slug: hotelAdmin.hotel_slug,
      hotel_id: hotelAdmin.hotel_id,
    };
  }

  return null;
}
