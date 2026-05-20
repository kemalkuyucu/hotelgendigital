/**
 * src/middleware.ts — Merkezi güvenlik noktası (Next.js Edge Middleware)
 *
 * ⚠️  DOSYA ADI KRİTİK: Next.js sadece src/middleware.ts'i okur.
 *     proxy.ts olarak kayıtlıysa middleware HİÇ çalışmaz!
 *
 * Korunan path'ler:
 *   /admin/*            → hg_admin_session cookie (master admin)
 *   /hotel-admin/[slug]/* → hg_hotel_session JWT (hotel admin)
 *
 * GOREV 3 (2026-05-19): Hotel admin rol bazlı erişim eklendi.
 *   - Cookie yoksa → /hotel-admin/[slug]/login
 *   - Cookie slug ≠ URL slug → /hotel-admin/[slug]/login
 *   - Hedef path için rol yetkili değilse → /hotel-admin/[slug]/dashboard
 *
 * GÜVENLİK FIX (2026-05-20): proxy.ts → middleware.ts rename.
 *   Önceki dosya adı yüzünden /admin/* tamamen korumasızdı.
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// ---------------------------------------------------------------------------
// JWT helpers (edge runtime uyumlu)
// ---------------------------------------------------------------------------

const HOTEL_COOKIE_NAME = 'hg_hotel_session'

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.HOTEL_ADMIN_JWT_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    'hotel-admin-dev-secret-change-in-production'
  return new TextEncoder().encode(secret)
}

interface HotelAdminJwtPayload {
  sub: string
  username: string
  full_name: string
  role: string
  hotel_slug: string
  hotel_id: string
}

async function verifyHotelToken(token: string): Promise<HotelAdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as HotelAdminJwtPayload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Path → izin verilen roller haritası
// ---------------------------------------------------------------------------

type HotelAdminRole =
  | 'hotel_owner'
  | 'front_office_manager'
  | 'housekeeping_manager'
  | 'technical_manager'
  | 'fb_manager'
  | 'guest_relation_manager'
  | 'spa_manager'
  | 'animation_manager'

const ALL_ROLES: HotelAdminRole[] = [
  'hotel_owner',
  'front_office_manager',
  'housekeeping_manager',
  'technical_manager',
  'fb_manager',
  'guest_relation_manager',
  'spa_manager',
  'animation_manager',
]

/**
 * Path segment → izin verilen roller
 * Anahtarlar: /hotel-admin/[slug]/ sonrasındaki ilk path segment
 */
const PATH_ROLE_MAP: Record<string, HotelAdminRole[]> = {
  'dashboard':       ALL_ROLES,
  'front-office':    ['hotel_owner', 'front_office_manager'],
  'housekeeping':    ['hotel_owner', 'housekeeping_manager'],
  'teknik':          ['hotel_owner', 'technical_manager'],
  'fb':              ['hotel_owner', 'fb_manager'],
  'guest-relation':  ['hotel_owner', 'guest_relation_manager'],
  'spa':             ['hotel_owner', 'spa_manager'],
  'animasyon':       ['hotel_owner', 'animation_manager'],
  'bilgi-yonetimi':  ['hotel_owner'],
  'guests':          ['hotel_owner'],
}

// ---------------------------------------------------------------------------
// Main middleware function — Next.js bu export'u otomatik olarak çalıştırır
// ---------------------------------------------------------------------------

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── BÖLÜM 1: Master Admin (/admin/*) ──────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('hg_admin_session')?.value
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── BÖLÜM 2: Hotel Admin (/hotel-admin/[slug]/*) ──────────────────────────
  const hotelMatch = pathname.match(/^\/hotel-admin\/([^/]+)\/(.*)?$/)
  if (hotelMatch) {
    const urlSlug = hotelMatch[1]
    const restPath = hotelMatch[2] ?? ''

    // Login sayfası korumasız
    if (restPath === 'login' || restPath.startsWith('login/')) {
      return NextResponse.next()
    }

    // 1. Cookie kontrolü
    const token = req.cookies.get(HOTEL_COOKIE_NAME)?.value
    if (!token) {
      console.log(`[middleware] No hotel session. path=${pathname}`)
      return NextResponse.redirect(
        new URL(`/hotel-admin/${urlSlug}/login`, req.url)
      )
    }

    // 2. Token doğrulama
    const payload = await verifyHotelToken(token)
    if (!payload) {
      console.log(`[middleware] Invalid hotel token. path=${pathname}`)
      const res = NextResponse.redirect(
        new URL(`/hotel-admin/${urlSlug}/login`, req.url)
      )
      res.cookies.delete(HOTEL_COOKIE_NAME)
      return res
    }

    // 3. Slug eşleşme kontrolü
    if (payload.hotel_slug !== urlSlug) {
      console.log(`[middleware] Slug mismatch. cookie=${payload.hotel_slug} url=${urlSlug}`)
      return NextResponse.redirect(
        new URL(`/hotel-admin/${urlSlug}/login`, req.url)
      )
    }

    // 4. Rol yetki kontrolü
    const firstSegment = restPath.split('/')[0]
    const allowedRoles = PATH_ROLE_MAP[firstSegment]

    if (allowedRoles !== undefined) {
      const userRole = payload.role as HotelAdminRole
      if (!allowedRoles.includes(userRole)) {
        console.log(
          `[middleware] Access denied. role=${userRole} segment=${firstSegment}`
        )
        return NextResponse.redirect(
          new URL(`/hotel-admin/${urlSlug}/dashboard`, req.url)
        )
      }
    }
  }

  return NextResponse.next()
}

// ---------------------------------------------------------------------------
// Matcher — admin ve hotel-admin path'lerini incele
// ---------------------------------------------------------------------------

export const config = {
  matcher: ['/admin/:path*', '/hotel-admin/:slug/:path*'],
}
