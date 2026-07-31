/**
 * IS 8 — verification parser (parseVerificationInput) korpusu.
 * backlog #1 kok fix: prefixsiz sayi ODA sanma + isPureIdentityClaim siniri +
 * requestStopWords cekim eki. GERCEK modulu import eder; ag/LLM/DB YOK (saf parse).
 */
import { parseVerificationInput } from '@/lib/verification/verify-guest';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// Non-ASCII prefixleri codePoint'ten kur (RTL/bidi literal YASAK — MASTER 2.2.3)
const RU_ROOM = String.fromCodePoint(0x043D, 0x043E, 0x043C, 0x0435, 0x0440); // nomer
const AR_ROOM = String.fromCodePoint(0x063A, 0x0631, 0x0641, 0x0629);         // gurfe

// ── (1) PREFIXLI oda — her zaman guvenilir ────────────────────────────────
check('1a room', parseVerificationInput('oda 312 Kemal Kuyucu').roomNumber, '312');
check('1a first', parseVerificationInput('oda 312 Kemal Kuyucu').firstName, 'Kemal');
check('1a last', parseVerificationInput('oda 312 Kemal Kuyucu').lastName, 'Kuyucu');
check('1a pure', parseVerificationInput('oda 312 Kemal Kuyucu').isPureIdentityClaim, true);
check('1b en', parseVerificationInput('Room 205 John Smith').roomNumber, '205');
check('1c de', parseVerificationInput('zimmer 108 Hans Meier').roomNumber, '108');
check('1d ru', parseVerificationInput(`${RU_ROOM} 410 Ivan Petrov`).roomNumber, '410');
check('1e ar', parseVerificationInput(`${AR_ROOM} 312 Ahmed Ali`).roomNumber, '312');
check('1f no-prefix', parseVerificationInput('no 512 Ayse Yilmaz').roomNumber, '512');
check('1g bare-alone', parseVerificationInput('312').roomNumber, '312');
check('1h prefix-alone', parseVerificationInput('oda 312').roomNumber, '312');
check('1i prefixed-bypass', parseVerificationInput('oda 312 dugun salonu').roomNumber, '312');

// ── (2) PREFIXSIZ kimlik iddiasi (temiz) — oda kabul ──────────────────────
check('2a room', parseVerificationInput('312 Kemal Kuyucu').roomNumber, '312');
check('2a pure', parseVerificationInput('312 Kemal Kuyucu').isPureIdentityClaim, true);
check('2b kapi2', parseVerificationInput('102 Ozgur Ozen').roomNumber, '102');
check('2c multi-first', parseVerificationInput('208 Mehmet Ali Kaya').firstName, 'Mehmet Ali');
check('2c multi-last', parseVerificationInput('208 Mehmet Ali Kaya').lastName, 'Kaya');

// ── (3) BUG: prefixsiz sayi + event/miktar → ODA DEGIL ────────────────────
check('3a room', parseVerificationInput('40 kisilik dugun').roomNumber, null);
check('3a pure', parseVerificationInput('40 kisilik dugun').isPureIdentityClaim, false);
check('3b canli room', parseVerificationInput('40 kisilik dugun organizasyonu icin fiyat almak istiyoruz').roomNumber, null);
check('3b canli pure', parseVerificationInput('40 kisilik dugun organizasyonu icin fiyat almak istiyoruz').isPureIdentityClaim, false);
check('3c sinyalsiz', parseVerificationInput('dugun icin 40 kisi').roomNumber, null);
check('3d tarih-kisi', parseVerificationInput('15 agustos 2 kisi').roomNumber, null);
check('3e gece', parseVerificationInput('10 gece konaklama').roomNumber, null);
check('3f kisi-gece', parseVerificationInput('20 kisi 3 gece').roomNumber, null);
check('3g nikah', parseVerificationInput('nikah icin 80 davetli').roomNumber, null);
check('3h organizasyon', parseVerificationInput('organizasyon 50 kisi').roomNumber, null);

// ── (4) isPureIdentityClaim sinirlari ─────────────────────────────────────
check('4a kod-adet', parseVerificationInput('1001 kod 2 adet').isPureIdentityClaim, false);
check('4b token-bound', parseVerificationInput('lutfen beni yetkili biriyle acilen gorusturur musunuz').isPureIdentityClaim, false);
check('4c event-pure', parseVerificationInput('40 kisilik dugun').isPureIdentityClaim, false);

// ── (5) Embedded request — cekim eki (D3) ─────────────────────────────────
check('5a inflection', parseVerificationInput('oda 312 Kemal Kuyucu gorusmek istiyoruz').hasEmbeddedRequest, true);
check('5b klima', parseVerificationInput('oda 312 Kemal Kuyucu klimam calismiyor').hasEmbeddedRequest, true);
check('5c temiz', parseVerificationInput('oda 312 Kemal Kuyucu').hasEmbeddedRequest, false);

// ── (6) Format / bos ──────────────────────────────────────────────────────
check('6a empty', parseVerificationInput('').roomNumber, null);
check('6b selam', parseVerificationInput('merhaba').roomNumber, null);
check('6c bare+quantity', parseVerificationInput('312 icin 2 gece').roomNumber, null);

// ── (7) IS 16: non-latin (RU/AR) event/miktar baglami → ODA DEGIL ─────────
// Girdiler codePoint'ten kurulur: kaynak dosyalardaki RU/AR literal TERS veya
// bozuk gomulmusse bu vakalar KIRMIZI doner (goz karari yerine makine kaniti).
const RU_WEDDING   = String.fromCodePoint(0x0441, 0x0432, 0x0430, 0x0434, 0x044C, 0x0431, 0x0430); // svadba
const RU_WEDDING_U = String.fromCodePoint(0x0441, 0x0432, 0x0430, 0x0434, 0x044C, 0x0431, 0x0443); // svadbu
const RU_PEOPLE    = String.fromCodePoint(0x0447, 0x0435, 0x043B, 0x043E, 0x0432, 0x0435, 0x043A); // chelovek
const RU_NA        = String.fromCodePoint(0x043D, 0x0430);                                          // na
const RU_NIGHTS    = String.fromCodePoint(0x043D, 0x043E, 0x0447, 0x0438);                          // nochi
const AR_WEDDING   = String.fromCodePoint(0x0632, 0x0641, 0x0627, 0x0641);                          // zifaf
const AR_PERSON    = String.fromCodePoint(0x0634, 0x062E, 0x0635);                                  // sahs

check('7a ru event+kisi', parseVerificationInput(`${RU_WEDDING} 40 ${RU_PEOPLE}`).roomNumber, null);
check('7b ru kisi+event', parseVerificationInput(`40 ${RU_PEOPLE} ${RU_NA} ${RU_WEDDING_U}`).roomNumber, null);
check('7c ar event+kisi', parseVerificationInput(`${AR_WEDDING} 40 ${AR_PERSON}`).roomNumber, null);
check('7d ru gece+kisi', parseVerificationInput(`2 ${RU_NIGHTS} 40 ${RU_PEOPLE}`).roomNumber, null);
// REGRESYON: PREFIXLI oda non-latin baglamda da OKUNUR (prefix her zaman kazanir)
check('7e ru prefix', parseVerificationInput(`${RU_ROOM} 312`).roomNumber, '312');
check('7f ar prefix', parseVerificationInput(`${AR_ROOM} 312`).roomNumber, '312');

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`IS8 verify-parse: ${pass}/${total} PASS`);
  for (const f of fails) console.error('  x ' + f);
  process.exit(1);
}
console.log(`IS8 verify-parse: ${pass}/${total} PASS`);
