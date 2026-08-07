/**
 * src/middleware.ts — Merkezi güvenlik noktası (Next.js Edge Middleware)
 *
 * ⚠️  DOSYA ADI KRİTİK: Next.js sadece src/middleware.ts'i okur.
 *     proxy.ts olarak kayıtlıysa middleware HİÇ çalışmaz!
 *
 * Korunan path'ler:
 *   /admin/*                   → hg_admin_session cookie (master admin)
 *   /hotel-admin/[slug]/*      → hg_hotel_session JWT (hotel admin)
 *   /group-admin/[slug]/*      → group_session JWT (grup yöneticisi, Modül 22)
 *
 * GOREV 3 (2026-05-19): Hotel admin rol bazlı erişim eklendi.
 *   - Cookie yoksa → /hotel-admin/[slug]/login
 *   - Cookie slug ≠ URL slug → /hotel-admin/[slug]/login
 *   - Hedef path için rol yetkili değilse → /hotel-admin/[slug]/dashboard
 *
 * GÜVENLİK FIX (2026-05-20): proxy.ts → middleware.ts rename.
 *   Önceki dosya adı yüzünden /admin/* tamamen korumasızdı.
 *
 * MODÜL 22 (2026-05-23): /group-admin/[slug]/dashboard koruması eklendi.
 *   group_session cookie'si SADECE /group-admin/* path'inde geçerlidir.
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret'

// ---------------------------------------------------------------------------
// CSP — Faz 1: Content-Security-Policy-Report-Only (OLCUM, enforce DEGIL; KIRMAZ)
// ---------------------------------------------------------------------------
// Recon (27+ otu) — tarayici yuzeyi tarandi. SADECE tarayici; server-side fetch'ler
// (webhook/OpenAI/Perplexity/Telegram/Supabase API-route) CSP'ye TABI DEGIL.
//  - script: Next bundle (self, nonce'lu) + tsparticles/xlsx NPM-bundle (self).
//    Harici runtime <script> YOK (xlsx 10/10 server-side; tsparticles npm, CDN degil)
//    -> nonce + 'strict-dynamic' (Next kanonik; 'unsafe-inline' YOK).
//  - style: style={{}} + tsparticles inline style + Google Fonts @import (globals.css:1)
//    -> 'unsafe-inline' (nonce style ATTRIBUTE'unu kapsamaz; dusuk risk, kilit script'te)
//       + https://fonts.googleapis.com (stylesheet).
//  - font: Google Fonts -> https://fonts.gstatic.com (+ data:).
//  - img: data: SVG (globals.css:3794/4017 + inline) + Supabase storage (*.supabase.co,
//    next.config remotePatterns) + blob:.
//  - connect: yalniz same-origin /api/... (harici fetch'lerin HEPSI server-side).
//  - worker: tsparticles slim worker KULLANMAZ; yine de 'self' blob' (Next chunk'lari).
//
// BILINEN ACIK (Faz 2): iki panel srcDoc iframe'i (_calculator-frame / _teklif-frame)
// inline <script> + on*= handler tasir (calculator-html 10, teklif-takip-html 6);
// srcDoc statik string -> NONCE ALAMAZ. Report-Only'de RAPORLANIR ama KIRILMAZ.
// Enforce'ta bu iki iframe bozulur -> Faz 2: script'i harici dosyaya tasi VEYA
// iframe'e ayri sandbox/CSP ver.
//
// ENFORCE HEDEFI (Faz 2, tek-satir flip): AYNI politika, yalniz header adi
// 'Content-Security-Policy' (Report-Only kalkar). srcDoc sorunu ONCE cozulmeli.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ')
}

// Report-To (eski) — Reporting-Endpoints (yeni) header'i cspResponse'ta ayrica set edilir.
const REPORT_TO = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: '/api/csp-report' }],
})

// ---------------------------------------------------------------------------
// JWT helpers (edge runtime uyumlu)
// ---------------------------------------------------------------------------

const HOTEL_COOKIE_NAME = 'hg_hotel_session'
const GROUP_COOKIE_NAME = 'group_session'

function getJwtSecret(): Uint8Array {
  return getJwtSecretBytes()
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
// Group Manager JWT payload
// ---------------------------------------------------------------------------

interface GroupManagerJwtPayload {
  sub: string
  group_id: string
  group_slug: string
  full_name: string
  role: 'group_manager'
}

async function verifyGroupToken(token: string): Promise<GroupManagerJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as GroupManagerJwtPayload
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

  // ── CSP Faz 1: her istekte nonce uret + Report-Only politika ──────────────
  // Nonce Next'in inline (hydration) script'lerine uygulanir; boylece script-src
  // 'unsafe-inline' GEREKMEZ. Report-Only oldugu icin ihlaller yalniz RAPORLANIR.
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next, nonce'i request'teki CSP header'indan okuyup script'lere uygular
  // (Report-Only header'ini de tanir) — bu yuzden request'e de yaziyoruz.
  requestHeaders.set('content-security-policy-report-only', csp)
  const cspResponse = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy-Report-Only', csp)
    res.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"')
    res.headers.set('Report-To', REPORT_TO)
    return res
  }

  // ── BÖLÜM 1: Master Admin (/admin/*) ──────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('hg_admin_session')?.value
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    return cspResponse()
  }

  // ── BÖLÜM 2: Hotel Admin (/hotel-admin/[slug]/*) ──────────────────────────
  const hotelMatch = pathname.match(/^\/hotel-admin\/([^/]+)\/(.*)?$/)
  if (hotelMatch) {
    const urlSlug = hotelMatch[1]
    const restPath = hotelMatch[2] ?? ''

    // Login sayfası korumasız (auth muaf) — ama CSP header'ini yine de alir.
    if (restPath === 'login' || restPath.startsWith('login/')) {
      return cspResponse()
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

  // ── BÖLÜM 3: Grup Yöneticisi (/group-admin/[slug]/*) ─────────────────────
  const groupMatch = pathname.match(/^\/group-admin\/([^/]+)\/(.*)?$/)
  if (groupMatch) {
    const urlSlug = groupMatch[1]
    const restPath = groupMatch[2] ?? ''

    // Login sayfası korumasız (auth muaf) — ama CSP header'ini yine de alir.
    if (restPath === 'login' || restPath.startsWith('login/')) {
      return cspResponse()
    }

    // 1. Cookie kontrolü
    const token = req.cookies.get(GROUP_COOKIE_NAME)?.value
    if (!token) {
      console.log(`[middleware] No group session. path=${pathname}`)
      return NextResponse.redirect(
        new URL(`/group-admin/${urlSlug}/login`, req.url)
      )
    }

    // 2. Token doğrulama
    const payload = await verifyGroupToken(token)
    if (!payload) {
      console.log(`[middleware] Invalid group token. path=${pathname}`)
      const res = NextResponse.redirect(
        new URL(`/group-admin/${urlSlug}/login`, req.url)
      )
      res.cookies.delete(GROUP_COOKIE_NAME)
      return res
    }

    // 3. Slug eşleşme kontrolü
    if (payload.group_slug !== urlSlug) {
      console.log(
        `[middleware] Group slug mismatch. cookie=${payload.group_slug} url=${urlSlug}`
      )
      return NextResponse.redirect(
        new URL(`/group-admin/${urlSlug}/login`, req.url)
      )
    }
  }

  return cspResponse()
}

// ---------------------------------------------------------------------------
// Matcher — CSP Faz 1 icin GENISLETILDI: tum sayfa route'lari (nonce + Report-Only).
// HARIC: /api (webhook hot-path'e DOKUNMA), _next/static, _next/image, favicon ve
// statik dosya uzantilari. Auth mantigi iceride pathname'e gore dallanir; auth-disi
// path'lerde (landing vb.) yalniz CSP header'i eklenir, auth no-op.
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf|otf)$).*)',
  ],
}
