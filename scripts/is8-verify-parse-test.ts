/**
 * IS 8 — verification parser (parseVerificationInput) korpusu.
 * backlog #1 kok fix: prefixsiz sayi ODA sanma + isPureIdentityClaim siniri +
 * requestStopWords cekim eki. GERCEK modulu import eder; ag/LLM/DB YOK (saf parse).
 */
import {
  parseVerificationInput,
  ROOM_PREFIXES,
  ROOM_REGEX,
  ROOM_PREFIX_STRIP_RE,
  STOP_WORDS,
} from '@/lib/verification/verify-guest';

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

// ── (8) BACKLOG #5: oda-prefix embedded-request'e SIZMAZ ──────────────────
// ROOM_REGEX prefixi TANIR ama strip listesi ayri bir kopyaydi ve AR prefixi
// EKSIKTI -> oda dogru okunuyor, prefix kelimesi TALEP metnine sizip personel
// kartina dusuyordu. needle codePoint'ten kurulur: kaynaktaki AR literal ters/bozuk
// gomulmusse bu vaka KIRMIZI doner (goz karari yerine makine kaniti).
{
  const arRes = parseVerificationInput(`${AR_ROOM} 312 Ahmet Yilmaz klima bozuk`);
  check('8a ar prefix + talep -> oda okunur', arRes.roomNumber, '312');
  check('8b ar prefix + talep -> embedded request bayragi', arRes.hasEmbeddedRequest, true);
  // ASIL MUHUR: prefix kelimesi talep metninde KALMAMALI
  check('8c ar prefix TALEBE SIZMAZ', (arRes.embeddedRequest ?? '').includes(AR_ROOM), false);
  check('8d talep icerigi korunur', (arRes.embeddedRequest ?? '').includes('klima'), true);

  // Ayni davranis latin/kiril prefixlerde ZATEN vardi — regresyon kilidi
  const trRes = parseVerificationInput('oda 312 Ahmet Yilmaz klima bozuk');
  check('8e tr prefix sizmaz', /oda/i.test(trRes.embeddedRequest ?? ''), false);
  const ruRes = parseVerificationInput(`${RU_ROOM} 312 Ahmet Yilmaz klima bozuk`);
  check('8f ru prefix sizmaz', (ruRes.embeddedRequest ?? '').includes(RU_ROOM), false);
}

// ── (9) BACKLOG #5 KOK: ROOM_PREFIXES TEK KAYNAK ──────────────────────────
// Iki regex (ROOM_REGEX prefix alternasyonu + ROOM_PREFIX_STRIP_RE) artik TEK
// diziden URETILIR. Bu bolum uc seyi muhurler:
//  (i)   her prefix ROOM_REGEX'te ISE YARIYOR: miktar baglaminda prefixSIZ sayi
//        ODA SAYILMAZ (9f zemini), prefixLI sayi OKUNUR. Bir prefix diziden
//        dusesse ilgili 9g vakasi KIRMIZI doner -> negatif kontrol otomatiktir.
//  (ii)  her prefix strip'te ISE YARIYOR: talep metnine SIZMIYOR (kart temiz).
//  (iii) BYTE-ESDEGERLIK: uretilen `.source`, refactor ONCESI elle yazilmis
//        literallerin BIREBIR aynisi. Sira/icerik kaymasi burada yakalanir.
{
  // Beklenen liste refactor ONCESI literalden BIREBIR kopyadir ve asagidaki
  // donguyu de O surer — kaynaktan TURETILMEZ. (Kaynagi kopyalayan bir dongu
  // kendi kendini dogrular: prefix diziden dusunce dongu de kisalir, vaka
  // KIRMIZI DONMEZ. Sabit liste bir prefixin dusmesini davranis seviyesinde
  // yakalar; non-latin parcalar codePoint'ten kurulur.)
  const EXPECTED_PREFIXES = ['oda', 'room', 'zimmer', RU_ROOM, AR_ROOM, 'no', 'numara', 'number'];
  check('9a prefix listesi', ROOM_PREFIXES.join('|'), EXPECTED_PREFIXES.join('|'));

  // (iii) byte-esdegerlik
  const EXPECTED_ALT = EXPECTED_PREFIXES.join('|');
  check('9b ROOM_REGEX.source', ROOM_REGEX.source, `(?:${EXPECTED_ALT})?\\s*#?\\s*(\\d{2,4})`);
  check('9c STRIP.source', ROOM_PREFIX_STRIP_RE.source, `(?:${EXPECTED_ALT})`);
  // Bayrak muhru: ROOM_REGEX'e `g` EKLENIRSE String.match capture group DONDURMEZ
  // -> roomMatch[1] undefined, tum cagri yerleri oda numarasini kaybeder.
  check('9d ROOM_REGEX.flags', ROOM_REGEX.flags, 'i');
  check('9e STRIP.flags', ROOM_PREFIX_STRIP_RE.flags, 'gi');

  // (i) NEGATIF ZEMIN: ayni cumle prefixSIZ iken oda OKUNMAZ (miktar baglami)
  check('9f prefixsiz zemin', parseVerificationInput('312 icin 2 gece').roomNumber, null);

  EXPECTED_PREFIXES.forEach((p, i) => {
    // (i) prefixLI iken oda OKUNUR -> prefix alternasyonda gercekten var
    check(`9g[${i}] prefix odayi okur`, parseVerificationInput(`${p} 312 icin 2 gece`).roomNumber, '312');

    // (ii) prefix embedded-request'e SIZMAZ, talep icerigi KORUNUR
    const r = parseVerificationInput(`${p} 312 Ahmet Yilmaz klima bozuk`);
    check(`9h[${i}] embedded bayrak`, r.hasEmbeddedRequest, true);
    check(`9i[${i}] prefix sizmaz`, (r.embeddedRequest ?? '').toLowerCase().includes(p.toLowerCase()), false);
    check(`9j[${i}] talep korunur`, (r.embeddedRequest ?? '').includes('klima'), true);
  });
}

// ── (10) BACKLOG #5, 3. ve SON kopya: STOP_WORDS prefixleri ROOM_PREFIXES'ten ─
// Ayni 8 prefix ucuncu kez STOP_WORDS'te elle yaziliydi (ham AR literali dahil);
// artik spread ile geliyor. Bu bolum birlestirmenin kume ICERIGINI degistirmedigini
// ve listenin ileride SESSIZCE kaymayacagini kilitler.
{
  // (a) INVARYANT: her oda-prefixi ayni zamanda stop-word. Dusen bir prefix ISIM
  //     token'i sayilir ("oda 312 Ahmet" -> firstName='oda').
  check('10a her prefix stop-word', ROOM_PREFIXES.every((p) => STOP_WORDS.has(p)), true);
  // Non-latin prefixler ayrica codePoint needle ile (ters/bozuk gomulme kontrolu)
  check('10b ru prefix stop-word', STOP_WORDS.has(RU_ROOM), true);
  check('10c ar prefix stop-word', STOP_WORDS.has(AR_ROOM), true);

  // (b) BOYUT MUHRU: birlestirme oncesi de 110'du (dump SHA256 esdegerligi ile
  //     olculdu). Sessiz dusus/artis burada kirmizi doner.
  check('10d STOP_WORDS.size', STOP_WORDS.size, 110);

  // (c) isim-parse zemini: kritik NON-prefix stop-word'ler yerinde mi? Dususlerinde
  //     "oda 312 Ahmet Yilmaz klima bozuk" vakasinda 'klima'/'bozuk' ISIM token'i
  //     sayilir, firstName/lastName kayar (§5/§8/§9 coker).
  check('10e klima', STOP_WORDS.has('klima'), true);
  check('10f bozuk', STOP_WORDS.has('bozuk'), true);
  check('10g istiyorum', STOP_WORDS.has('istiyorum'), true);
  check('10h lastname', STOP_WORDS.has('lastname'), true);
}

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`IS8 verify-parse: ${pass}/${total} PASS`);
  for (const f of fails) console.error('  x ' + f);
  process.exit(1);
}
console.log(`IS8 verify-parse: ${pass}/${total} PASS`);
