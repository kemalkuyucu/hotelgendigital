// =============================================================================
// src/lib/group-admin/auth.ts
// Modül 22 — Grup Yöneticisi Auth (JWT, jose, group_session cookie)
//
// ⚠️  hotel-admin auth'tan (hg_hotel_session) ve master admin auth'tan
//     (hg_admin_session) TAMAMEN AYRI bir cookie: "group_session"
// =============================================================================

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getCentralSupabase } from '@/lib/supabase-client';

export const GROUP_COOKIE_NAME = 'group_session';
const SESSION_HOURS = 8;
const JWT_ALG = 'HS256';

// ---------------------------------------------------------------------------
// JWT Secret (hotel-admin ile AYNI secret, farklı cookie adı)
// ---------------------------------------------------------------------------

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.HOTEL_ADMIN_JWT_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    'hotel-admin-dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export interface GroupManagerJwtPayload {
  sub: string;        // manager_id
  group_id: string;
  group_slug: string;
  full_name: string;
  role: 'group_manager';
}

export interface GroupLoginResult {
  ok: true;
  redirect: string;
}
export interface GroupLoginError {
  ok: false;
  error: string;
  status: number;
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

export async function groupManagerLogin(
  slug: string,
  username: string,
  password: string
): Promise<GroupLoginResult | GroupLoginError> {
  try {
    const db = getCentralSupabase();

    // 1. Grubu bul
    const { data: group, error: groupErr } = await db
      .from('hotel_groups')
      .select('id, name, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (groupErr || !group) {
      return { ok: false, error: 'Grup bulunamadı.', status: 404 };
    }

    // 2. Yöneticiyi bul (group_id eşleşmeli + is_active)
    const { data: manager, error: mgErr } = await db
      .from('group_managers')
      .select('id, group_id, username, full_name, password_hash, is_active')
      .eq('username', username)
      .eq('group_id', group.id)
      .eq('is_active', true)
      .single();

    if (mgErr || !manager) {
      return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.', status: 401 };
    }

    // 3. Şifre doğrula (bcrypt cost=12 ile hashlendi)
    const valid = await bcrypt.compare(password, manager.password_hash);
    if (!valid) {
      return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.', status: 401 };
    }

    // 4. JWT oluştur — password_hash kesinlikle dahil edilmiyor
    const jwtPayload: GroupManagerJwtPayload = {
      sub: manager.id,
      group_id: group.id,
      group_slug: group.slug,
      full_name: manager.full_name,
      role: 'group_manager',
    };

    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

    const token = await new SignJWT(jwtPayload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(getJwtSecret());

    // 5. Cookie set — sadece /group-admin/* path'inde geçerli
    const cookieStore = await cookies();
    cookieStore.set(GROUP_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/group-admin',
    });

    return { ok: true, redirect: `/group-admin/${slug}/dashboard` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Giriş yapılamadı.';
    console.error('[groupManagerLogin]', msg);
    return { ok: false, error: 'Sunucu hatası: ' + msg, status: 500 };
  }
}

// ---------------------------------------------------------------------------
// GET CURRENT GROUP MANAGER FROM COOKIE
// ---------------------------------------------------------------------------

export async function getGroupManagerFromCookie(): Promise<GroupManagerJwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(GROUP_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as GroupManagerJwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

export async function groupManagerLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GROUP_COOKIE_NAME);
}
