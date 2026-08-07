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
// CSP — Faz 2/b: IKI KADEMELI **ENFORCING** Content-Security-Policy
//                (Report-Only KALKTI; ihlal artik BLOKLANIR)
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
// srcDoc TOOL-FRAME'LERI (Faz 2/a'da KAPANDI — asagidaki RELAXED_FRAME_HOSTS):
// iki panel srcDoc iframe'i (_calculator-frame / _teklif-frame) inline <script> +
// on*= handler tasir. GERCEK envanter (olculdu, 2026-08-07):
//   calculator-html.ts : 1 <script> blogu + 1 on*  (toggleGuide)
//   teklif-takip-html.ts: 1 <script> blogu + 4 on* (switchTab x2, addHotel, removeHotel)
// (Bu satir daha once "10 + 6" diyordu — YANLISTI; sayim `content="` yanlis-pozitifi
//  tasiyan bir grep'ten geliyordu. Duzeltildi.)
// srcDoc dokumani PARENT'in politikasini MIRAS ALIR ve nonce ALAMAZ -> STRONG
// altinda kalsalardi enforce'ta olurlerdi (olculdu: script-src-elem + script-src-attr,
// tool fonksiyonlari undefined). Cozum: host sayfalari RELAXED'e alindi.
//
// ---------------------------------------------------------------------------
// NEDEN IKI KADEME (Faz 2/a) — headless olcum, PROD dpl_6XQqFCNx6..., 2026-08-07
// ---------------------------------------------------------------------------
// 'strict-dynamic' spec geregi 'self'i ve host allowlist'ini GECERSIZ KILAR ->
// yalniz nonce/hash eslesen script gecer. Statik prerender edilen HTML ise BUILD
// aninda uretilip CDN'de cache'lenir (olculdu: X-Nextjs-Prerender: 1 +
// X-Vercel-Cache: HIT) -> nonce TASIYAMAZ, middleware ise her istekte TAZE nonce
// yollar = KALICI uyusmazlik. Canli sonuc: '/' -> 12 ihlal (10 same-origin _next
// chunk + 2 inline), '/admin/login' (dynamic) -> 0 ihlal.
//
// COZUM — path'e gore IKI politika, TEK KAYNAK yine BU dosya:
//   STRONG  (uygulama/auth) -> nonceCsp:   nonce + 'strict-dynamic', 'unsafe-inline' YOK.
//                              Bu alandaki route'larin HEPSI dynamic (f) olmak ZORUNDA.
//   RELAXED (halka acik)    -> relaxedCsp: nonce YOK, 'strict-dynamic' YOK,
//                              script-src 'self' 'unsafe-inline' -> statik + CDN
//                              cache ile UYUMLU.
// Yeni bir PUBLIC sayfa varsayilan olarak RELAXED'e duser -> enforce'ta KIRILMAZ.
// Yeni bir APP sayfasi STRONG_PREFIXES altina duser -> otomatik guclu politika.
//
// ENFORCE YAPILDI (Faz 2/b): header adi 'Content-Security-Policy'; iki kademe +
// RELAXED_FRAME_HOSTS mantigi DEGISMEDI. Onceki iki bloker kapatilmis olarak
// gelindi: (1) srcDoc tool-frame'leri -> host'lari RELAXED (asagida),
// (2) STRONG alanindaki statik route'lar -> hepsi force-dynamic (build'de f).
// RAPORLAMA ACIK KALDI (report-uri/report-to + Reporting-Endpoints): enforce'ta
// da ihlaller /api/csp-report'a duser, yani prod'da bir sey kirilirsa GORUNUR.
// GERI ALMA (bir sey kirilirsa): bu dosyada iki header adini
// 'Content-Security-Policy-Report-Only' / 'content-security-policy-report-only'
// yapmak yeterli — politika ve kademe mantigina DOKUNMA.
// ENFORCE ONCESI/SONRASI degismeyen kontrol: `npm run build` o/f listesi —
// STRONG alaninda 'o' (statik) bir route BELIRIRSE o sayfa nonce alamaz ve
// script'leri BLOKLANIR.

/**
 * Iki kademede de AYNI olan yonergeler. Kopya YAZILMAZ (bkz. CLAUDE.md §3
 * "tekrarlanan karar tek kaynakta") — iki politika YALNIZ script-src'de ayrilir.
 */
const CSP_DEFAULT_SRC = "default-src 'self'"
const CSP_SHARED_TAIL = [
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
]

function buildCsp(scriptSrc: string): string {
  return [CSP_DEFAULT_SRC, scriptSrc, ...CSP_SHARED_TAIL].join('; ')
}

/** RELAXED — halka acik / statik prerender edilebilen sayfalar. Nonce YOK. */
export function relaxedCsp(): string {
  return buildCsp("script-src 'self' 'unsafe-inline'")
}

/** STRONG — uygulama/auth alanlari. Next nonce'i HTML'e isler (dynamic render SART). */
export function nonceCsp(nonce: string): string {
  return buildCsp(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
}

/**
 * STRONG politika alanlari — uygulama/auth yuzeyi.
 * Kaynak: `npm run build` route listesi (o/f sutunu) + src/app agaci.
 * DIKKAT: bu prefix'lerin ALTINDAKI bir route statik (o) kalirsa nonce
 * TASIYAMAZ ve enforce'ta TUM script'leri bloklanir.
 */
export const STRONG_PREFIXES = ['/admin', '/hotel-admin', '/group-admin', '/manager', '/login']

/** Eslesme SEGMENT sinirinda — '/loginfoo' STRONG SAYILMAZ. */
export function isStrongArea(pathname: string): boolean {
  return STRONG_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * STRONG alani icindeki ISTISNA: statik srcDoc tool-frame HOST'lari.
 *
 * NEDEN RELAXED (Option A, 2026-08-07):
 *  - Bu iki sayfa bir `srcDoc` iframe gomer (_calculator-frame / _teklif-frame).
 *    srcDoc dokumani PARENT'in CSP'sini MIRAS ALIR ve nonce ALAMAZ -> STRONG
 *    altinda enforce'ta arac TAMAMEN oler (olculdu: script-src-elem yukleme
 *    aninda + script-src-attr tikta; compute()/renderQuote() undefined).
 *  - Gomulen HTML %100 STATIK: 0 template interpolasyonu, frame bilesenine prop
 *    YOK, fetch/XHR/localStorage YOK, eval/new Function YOK, harici kaynak YOK.
 *    Host sayfa + layout zincirinde dangerouslySetInnerHTML YOK; tek dinamik
 *    degerler (admin.full_name / admin.role) JSX text child olarak React
 *    tarafindan escape edilir. Yani 'unsafe-inline' icin SOMURULEBILIR bir
 *    enjeksiyon noktasi YOK -> bu iki sayfada relaxed GUVENLI.
 *  - Alternatif (frame'i ayri route'tan servis etmek) `next.config.ts`teki
 *    X-Frame-Options: DENY'i gevsetmeyi gerektirirdi; o kontrol BUGUN enforce
 *    ve guvenligi ACIKCA srcDoc kullanimina dayaniyor -> REDDEDILDI.
 *
 * DIKKAT — YENI BIR srcDoc/inline-script FRAME EKLERSEN host path'ini BURAYA DA
 * EKLE; yoksa enforce'a gecildiginde o arac SESSIZCE oler.
 *
 * Esleme EXACT: iki sayfanin da alt-route'u YOK. Alt-route eklenirse burasi
 * bilincli olarak genisletilmeli (genis prefix, gereginden fazla yuzey gevsetir).
 */
export const RELAXED_FRAME_HOSTS = ['/admin/maliyet', '/admin/ozgur-kemal']

export function isRelaxedFrameHost(pathname: string): boolean {
  return RELAXED_FRAME_HOSTS.includes(pathname)
}

/** Bir path STRONG politika mi alir? (middleware'in KULLANDIGI nihai karar) */
export function useStrongCsp(pathname: string): boolean {
  return isStrongArea(pathname) && !isRelaxedFrameHost(pathname)
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

  // ── CSP Faz 2/b: path'e gore IKI KADEMELI **ENFORCING** politika ──────────
  // STRONG alanda nonce uretilir (Next inline hydration script'lerine isler ->
  // 'unsafe-inline' GEREKMEZ). RELAXED alanda nonce YOKTUR: o sayfalar statik
  // prerender + CDN cache olabilir ve nonce tasiyamaz (bkz. yukaridaki olcum).
  // ARTIK ENFORCE: ihlal RAPORLANMAKLA KALMAZ, BLOKLANIR. Raporlama yine acik
  // (report-uri/report-to) -> prod'da bir sey kirilirsa [csp-report]'ta gorunur.
  const nonce = useStrongCsp(pathname) ? btoa(crypto.randomUUID()) : null
  const csp = nonce ? nonceCsp(nonce) : relaxedCsp()
  const cspResponse = () => {
    let res: NextResponse
    if (nonce) {
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-nonce', nonce)
      // Next, nonce'i request'teki CSP header'indan okuyup script'lere uygular.
      // ENFORCE'ta header ADI RESPONSE ile ESLESMELI: request'e 'report-only'
      // yazilip response 'Content-Security-Policy' donerse Next nonce'i yanlis
      // header'dan okumaya calisir -> script'ler nonce'suz kalir ve BLOKLANIR.
      requestHeaders.set('content-security-policy', csp)
      res = NextResponse.next({ request: { headers: requestHeaders } })
    } else {
      // RELAXED: request header'ina DOKUNMA. Nonce'lu bir CSP request header'i
      // Next'i dinamik render'a zorlar; bu sayfalar CDN cache'inde KALMALI.
      res = NextResponse.next()
    }
    res.headers.set('Content-Security-Policy', csp)
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
// Matcher — CSP icin GENISLETILDI: tum sayfa route'lari (nonce + enforcing CSP).
// HARIC: /api (webhook hot-path'e DOKUNMA), _next/static, _next/image, favicon ve
// statik dosya uzantilari. Auth mantigi iceride pathname'e gore dallanir; auth-disi
// path'lerde (landing vb.) yalniz CSP header'i eklenir, auth no-op.
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf|otf)$).*)',
  ],
}
