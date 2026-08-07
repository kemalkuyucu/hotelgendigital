/**
 * /login segment layout — YALNIZ route segment config tasir, DOM eklemez.
 *
 * NEDEN AYRI DOSYA: page.tsx bir `'use client'` bilesenidir ve Next route segment
 * config'ini ('dynamic', 'revalidate', ...) client component'ten OKUMAZ — hata da
 * VERMEZ, SESSIZCE yok sayar (olculdu: export page.tsx'e konuldugunda build hala
 * `o /login` bastı). Config bu yuzden Server Component olan layout'a tasindi.
 *
 * CSP Faz 2/a: /login STRONG alandir (bkz. middleware.ts STRONG_PREFIXES).
 * Statik prerender edilirse HTML nonce TASIYAMAZ -> enforce'ta tum script'leri
 * bloklanir. Dynamic kalmali.
 */
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
