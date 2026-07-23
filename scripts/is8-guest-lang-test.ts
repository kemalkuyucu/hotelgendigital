/**
 * IS 17 — misafire donuk SABIT metinlerin dil secimi + telefon dedektorunun
 * rakam-script bagimsizligi (local, is8 korpusu).
 *
 * GERCEK modulleri import eder (kopya fonksiyon YASAK): `@/lib/i18n/guest-text` ve
 * `@/lib/utils/phone` saf modullerdir, canli kodun ta kendisi kosulur. Ag/LLM YOK.
 *
 * KAPSAM:
 *  - normalizeGuestLang: 5 dile indirgeme + bilinmeyen -> 'en'
 *  - guestText: 4 anahtar x 5 dil, yer tutucu ({name}/{room}) doldurma, TR metnin
 *    route.ts'ten BIREBIR tasindiginin dogrulanmasi (davranis-notr kaniti)
 *  - extractPhone: AR/FA rakamlarinin ASCII'ye cevrilmesi + ASCII girdide bicimin
 *    AYNEN korundugu (regresyon)
 * DOGRULANAMAZ (canli UAT): metnin gercekten Telegram'da o dille gorunmesi.
 */
import { guestText, normalizeGuestLang, type GuestLang, type GuestTextKey } from '@/lib/i18n/guest-text';
import { extractPhone, toAsciiDigits } from '@/lib/utils/phone';
import {
  leadAskName, leadAskPhone, leadRetryPhone, leadClose, leadThanks, buildAskPhone,
} from '@/lib/lead/lead-capture';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

const LANGS: readonly GuestLang[] = ['tr', 'en', 'de', 'ru', 'ar'];
const KEYS: readonly GuestTextKey[] = [
  'name_match_failed', 'reverify_updated', 'reverify_no_match', 'already_verified',
];

// (1) normalizeGuestLang — desteklenen kume aynen, gerisi 'en'
check('1a tr', normalizeGuestLang('tr'), 'tr');
check('1b en', normalizeGuestLang('en'), 'en');
check('1c de', normalizeGuestLang('de'), 'de');
check('1d ru', normalizeGuestLang('ru'), 'ru');
check('1e ar', normalizeGuestLang('ar'), 'ar');
check('1f fr -> en (destek disi)', normalizeGuestLang('fr'), 'en');
check('1g es -> en', normalizeGuestLang('es'), 'en');
check('1h en-US -> en', normalizeGuestLang('en-US'), 'en');
check('1i de_DE -> de', normalizeGuestLang('de_DE'), 'de');
check('1j TR buyuk harf -> tr', normalizeGuestLang('TR'), 'tr');
check('1k bos -> en', normalizeGuestLang(''), 'en');
check('1l null -> en', normalizeGuestLang(null), 'en');
check('1m undefined -> en', normalizeGuestLang(undefined), 'en');
check('1n bosluklu " ru " -> ru', normalizeGuestLang(' ru '), 'ru');
check('1o tanimsiz kod -> en', normalizeGuestLang('zz'), 'en');

// (2) guestText — her anahtar her dilde DOLU ve diller BIRBIRINDEN farkli
for (const k of KEYS) {
  for (const l of LANGS) {
    check(`2a[${k}/${l}] metin dolu`, guestText(k, l).trim().length > 0, true);
  }
  check(`2b[${k}] 5 dil 5 ayri metin`, new Set(LANGS.map((l) => guestText(k, l))).size, 5);
  check(`2c[${k}] bilinmeyen dil -> en`, guestText(k, 'fr'), guestText(k, 'en'));
}

// (3) YER TUTUCU — {name} / {room} doldurulur, eksik param BOS string olur
//     (route.ts'teki mevcut `${x ?? ''}` davranisinin aynisi)
check('3a name doldurulur',
  guestText('already_verified', 'tr', { name: 'Kemal' }), 'Bilgileriniz zaten doğrulanmış, Kemal Bey. Bir talebiniz olduğunda yazmanız yeterli.');
check('3b name+room doldurulur (tr)',
  guestText('reverify_updated', 'tr', { name: 'Kemal', room: '312' }),
  'Bilgilerinizi güncelledim, Kemal Bey. Şu an 312 numaralı odada konakladığınızı kayıt ettim. Talebinizi iletmemi ister misiniz?');
check('3c name+room doldurulur (en)',
  guestText('reverify_updated', 'en', { name: 'John', room: '408' }),
  "I've updated your information, John. I've recorded that you are now in room 408. Would you like me to forward your request?");
check('3d eksik param bos string',
  guestText('already_verified', 'tr', { name: null }), 'Bilgileriniz zaten doğrulanmış,  Bey. Bir talebiniz olduğunda yazmanız yeterli.');
check('3e params verilmezse yer tutucu KALIR (cagiran unutmus -> gorunur olsun)',
  guestText('already_verified', 'tr').includes('{name}'), true);
check('3f yer tutucusuz anahtarda params zararsiz',
  guestText('reverify_no_match', 'tr', { name: 'X' }), guestText('reverify_no_match', 'tr'));
check('3g RU metninde yer tutucu doldu',
  guestText('reverify_updated', 'ru', { name: 'Иван', room: '204' }).includes('Иван'), true);
check('3h AR metninde oda no doldu',
  guestText('reverify_updated', 'ar', { name: 'محمد', room: '77' }).includes('77'), true);

// (4) TR metinler route.ts'ten BIREBIR tasindi — davranis-notr kaniti.
//     (Bu satirlar degisirse mevcut TR misafir deneyimi SESSIZCE degismis olur.)
check('4a name_match_failed TR',
  guestText('name_match_failed', 'tr'), 'İsminizi eşleştiremedik. Ön büromuz sizinle iletişime geçecek, lütfen bekleyiniz.');
check('4b reverify_no_match TR',
  guestText('reverify_no_match', 'tr'), 'Verdiğiniz bilgilerle in-house listesinde eşleşme bulamadım. Ön büromuza yönlendiriyorum, sizinle ilgilenecekler.');
check('4c reverify_no_match EN',
  guestText('reverify_no_match', 'en'), "I couldn't find a match for the details you provided. Our front desk will assist you.");
check('4d reverify_no_match DE',
  guestText('reverify_no_match', 'de'), 'Die von Ihnen angegebenen Daten konnten nicht gefunden werden. Unsere Rezeption wird Ihnen helfen.');
// TAM Turkce karakter kurali: TR metinlerde ASCII yaklastirmasi OLMAMALI
check('4e TR metinlerde Turkce karakter korunur',
  KEYS.every((k) => /[çğıöşüÇĞİÖŞÜ]/.test(guestText(k, 'tr'))), true);

// (5) TELEFON — AR/FA rakamlari ASCII'ye cevrilir (yoksa lead "numarani alamadim" der)
check('5a Arap-Hint rakam -> ASCII', toAsciiDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
check('5b Fars rakam -> ASCII', toAsciiDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
check('5c ASCII girdi degismez', toAsciiDigits('0532 123 45 67'), '0532 123 45 67');
check('5d harfler korunur', toAsciiDigits('رقمي ٠٥٣٢'), 'رقمي 0532');
check('5e AR rakamli numara yakalanir', extractPhone('رقمي ٠٥٣٢١٢٣٤٥٦٧'), '05321234567');
check('5f FA rakamli numara yakalanir', extractPhone('شماره من ۰۵۳۲۱۲۳۴۵۶۷'), '05321234567');
check('5g AR rakam + ayrac korunur', extractPhone('٠٥٣٢ ١٢٣ ٤٥ ٦٧'), '0532 123 45 67');
// REGRESYON: ASCII girdide bicim AYNEN korunur, kisa sayilar telefon DEGIL
check('5h ASCII bicim aynen', extractPhone('numaram +90 532 123 45 67'), '+90 532 123 45 67');
check('5i bitisik format', extractPhone('05321234567'), '05321234567');
check('5j oda no telefon DEGIL', extractPhone('102'), null);
check('5k AR kisa sayi telefon DEGIL', extractPhone('١٠٢'), null);
check('5l telefon yok', extractPhone('merhaba'), null);
check('5m bos girdi', extractPhone(''), null);

// (6) RTL / BIDI REGRESYON GUARD ──────────────────────────────────────────────
// KOK RISK: Arapca metin bir editorde/kopyalamada GORSEL sirada kaydedilirse
// (harfler ters, soru isareti basta) kod derlenir, test yesil kalir, ama misafire
// ANLAMSIZ metin gider — gozle fark edilmesi cok zor.
// TRIPWIRE: lojik-sirali Arapca'da '؟' (U+061F) cumlenin SON kod noktasidir; metnin
// BASINDA olmasi ters-siralamanin kesin isaretidir. Ayrica her `ar` metni gercekten
// Arapca harf (U+0600-06FF) TASIMALI — bos/yanlis-dil kopyasi da burada yakalanir.
const AR_TEXTS: Array<[string, string]> = [
  ...KEYS.map((k) => [`guest-text/${k}`, guestText(k, 'ar')] as [string, string]),
  ['lead/ask_name', leadAskName('ar')],
  ['lead/ask_phone', leadAskPhone('ar')],
  ['lead/retry_phone', leadRetryPhone('ar')],
  ['lead/close', leadClose('ar')],
  ['lead/thanks', leadThanks('ar')],
  ['lead/ask_phone_named', buildAskPhone('محمد', 'ar')],
];
const QMARK_AR = 0x061f;
// KARAKTER-KUMESI KONTROLU SAYISAL YAPILIR: regex karakter sinifina non-ASCII literal
// (veya \u kacisi) yazmak arac/editor katmaninda sessizce bozulabilir — bozulan aralik
// testi yanlis-yesil birakir. codePoint karsilastirmasi bu riski tamamen kaldirir.
const hasArabicChar = (s: string): boolean =>
  [...s].some((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c >= 0x0600 && c <= 0x06ff;
  });
for (const [label, s] of AR_TEXTS) {
  check(`6a[${label}] TERS DEGIL ('؟' basta olamaz)`, s.trimStart().codePointAt(0) === QMARK_AR, false);
  check(`6b[${label}] Arapca harf tasiyor`, hasArabicChar(s), true);
  check(`6c[${label}] bos degil`, s.trim().length > 0, true);
}
// Soru metinleri lojik siralamada '؟' ile BITER (ters olsaydi bitmezdi).
const AR_QUESTIONS: Array<[string, string]> = [
  ['lead/ask_name', leadAskName('ar')],
  ['lead/ask_phone', leadAskPhone('ar')],
  ['lead/retry_phone', leadRetryPhone('ar')],
  ['lead/ask_phone_named', buildAskPhone('محمد', 'ar')],
  ['guest-text/reverify_updated', guestText('reverify_updated', 'ar', { name: 'محمد', room: '312' })],
];
for (const [label, s] of AR_QUESTIONS) {
  check(`6d[${label}] soru '؟' ile BITER`, [...s.trimEnd()].pop()?.codePointAt(0) === QMARK_AR, true);
}
// Yer tutucu enjeksiyonu sirayi BOZMAMALI (RTL metne ASCII isim/oda girince de).
check('6e yer tutuculu AR metin hala ters DEGIL',
  guestText('already_verified', 'ar', { name: 'John', room: '312' }).trimStart().codePointAt(0) === QMARK_AR, false);
// AR rakam normalizasyonu: sinir degerleri (ilk/son hane) — ters aralik burada yakalanir
check('6f AR ilk hane (U+0660) -> 0', toAsciiDigits('٠'), '0');
check('6g AR son hane (U+0669) -> 9', toAsciiDigits('٩'), '9');
check('6h FA ilk hane (U+06F0) -> 0', toAsciiDigits('۰'), '0');
check('6i FA son hane (U+06F9) -> 9', toAsciiDigits('۹'), '9');
check('6j aralik disi Arapca harf ASLA rakam olmaz', toAsciiDigits('م'), 'م');
check('6k aralik disi (U+065F) dokunulmaz', toAsciiDigits('ٟ'), 'ٟ');
check('6l aralik disi (U+066A yuzde) dokunulmaz', toAsciiDigits('٪'), '٪');
// NEGATIF KONTROL — guard'in YANLIS-YESIL olmadigi kaniti: bilincli ters cevrilmis
// bir metinde tripwire ATES ETMELI. (Ters cevirme YALNIZ burada, teshis amacli;
// kaynak metinlere programatik reverse UYGULANMAZ — tanwin/ligature bozar.)
const reversedSample = [...leadAskPhone('ar')].reverse().join('');
check('6m tripwire ters metni YAKALAR', reversedSample.trimStart().codePointAt(0) === QMARK_AR, true);
check('6n dogru metin tripwire i tetiklemez', leadAskPhone('ar').trimStart().codePointAt(0) === QMARK_AR, false);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
