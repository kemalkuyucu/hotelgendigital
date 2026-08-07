/**
 * IS 8 — CSP kademe karari (STRONG vs RELAXED) korpusu.
 * GERCEK modul import edilir (kopya fonksiyon YASAK).
 *
 * Vaka listesi SABIT ve ELLE yazilmistir — RELAXED_FRAME_HOSTS/STRONG_PREFIXES
 * dizilerinden TURETILMEZ. Turetilseydi biri degistiginde beklenti de birlikte
 * kayar ve test KENDINI dogrulardi (STOP_WORDS korpusunda bir kez bu tuzaga
 * dusulmustu).
 *
 * Kilitlenen davranis:
 *  §1 srcDoc tool-frame HOST'lari STRONG alaninin ICINDE ama ISTISNA -> RELAXED.
 *  §2 /admin'in GERI KALANI STRONG kalir (istisna genis prefix DEGIL, EXACT).
 *  §3 diger STRONG alanlari (hotel-admin/group-admin/manager/login) etkilenmez.
 *  §4 public path'ler RELAXED; eslesme SEGMENT sinirinda ('/loginfoo' STRONG DEGIL).
 */
import {
  isRelaxedFrameHost,
  isStrongArea,
  useStrongCsp,
  RELAXED_FRAME_HOSTS,
} from '@/middleware';

let pass = 0;
const fails: string[] = [];

function check(desc: string, got: unknown, expected: unknown) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
}
function checkTrue(desc: string, cond: boolean) {
  check(desc, cond, true);
}

// SABIT beklenti tablosu — dizilerden TURETILMEZ, elle yazilir.
// strong = middleware'in bu path'e nonce + strict-dynamic verecegi anlamina gelir.
const CASES: Array<{ desc: string; path: string; strong: boolean }> = [
  // ── §1 srcDoc tool-frame HOST'lari -> RELAXED (istisna) ───────────────────
  { desc: '1a /admin/maliyet (calculator srcDoc host)', path: '/admin/maliyet', strong: false },
  { desc: '1b /admin/ozgur-kemal (teklif srcDoc host)', path: '/admin/ozgur-kemal', strong: false },

  // ── §2 /admin GERI KALANI STRONG (istisna EXACT, prefix DEGIL) ────────────
  { desc: '2a /admin koku', path: '/admin', strong: true },
  { desc: '2b /admin/login', path: '/admin/login', strong: true },
  { desc: '2c /admin/hotels', path: '/admin/hotels', strong: true },
  { desc: '2d /admin/hotels/123/credentials', path: '/admin/hotels/123/credentials', strong: true },
  { desc: '2e /admin/system-health', path: '/admin/system-health', strong: true },
  // KRITIK: istisna genis prefix OLSAYDI bu da relaxed'e duserdi.
  { desc: '2f /admin/maliyet-raporu (benzer ad, ISTISNA DEGIL)', path: '/admin/maliyet-raporu', strong: true },
  { desc: '2g /admin/ozgur-kemal-eski (benzer ad, ISTISNA DEGIL)', path: '/admin/ozgur-kemal-eski', strong: true },
  // Bilincli dar davranis: alt-route EXACT'e uymaz -> STRONG kalir. Ileride
  // frame tasiyan bir alt-route eklenirse RELAXED_FRAME_HOSTS genisletilmeli.
  { desc: '2h /admin/maliyet/detay (alt-route, EXACT tutmaz)', path: '/admin/maliyet/detay', strong: true },

  // ── §3 diger STRONG alanlari etkilenmedi ──────────────────────────────────
  { desc: '3a /hotel-admin/[slug]/dashboard', path: '/hotel-admin/v5-pro-test-oteli/dashboard', strong: true },
  { desc: '3b /hotel-admin/[slug]/login', path: '/hotel-admin/demo-hotel/login', strong: true },
  { desc: '3c /group-admin/[slug]/login', path: '/group-admin/grup1/login', strong: true },
  { desc: '3d /manager/login', path: '/manager/login', strong: true },
  { desc: '3e /manager/dashboard', path: '/manager/dashboard', strong: true },
  { desc: '3f /login', path: '/login', strong: true },

  // ── §4 public -> RELAXED + segment siniri ─────────────────────────────────
  { desc: '4a / (landing)', path: '/', strong: false },
  { desc: '4b /_not-found', path: '/_not-found', strong: false },
  { desc: '4c /loginfoo (segment siniri, STRONG DEGIL)', path: '/loginfoo', strong: false },
  { desc: '4d /admin-x (segment siniri, STRONG DEGIL)', path: '/admin-x', strong: false },
  { desc: '4e /hotel-admins (segment siniri, STRONG DEGIL)', path: '/hotel-admins', strong: false },
];

for (const c of CASES) {
  check(c.desc, useStrongCsp(c.path), c.strong);
}

// ── §5 isRelaxedFrameHost dogrudan (istisna YALNIZ iki path) ────────────────
check('5a /admin/maliyet frame-host', isRelaxedFrameHost('/admin/maliyet'), true);
check('5b /admin/ozgur-kemal frame-host', isRelaxedFrameHost('/admin/ozgur-kemal'), true);
check('5c /admin frame-host DEGIL', isRelaxedFrameHost('/admin'), false);
check('5d /admin/hotels frame-host DEGIL', isRelaxedFrameHost('/admin/hotels'), false);
check('5e / frame-host DEGIL', isRelaxedFrameHost('/'), false);

// ── §6 istisna STRONG alani ICINDE olmali (yoksa no-op bir istisna olurdu) ──
checkTrue('6a /admin/maliyet STRONG alaninda', isStrongArea('/admin/maliyet'));
checkTrue('6b /admin/ozgur-kemal STRONG alaninda', isStrongArea('/admin/ozgur-kemal'));
checkTrue(
  '6c istisna gercekten karari CEVIRIYOR (isStrongArea true iken useStrongCsp false)',
  isStrongArea('/admin/maliyet') && !useStrongCsp('/admin/maliyet')
);

// ── §7 KAPSAM KILIDI: yeni bir frame-host testsiz eklenemesin ──────────────
// Icerik ELLE yazili beklentiyle karsilastirilir; dizi beklentiyi URETMEZ.
check('7a frame-host sayisi 2', RELAXED_FRAME_HOSTS.length, 2);
checkTrue('7b /admin/maliyet listede', RELAXED_FRAME_HOSTS.includes('/admin/maliyet'));
checkTrue('7c /admin/ozgur-kemal listede', RELAXED_FRAME_HOSTS.includes('/admin/ozgur-kemal'));

// ── §8 korpus KOR DEGIL: hem STRONG hem RELAXED vakasi uretmis olmali ───────
const strongCount = CASES.filter((c) => c.strong).length;
const relaxedCount = CASES.filter((c) => !c.strong).length;
checkTrue('8y en az bir STRONG vakasi var', strongCount >= 1);
checkTrue('8z en az bir RELAXED vakasi var', relaxedCount >= 1);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
