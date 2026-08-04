import type { NextConfig } from 'next';

/**
 * Guvenlik header'lari — TUM route'lara uygulanir.
 *
 * X-Frame-Options DENY GUVENLI: panelin iki iframe'i (`_calculator-frame`,
 * `_teklif-frame`) `srcDoc` kullanir — ayri bir HTTP yaniti YOK, dolayisiyla
 * bu header onlara UYGULANMAZ. Disaridan gomulen bir sayfamiz yok.
 *
 * CSP BILINCLI OLARAK YOK: panel/landing inline style + tsparticles tasiyor;
 * olcum yapmadan enforce etmek UI'yi kirar. Once Report-Only ile olculmeli
 * (acik borc — rapora yazildi).
 */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Next.js surum parmak izini gizle (bilgi ifsasi).
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      // NOT: `allowedOrigins` BILINCLI olarak AYARLANMADI. Bos birakildiginda
      // Next.js Origin === Host esitligini zorunlu tutar (her deployment kendi
      // domain'i icin gecerli). Buraya sabit bir domain yazmak preview/branch
      // deployment'larini kirar; `*.vercel.app` yazmak ise korumayi GEVSETIR
      // (baska bir vercel.app subdomain'i CSRF kaynagi olabilirdi).
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
