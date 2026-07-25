/**
 * IS 17 — misafire donuk SABIT metinlerin dil secimi + telefon dedektorunun
 * rakam-script bagimsizligi (local, is8 korpusu).
 *
 * GERCEK modulleri import eder (kopya fonksiyon YASAK): `@/lib/i18n/guest-text` ve
 * `@/lib/utils/phone` saf modullerdir, canli kodun ta kendisi kosulur. Ag/LLM YOK.
 *
 * KAPSAM:
 *  - normalizeGuestLang: 5 dile indirgeme + bilinmeyen -> 'en'
 *  - guestText: TUM anahtarlar x 5 dil (IS 18 lead metinleri dahil), yer tutucu
 *    ({name}/{room}) doldurma, TR metnin route.ts'ten BIREBIR tasindiginin
 *    dogrulanmasi (davranis-notr kaniti)
 *  - extractPhone: AR/FA rakamlarinin ASCII'ye cevrilmesi + ASCII girdide bicimin
 *    AYNEN korundugu (regresyon)
 * DOGRULANAMAZ (canli UAT): metnin gercekten Telegram'da o dille gorunmesi.
 */
import { guestText, normalizeGuestLang, type GuestLang, type GuestTextKey } from '@/lib/i18n/guest-text';
import { extractPhone, toAsciiDigits } from '@/lib/utils/phone';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

const LANGS: readonly GuestLang[] = ['tr', 'en', 'de', 'ru', 'ar'];
const KEYS: readonly GuestTextKey[] = [
  'name_match_failed', 'reverify_updated', 'reverify_no_match', 'already_verified',
  // IS 18 — lead metinleri de ayni sozlukte (ikinci metin kaynagi YOK)
  'lead_ask_all', 'lead_ask_phone', 'lead_ask_name', 'lead_close', 'lead_thanks',
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
// TRIPWIRE: lojik-sirali Arapca'da cumle sonu noktalamasi ('.' U+002E veya '؟' U+061F)
// metnin SON kod noktasidir; BASINDA olmasi ters-siralamanin kesin isaretidir. Kontrol
// IS 18'de genellestirildi: lead metinleri soru degil RICA cumlesi ('.' ile biter) —
// yalniz '؟' arayan eski guard bu metinlerde ters-siralamayi KACIRIRDI.
// Ayrica her `ar` metni gercekten Arapca harf (U+0600-06FF) TASIMALI — bos/yanlis-dil
// kopyasi da burada yakalanir.
const AR_TEXTS: Array<[string, string]> = KEYS.map(
  (k) => [`guest-text/${k}`, guestText(k, 'ar')] as [string, string],
);
const QMARK_AR = 0x061f;
const DOT = 0x002e;
const isSentenceEnd = (cp: number | undefined): boolean => cp === QMARK_AR || cp === DOT;
// KARAKTER-KUMESI KONTROLU SAYISAL YAPILIR: regex karakter sinifina non-ASCII literal
// (veya \u kacisi) yazmak arac/editor katmaninda sessizce bozulabilir — bozulan aralik
// testi yanlis-yesil birakir. codePoint karsilastirmasi bu riski tamamen kaldirir.
const hasArabicChar = (s: string): boolean =>
  [...s].some((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c >= 0x0600 && c <= 0x06ff;
  });
for (const [label, s] of AR_TEXTS) {
  check(`6a[${label}] TERS DEGIL (noktalama basta olamaz)`, isSentenceEnd(s.trimStart().codePointAt(0)), false);
  check(`6b[${label}] Arapca harf tasiyor`, hasArabicChar(s), true);
  check(`6c[${label}] bos degil`, s.trim().length > 0, true);
  check(`6d[${label}] cumle noktalamasi SONDA`, isSentenceEnd([...s.trimEnd()].pop()?.codePointAt(0)), true);
}
// Soru cumlesi lojik siralamada '؟' ile BITER (ters olsaydi bitmezdi).
check('6d2 AR soru metni ? ile BITER',
  [...guestText('reverify_updated', 'ar', { name: 'محمد', room: '312' }).trimEnd()].pop()?.codePointAt(0) === QMARK_AR, true);
// Yer tutucu enjeksiyonu sirayi BOZMAMALI (RTL metne ASCII isim/oda girince de).
check('6e yer tutuculu AR metin hala ters DEGIL',
  isSentenceEnd(guestText('already_verified', 'ar', { name: 'John', room: '312' }).trimStart().codePointAt(0)), false);
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
const reversedSample = [...guestText('lead_ask_phone', 'ar')].reverse().join('');
check('6m tripwire ters metni YAKALAR', isSentenceEnd(reversedSample.trimStart().codePointAt(0)), true);
check('6n dogru metin tripwire i tetiklemez',
  isSentenceEnd(guestText('lead_ask_phone', 'ar').trimStart().codePointAt(0)), false);
// Ters cevrilmis SORU metni de yakalanmali ('؟' basa gecer) — iki noktalama da korunuyor
check('6o ters soru metni de YAKALANIR',
  isSentenceEnd([...guestText('reverify_updated', 'ar')].reverse().join('').trimStart().codePointAt(0)), true);

// (7) P7b — route.ts Tier-1 sabit metinleri ─────────────────────────────────
// 28 cagri sitesi / 27 anahtar route.ts'teki en/de/tr ucluleri yerine guestText'e
// baglandi. Burada dogrulanan: 5 dilin DOLU oldugu, ru/ar'in TR'ye DUSMEDIGI
// (sessiz TR-fallback en sinsi cok-dillilik hatasidir: kod calisir, misafir
// anlamadigi dili gorur) ve yer tutucularin 5 dilde de SAGLAM kaldigi.
// DOGRULANAMAZ (canli UAT): metnin Telegram'da o dille gorunmesi, buton etiketi.
const P7B_KEYS: readonly GuestTextKey[] = [
  'spa_contact_ask', 'spa_contact_thanks', 'order_preparing', 'order_invalid_code',
  'menu_photo_caption', 'menu_item_unavailable', 'order_note_ask_multi',
  'order_note_ask_single', 'order_confirm_prompt', 'order_confirm_prompt_freeform',
  'btn_confirm_yes', 'btn_cancel', 'btn_add_note', 'btn_no_note', 'btn_yes_show',
  'btn_no_thanks', 'allergen_ask_900ms', 'allergen_ack_short', 'allergen_ack_none',
  'allergen_informed', 'allergen_informed_ask_room', 'allergen_verify_format',
  'allergen_verify_success', 'allergen_verify_failed_max', 'allergen_verify_retry',
  'allergen_noted_meal', 'ai_fallback_received',
];
check('7-0 P7b anahtar sayisi 27', P7B_KEYS.length, 27);

// ── AR TRIPWIRE'LARI (T1-T4) ────────────────────────────────────────────────
// §6'daki tripwire (cumle noktalamasi BASTA olamaz) yalniz '.'/'؟' ile BITEN
// metinlerde dis tasir. P7b anahtarlarinin 12'si buton etiketi ya da Latin
// ornekle biten metin ('... مثال: 101 John Smith') — onlarda tek basina DISSIZ
// kalirdi, yani guard YANLIS-YESIL doner. Uc tripwire daha eklendi; asagidaki
// NEGATIF KONTROL her anahtar icin en az birinin ates ettigini KANITLAR.
const COMMA_AR = 0x060c;
const cpAt = (ch: string | undefined): number => ch?.codePointAt(0) ?? 0;
// Arapca yazimda KELIME BASINDA bulunamayan kod noktalari: ta marbuta (ة), yalin
// hamza (ء), hareke/tenvin. Ters cevrilmis metinde kelime SONLARI basa gecer.
const cannotStartWord = (c: number): boolean =>
  c === 0x0629 || c === 0x0621 || (c >= 0x064b && c <= 0x065f) || c === 0x0670;
// T1: cumle noktalamasi metnin BASINDA olamaz (§6 ile ayni olcut)
const arT1 = (s: string): boolean => isSentenceEnd(s.trimStart().codePointAt(0));
// T2: Arap virgulunun SOLU bosluk olamaz, SAGI bosluk ya da metin sonu olmali
const arT2 = (s: string): boolean => {
  const a = [...s];
  for (let i = 0; i < a.length; i++) {
    if (cpAt(a[i]) !== COMMA_AR) continue;
    if (a[i - 1] === undefined || /\s/.test(a[i - 1])) return true;
    if (a[i + 1] !== undefined && !/\s/.test(a[i + 1])) return true;
  }
  return false;
};
// T3: hicbir kelime yasakli kod noktasiyla baslayamaz
const arT3 = (s: string): boolean =>
  s.split(/\s+/).filter(Boolean).some((w) => cannotStartWord(cpAt(w)));
// T4: yer tutucu BIREBIR korunmali ('{liste}' ters cevrilince '}etsil{' olur)
const arT4 = (s: string, ps: readonly string[]): boolean => ps.some((p) => !s.includes(p));
const arTripped = (s: string, ps: readonly string[]): boolean =>
  arT1(s) || arT2(s) || arT3(s) || arT4(s, ps);

const P7B_PARAMS: Partial<Record<GuestTextKey, readonly string[]>> = {
  order_confirm_prompt: ['{liste}'],
  order_invalid_code: ['{liste}'],
  order_note_ask_multi: ['{liste}'],
  allergen_verify_success: ['{ad}'],
  allergen_verify_retry: ['{n}', '{max}'],
};

for (const k of P7B_KEYS) {
  const ps = P7B_PARAMS[k] ?? [];
  for (const l of LANGS) {
    check(`7a[${k}/${l}] metin dolu`, guestText(k, l).trim().length > 0, true);
    // Yer tutucu HER dilde durmali — bir dilde dusmusse o dilde {liste}/{ad} bos gider
    for (const p of ps) check(`7b[${k}/${l}] ${p} yer tutucusu duruyor`, guestText(k, l).includes(p), true);
  }
  // TR-FALLBACK YOK kaniti: ru/ar gercekten cevrilmis (kopyala-yapistir TR degil)
  check(`7c[${k}] ru != tr`, guestText(k, 'ru') !== guestText(k, 'tr'), true);
  check(`7d[${k}] ar != tr`, guestText(k, 'ar') !== guestText(k, 'tr'), true);
  check(`7e[${k}] 5 dil 5 ayri metin`, new Set(LANGS.map((l) => guestText(k, l))).size, 5);
  check(`7f[${k}] bilinmeyen dil -> en`, guestText(k, 'fr'), guestText(k, 'en'));
  check(`7g[${k}] ar Arapca harf tasiyor`, hasArabicChar(guestText(k, 'ar')), true);
  // POZITIF: dogru (lojik sirali) metin hicbir tripwire'i tetiklemez
  check(`7h[${k}] ar tripwire SESSIZ`, arTripped(guestText(k, 'ar'), ps), false);
  // NEGATIF KONTROL: ters cevrilmis metin en az bir tripwire'i tetiklemeli.
  // Bu satir olmadan guard'in o anahtarda DIS tasidigi bilinemez (yanlis-yesil).
  check(`7i[${k}] TERS ar metni YAKALANIR`, arTripped([...guestText(k, 'ar')].reverse().join(''), ps), true);
}

// (7j) YER TUTUCU DOLDURMA — 5 dilde de deger yerine oturur, artik '{' KALMAZ
for (const l of LANGS) {
  check(`7j[${l}] order_confirm_prompt {liste} doldu`,
    guestText('order_confirm_prompt', l, { liste: '• Cay x2' }).includes('• Cay x2'), true);
  check(`7k[${l}] order_confirm_prompt artik yer tutucu YOK`,
    guestText('order_confirm_prompt', l, { liste: 'X' }).includes('{'), false);
  check(`7l[${l}] allergen_verify_retry {n}/{max} doldu`,
    guestText('allergen_verify_retry', l, { n: '2', max: '3' }).includes('2/3'), true);
  check(`7m[${l}] allergen_verify_success {ad} doldu`,
    guestText('allergen_verify_success', l, { ad: 'Kemal' }).includes('Kemal'), true);
}
// Satir sonlari GERCEK satir sonu olmali (kodda `\n${itemsBlock}\n\n` vardi)
check('7n order_confirm_prompt TR satir yapisi',
  guestText('order_confirm_prompt', 'tr', { liste: 'A' }), 'Siparişiniz:\nA\n\nOnaylıyor musunuz?');
check('7o order_note_ask_multi TR satir yapisi (cift bosluk satiri)',
  guestText('order_note_ask_multi', 'tr', { liste: '1. Kofte' }).includes('\n\n1. Kofte\n\n'), true);

// (7p) TR metinler route.ts'ten BIREBIR — davranis-notr kaniti (§4 ile ayni amac).
// Yer tutuculu ve karar verilmis anahtarlar kilitlendi; bir sonraki duzenleme
// TR misafir metnini SESSIZCE degistiremez.
check('7p1 order_invalid_code TR',
  guestText('order_invalid_code', 'tr', { liste: 'RS01 - Cay' }), 'Yazdığınız kod menümüzde yok. Geçerli kodlar:\nRS01 - Cay');
check('7p2 order_confirm_prompt_freeform TR',
  guestText('order_confirm_prompt_freeform', 'tr'), 'Siparişinizi oluşturuyorum. Onaylarsanız ilgili ekibe hemen ileteceğim. Onaylıyor musunuz?');
check('7p3 allergen_verify_retry TR (TR bicimi EN/DE den farkli: "(n/max deneme)")',
  guestText('allergen_verify_retry', 'tr', { n: '1', max: '3' }), 'Oda numarası ve isim eşleşmedi (1/3 deneme). Lütfen tekrar deneyin. Örnek: 101 Kemal Kuyucu');
check('7p4 allergen_verify_success TR',
  guestText('allergen_verify_success', 'tr', { ad: 'Ayşe' }), 'Teşekkürler, Ayşe! Alerjiniz ilgili ekibimize iletildi. İyi konaklamalar!');
check('7p5 ai_fallback_received TR',
  guestText('ai_fallback_received', 'tr'), 'Mesajınız alındı, en kısa sürede ilgili departmandan dönüş yapılacaktır.');
// KARAR (P7b): not akisi (eski route.ts 1875/1876) ile siparis akisi ayni butonu
// farkli yaziyordu — not akisi ASCII ('onayliyorum'/'Vazgectim'), siparis akisi tam
// Turkce. Tek anahtara indirgenirken TAM TURKCE bicim secildi; asagidaki iki satir
// ASCII varyantinin geri sizmasini engeller.
check('7p6 btn_confirm_yes TR tam Turkce (ASCII varyant DUSTU)',
  guestText('btn_confirm_yes', 'tr'), 'Evet, onaylıyorum');
check('7p7 btn_cancel TR tam Turkce (ASCII varyant DUSTU)',
  guestText('btn_cancel', 'tr'), 'Vazgeçtim');

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
