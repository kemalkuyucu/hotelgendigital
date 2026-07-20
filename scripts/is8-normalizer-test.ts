/**
 * IS 12 — normalizeTr fork suprumu testi (local, is8 korpusu).
 *
 * Turkce buyuk I / noktasiz i normalizasyonu: uc fork normalizeTr'ye cevrildi:
 *   - isInfoOnlyQuery                (route.ts)                      -> GERCEK fonksiyon
 *   - detectMeetingRoomIntent        (hotel-context.ts)             -> normalizeTr uzerinden
 *   - RESERVATION_KEYWORDS eslesmesi (department-brains.ts runSpaBrain)
 *
 * GERCEK moduller import edilir (kopya YOK — kopya yesil doner, canli davranisla
 * celisir; bu tuzak bir kez yasandi). Ag/LLM cagrisi YOK, API anahtari gerekmez.
 *
 * KOK NEDEN (fork bug'i): eski fork `.toLowerCase()` ONCE + noktasiz `ı` ele almadan:
 *   'ŞİFRE'.toLowerCase() -> 'şi̇fre' (i + U+0307 combining dot) -> [Şş]->s 'si̇fre'
 *   -> 'sifre' keyword'u ile ESLESMEZ (combining dot araya girer). normalizeTr 'sifre' verir.
 */
import { normalizeTr } from '@/lib/utils/normalize-tr';
import { RESERVATION_KEYWORDS, isInfoQuestion } from '@/lib/ai/department-brains';
import { isInfoOnlyQuery } from '@/app/api/webhooks/telegram/[hotelSlug]/route';

// department-brains.ts:520 eslesme ifadesinin GERCEK modul + GERCEK normalizer aynasi
// (runSpaBrain callAI cagirir -> offline test edilemez; tek-satir karar aynalanir).
const isReservationMsg = (msg: string): boolean =>
  RESERVATION_KEYWORDS.some((k) => normalizeTr(msg).includes(k));

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// ── 1) normalizeTr I/i kose durumlari (eski fork'un kacirdigi) ──────────────
check('normalizeTr buyuk-I ISIK', normalizeTr('IŞIK'), 'isik');
check('normalizeTr buyuk-İ İYİ', normalizeTr('İYİ'), 'iyi');
check('normalizeTr noktasiz-i ışık', normalizeTr('ışık'), 'isik');
check('normalizeTr ŞİFRE (combining-dot tuzagi)', normalizeTr('ŞİFRE'), 'sifre');
check('normalizeTr karisik İIış', normalizeTr('İIış'), 'iiis');

// ── 2) isInfoOnlyQuery (route.ts) — normalizeTr'ye cevrildi ─────────────────
// Eski fork 'ŞİFRE'yi 'si̇fre' yapip 'sifre' keyword'unu KACIRIR -> false (yanlis).
check('isInfoOnlyQuery ŞİFRE -> bilgi', isInfoOnlyQuery('ŞİFRE'), true);
check('isInfoOnlyQuery WIFI ŞİFRESİ NEDİR', isInfoOnlyQuery('WIFI ŞİFRESİ NEDİR'), true);
check('isInfoOnlyQuery SPA VAR MI', isInfoOnlyQuery('SPA VAR MI'), true);
check('isInfoOnlyQuery duz talep degil', isInfoOnlyQuery('havlu getir'), false);

// ── 3) reservation tarafi (RESERVATION_KEYWORDS + normalizeTr) ──────────────
check('reservation REZERVASYON', isReservationMsg('REZERVASYON'), true);
check('reservation RANDEVU İSTİYORUM', isReservationMsg('RANDEVU İSTİYORUM'), true);
check('reservation rezerve', isReservationMsg('spa rezerve etmek istiyorum'), true);
check('reservation alakasiz', isReservationMsg('havuz kacta aciliyor'), false);

// ── 4) isInfoQuestion (department-brains, zaten normalizeTr'li) I/i ──────────
check('isInfoQuestion NE ZAMAN buyuk', isInfoQuestion('SPA NE ZAMAN AÇILIR'), true);
check('isInfoQuestion KAÇTA', isInfoQuestion('KAHVALTI KAÇTA'), true);

// ── Ozet ────────────────────────────────────────────────────────────────────
const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
