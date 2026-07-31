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
import {
  guestText,
  normalizeGuestLang,
  resolvePreferredLang,
  readPreferredLang,
  withPreferredLang,
  ALL_GUEST_TEXT_KEYS,
  type GuestLang,
  type GuestTextKey,
} from '@/lib/i18n/guest-text';
import { extractPhone, toAsciiDigits } from '@/lib/utils/phone';
// §9 alerjen "yok" kapisi CANLI fonksiyondan gelir (kopya kalip YASAK). route.ts
// import edilebilir: modul seviyesinde yan etki/ag cagrisi yok, yalniz tanim var.
import {
  isNoAllergenAnswer,
  NO_ALLERGEN_LATIN,
  NO_ALLERGEN_NONLATIN,
} from '@/app/api/webhooks/telegram/[hotelSlug]/route';

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

// (8) AR YON KAPISI — kelime duzeyinde mantiksal-sira kaniti ─────────────────
// §7'nin tripwire'lari YAPISALdir (noktalama/virgul/kelime-basi). Bu bolum ONA
// DAYANMAZ: beklenen kelimeyi KOD NOKTASINDAN kurar ve `ar` metninde ARAR. Kaynak
// kod-noktasi oldugu icin editor/kopyalama katmani metni gorsel siraya cevirse
// bile bu satirlar DEGISMEZ — yani gordugumuz yesil, gercekten dogru siranin
// kanitidir (goz karari degil). DIS: ayni kelimenin TERS hali BULUNMAMALI.
const cp = (...a: number[]): string => String.fromCodePoint(...a);

const AR_WORD_MUST: Array<[GuestTextKey, string, string]> = [
  ['order_confirm_prompt', cp(0x0637, 0x0644, 0x0628, 0x0643), 'talebuk (siparis)'],
  ['order_preparing', cp(0x0637, 0x0644, 0x0628, 0x0643), 'talebuk (siparis)'],
  ['menu_photo_caption', cp(0x0642, 0x0627, 0x0626, 0x0645, 0x0629), 'kaimat (liste/menu)'],
  ['spa_contact_ask', cp(0x0641, 0x0631, 0x064a, 0x0642), 'fariq (ekip)'],
  ['spa_contact_thanks', cp(0x0641, 0x0631, 0x064a, 0x0642), 'fariq (ekip)'],
  ['allergen_ask_900ms', cp(0x062d, 0x0633, 0x0627, 0x0633, 0x064a, 0x0629), 'hasasiya (alerji)'],
  ['allergen_informed', cp(0x062d, 0x0633, 0x0627, 0x0633, 0x064a, 0x0629), 'hasasiya (alerji)'],
  ['allergen_verify_failed_max', cp(0x063a, 0x0631, 0x0641, 0x0629), 'gurfa (oda)'],
  ['btn_confirm_yes', cp(0x0646, 0x0639, 0x0645), 'naam (evet)'],
  ['btn_no_thanks', cp(0x0634, 0x0643, 0x0631), 'sukr (tesekkur)'],
  ['ai_fallback_received', cp(0x0631, 0x0633, 0x0627, 0x0644, 0x062a, 0x0643), 'risalatuk (mesajiniz)'],
];
for (const [k, word, label] of AR_WORD_MUST) {
  check(`8a[${k}] ar metni "${label}" kelimesini TASIYOR`, guestText(k, 'ar').includes(word), true);
}

// DIS: ayni kelimenin ters yazimi metinde BULUNMAMALI. Bu satirlar kirmiziya
// donerse metin gorsel-sirada kaydedilmis demektir (misafire anlamsiz metin gider).
const AR_WORD_MUST_NOT: Array<[GuestTextKey, string, string]> = [
  ['order_confirm_prompt', cp(0x0643, 0x0628, 0x0644, 0x0637), 'TERS talebuk'],
  ['allergen_informed', cp(0x0629, 0x064a, 0x0633, 0x0627, 0x0633, 0x062d), 'TERS hasasiya'],
];
for (const [k, word, label] of AR_WORD_MUST_NOT) {
  check(`8b[${k}] ar metni "${label}" TASIMIYOR`, guestText(k, 'ar').includes(word), false);
}

// (9) ALERJEN "yok" KAPISI — FONKSIYONEL (route.ts'ten GERCEK fonksiyon) ──────
// isNoAllergenAnswer canli kapinin ta kendisi (allergen_pending erken kapisi +
// status='none' dali ayni fonksiyonu cagirir); kopya kalip YOK. Girdiler kod
// noktasindan kurulur — testin kendi Arapca literali bozulsa bile olcut saglam.
const AR_NO = cp(0x0644, 0x0627);                                     // لا  = LAM+ALEF
const AR_NO_REVERSED = cp(0x0627, 0x0644);                            // ال  = ters yazim
const RU_NO = cp(0x043d, 0x0435, 0x0442);                             // нет
const AR_ALLERGY = cp(0x062d, 0x0633, 0x0627, 0x0633, 0x064a, 0x0629); // حساسية

// 9a — kalibin ICINDEKI Arapca "yok" LAM+ALEF sirasinda mi? Ters yazilmis olsaydi
// kalip derlenir, test yesil kalir ama CANLI misafirin «لا» cevabi ESLESMEZDI.
check('9a kalip LAM+ALEF (لا) tasiyor', NO_ALLERGEN_NONLATIN.source.includes(AR_NO), true);
check('9b kalip TERS yazimi (ال) TASIMIYOR', NO_ALLERGEN_NONLATIN.source.includes(AR_NO_REVERSED), false);
check('9c ters yazim girdi olarak ESLESMEZ', NO_ALLERGEN_NONLATIN.test(AR_NO_REVERSED), false);

// 9d/9e — misafir tek kelime yazdi → "alerjim yok" SAYILIR
check('9d «لا» tek basina -> none', isNoAllergenAnswer(AR_NO), true);
check('9e «нет» tek basina -> none', isNoAllergenAnswer(RU_NO), true);
check('9f «لا» noktalamali/bosluklu -> none', isNoAllergenAnswer(`  ${AR_NO}.  `), true);
check('9g «нет» buyuk harf -> none', isNoAllergenAnswer(RU_NO.toUpperCase()), true);

// 9h — GERCEK alerji bildirimi ASLA "yok" sayilmamali (M4: yanlis-negatif yasak)
check('9h "عندي حساسية" (alerjim var) -> none DEGIL',
  isNoAllergenAnswer(cp(0x0639, 0x0646, 0x062f, 0x064a) + ' ' + AR_ALLERGY), false);
// 9i — CAPA KANITI: cumle «لا» ile BASLIYOR ama alerji bildirimi ("fistik yiyemiyorum").
// Kalip gomulu arasaydi bu satir kirmizi olurdu ve misafirin alerjisi YUTULURDU.
const AR_CANNOT_EAT_PEANUTS = [
  cp(0x0644, 0x0627),                                                   // لا
  cp(0x0623, 0x0633, 0x062a, 0x0637, 0x064a, 0x0639),                   // أستطيع
  cp(0x0623, 0x0643, 0x0644),                                           // أكل
  cp(0x0627, 0x0644, 0x0641, 0x0648, 0x0644),                           // الفول
  cp(0x0627, 0x0644, 0x0633, 0x0648, 0x062f, 0x0627, 0x0646, 0x064a),   // السوداني
].join(' ');
check('9i «لا أستطيع أكل الفول السوداني» -> none DEGIL (capa calisiyor)',
  isNoAllergenAnswer(AR_CANNOT_EAT_PEANUTS), false);
check('9j Rusca gomulu ret+alerji -> none DEGIL',
  isNoAllergenAnswer(`${RU_NO}, ${cp(0x0430, 0x043b, 0x043b, 0x0435, 0x0440, 0x0433, 0x0438, 0x044f)}`), false);

// 9k — REGRESYON KILIDI: LATIN kalibi `\b` ASCII oldugu icin Kiril'i YAKALAMAZ.
// Bu satir "olu kod" gercegini kayda gecirir; 9l ise telafinin CALISTIGINI kanitlar.
check('9k LATIN kalibi «нет» yakalamaz (\\b ASCII-only)', NO_ALLERGEN_LATIN.test(RU_NO), false);
check('9l ama kapi yine de none doner (telafi)', isNoAllergenAnswer(RU_NO), true);
// Latin/TR yollari BOZULMADI
check('9m "yok" -> none', isNoAllergenAnswer('yok'), true);
check('9n "none" -> none', isNoAllergenAnswer('None'), true);
check('9o "nichts" -> none', isNoAllergenAnswer('nichts'), true);
check('9p "fistik alerjim var" -> none DEGIL', isNoAllergenAnswer('fistik alerjim var'), false);
check('9q "yoktur" -> none DEGIL (kelime siniri korunuyor)', isNoAllergenAnswer('yoktur'), false);

// ── (10) IS 10 — KALICI DIL: resolvePreferredLang + metadata yardimcilari ─────
// Callback turunda dil BASKA hicbir yerden bilinemez; bu zincir yanlissa order/note
// butonlarina basan Rus/Arap misafir yine Turkce cevap alir (Tier-2'nin sebebi).
check('10a detected stored\'in ONUNE gecer', resolvePreferredLang({ stored: 'ru', detected: 'de' }), 'de');
check('10b detected yoksa stored kazanir', resolvePreferredLang({ stored: 'ru', interfaceLang: 'tr' }), 'ru');
check('10c ikisi de yoksa arayuz dili', resolvePreferredLang({ interfaceLang: 'de' }), 'de');
check('10d hicbiri yoksa en', resolvePreferredLang({}), 'en');
check('10e bos string ATLANIR', resolvePreferredLang({ stored: '', interfaceLang: 'ru' }), 'ru');
check('10f null/undefined ATLANIR', resolvePreferredLang({ stored: null, detected: undefined, interfaceLang: 'ar' }), 'ar');
// Desteklenmeyen kod ALTA DUSMEZ -> 'en'. Duserse Fransizca yazana Rusca metin giderdi.
check('10g destek disi detected -> en (stored\'a DUSMEZ)', resolvePreferredLang({ stored: 'ru', detected: 'fr' }), 'en');
check('10h bicim normalize (en-US)', resolvePreferredLang({ detected: 'en-US' }), 'en');
check('10i bosluklu " AR "', resolvePreferredLang({ stored: ' AR ' }), 'ar');

check('10j metadata yoksa null', readPreferredLang(null), null);
check('10k metadata objesi degilse null', readPreferredLang('ru'), null);
check('10l alan yoksa null', readPreferredLang({ lead_capture: { topic: 'x' } }), null);
check('10m gecerli kod okunur', readPreferredLang({ preferred_language: 'ru' }), 'ru');
check('10n DESTEK DISI kod null (en DEGIL — "kayit yok" ile ayni degil)',
  readPreferredLang({ preferred_language: 'fr' }), null);
check('10o bos deger null', readPreferredLang({ preferred_language: '  ' }), null);
// MERGE kanit: diger anahtarlar KORUNUR (lead akisi ayni metadata'da yasiyor)
const mergedMeta = withPreferredLang({ lead_capture: { topic: 'dugun' } }, 'ru');
check('10p yazma sonrasi dil okunur', readPreferredLang(mergedMeta), 'ru');
check('10q yazma lead_capture\'i EZMEZ',
  JSON.stringify((mergedMeta as { lead_capture?: unknown }).lead_capture), JSON.stringify({ topic: 'dugun' }));
check('10r bos metadata uzerine yazilabilir', readPreferredLang(withPreferredLang(null, 'ar')), 'ar');

// ── (11) SOZLUGUN TAMAMI — 5 dilde DOLU ve BIRBIRINDEN FARKLI ────────────────
// Anahtar listesi ELDE tutulmaz: ALL_GUEST_TEXT_KEYS sozlukten turer, boylece
// union'a eklenen ama teste yazilmayan bir anahtar SESSIZCE kapsam disi kalamaz.
for (const k of ALL_GUEST_TEXT_KEYS) {
  for (const l of LANGS) {
    check(`11z[${k}/${l}] dolu`, guestText(k, l).trim().length > 0, true);
  }
  // TR ile RU/AR ayni string ise ceviri UNUTULMUS demektir (kopyala-yapistir tuzagi)
  check(`11y[${k}] ru != tr`, guestText(k, 'ru') === guestText(k, 'tr'), false);
  check(`11x[${k}] ar != tr`, guestText(k, 'ar') === guestText(k, 'tr'), false);
}

// Tier-2 anahtar listesi ASAGIDAKI AR yon kapisinin kapsamini tanimlar (§12).
const TIER2_KEYS: readonly GuestTextKey[] = [
  'cb_conv_missing', 'cb_generic_error', 'cb_unknown_action', 'cb_stale_button',
  'cb_lbl_processed', 'cb_already_processed',
  'order_sent_guest', 'order_cancelled_guest', 'order_already_processed',
  'order_lbl_cancelled', 'order_toast_cancelled', 'order_forward_failed',
  'order_lbl_approved', 'order_toast_sent', 'order_duplicate_recent',
  'note_already_done', 'note_ask_write', 'note_lbl_waiting', 'note_toast_write',
  'note_order_missing', 'note_lbl_cancel', 'note_lbl_continue', 'note_toast_awaiting',
  'hk_ask_towel_type', 'hk_lbl_bath_towel', 'hk_lbl_face_towel', 'hk_lbl_foot_towel',
  'hk_ask_qty', 'hk_ask_qty_labeled', 'hk_fwd_ok', 'hk_fwd_duplicate', 'hk_fwd_error',
  'hk_lbl_yes_now', 'hk_lbl_later', 'hk_toast_selected', 'hk_toast_invalid',
  'hk_complaint_confirm_ask', 'hk_complaint_later', 'hk_lbl_selected',
];
// Yer tutucu korunuyor mu (adet sorusu esya adini TASIMALI)
check('11d hk_ask_qty_labeled {esya} doldurulur',
  guestText('hk_ask_qty_labeled', 'ru', { esya: 'yastik' }).includes('yastik'), true);
check('11e hk_ask_qty yer tutucu TASIMAZ', guestText('hk_ask_qty', 'ar').includes('{'), false);

// ── (12) Tier-2 AR YON KAPISI — HER anahtar icin kelime duzeyinde sira kaniti ─
//
// §6'nin tripwire'lari YAPISALdir ve pratikte yalniz '؟' ile BITEN cumleleri
// yakalar; DUZ bir cumlenin ters kaydedilmesini yakalayamaz. §8'in olcutu ise
// dogrudan kelimeye bakar ve beklenen kelime KOD NOKTASINDAN kurulur — bu yuzden
// editorun/relay'in metni gorsel siraya cevirmesi bu satirlari YESIL BIRAKAMAZ.
// Burasi ayni olcutu Tier-2'nin TUM anahtarlarina uygular (kapsam bosluk birakmaz).
//
// Aranan kelimeler KOKtur (cekim eki degisse de tutar): "ملاحظتك" icinde "ملاحظ",
// "الطلب" icinde "طلب" gecer. Bu, note_ask_write'ta bir kez kirmizi vererek kendini
// gosterdi — ta marbuta'li tam bicim aranirsa cekimli kullanim KACAR.
const AR_ROOTS: Record<string, [number[], string]> = {
  talab:    [[0x0637, 0x0644, 0x0628], 'talab (talep/siparis)'],
  khata:    [[0x062e, 0x0637, 0x0623], 'khata (hata)'],
  sijil:    [[0x0633, 0x062c, 0x0644], 'sijil (kayit)'],
  maruf:    [[0x0645, 0x0639, 0x0631, 0x0648, 0x0641], 'maruf (bilinen)'],
  zir:      [[0x0632, 0x0631], 'zir (buton)'],
  muaalaj:  [[0x0645, 0x0639, 0x0627, 0x0644, 0x062c], 'mualaja KOKU (islem)'],
  khutwa:   [[0x062e, 0x0637, 0x0648, 0x0629], 'khutwa (adim)'],
  malumat:  [[0x0645, 0x0639, 0x0644, 0x0648, 0x0645], 'malum KOKU (bilgi)'],
  ilgha:    [[0x0625, 0x0644, 0x063a, 0x0627, 0x0621], 'ilgha (iptal)'],
  irsal:    [[0x0625, 0x0631, 0x0633, 0x0627, 0x0644], 'irsal (gonderim)'],
  takid:    [[0x062a, 0x0623, 0x0643, 0x064a, 0x062f], 'takid (onay)'],
  kitaba:   [[0x0643, 0x062a, 0x0627, 0x0628], 'kitab KOKU (yazma)'],
  mulahaz:  [[0x0645, 0x0644, 0x0627, 0x062d, 0x0638], 'mulahaz KOKU (not)'],
  intizar:  [[0x0627, 0x0646, 0x062a, 0x0638, 0x0627, 0x0631], 'intizar (bekleme)'],
  mutabaa:  [[0x0645, 0x062a, 0x0627, 0x0628, 0x0639, 0x0629], 'mutabaa (devam)'],
  minshafa: [[0x0645, 0x0646, 0x0634, 0x0641, 0x0629], 'minshafa (havlu)'],
  istihmam: [[0x0627, 0x0633, 0x062a, 0x062d, 0x0645, 0x0627, 0x0645], 'istihmam (banyo)'],
  wajh:     [[0x0648, 0x062c, 0x0647], 'wajh (yuz)'],
  aqdam:    [[0x0623, 0x0642, 0x062f, 0x0627, 0x0645], 'aqdam (ayaklar)'],
  turid:    [[0x062a, 0x0631, 0x064a, 0x062f], 'turid (istiyorsun)'],
  fariq:    [[0x0641, 0x0631, 0x064a, 0x0642], 'fariq (ekip)'],
  naam:     [[0x0646, 0x0639, 0x0645], 'naam (evet)'],
  laysa:    [[0x0644, 0x064a, 0x0633], 'laysa (degil)'],
  ikhtiyar: [[0x0627, 0x062e, 0x062a, 0x064a, 0x0627, 0x0631], 'ikhtiyar (secim)'],
  salih:    [[0x0635, 0x0627, 0x0644, 0x062d], 'salih (gecerli)'],
  natazir:  [[0x0646, 0x0639, 0x062a, 0x0630, 0x0631], 'natazir (ozur dileriz)'],
  turasil:  [[0x062a, 0x0631, 0x0627, 0x0633, 0x0644], 'turasil KOKU (yazmak)'],
};
// TIER2_KEYS'in TAMAMI kapsanir — eksik anahtar 12z'de kirmiziya doner.
const AR_TIER2_MUST: Array<[GuestTextKey, keyof typeof AR_ROOTS]> = [
  ['cb_conv_missing', 'sijil'],
  ['cb_generic_error', 'khata'],
  ['cb_unknown_action', 'maruf'],
  ['cb_stale_button', 'zir'],
  ['cb_lbl_processed', 'muaalaj'],
  ['cb_already_processed', 'khutwa'],
  ['order_sent_guest', 'talab'],
  ['order_cancelled_guest', 'malumat'],
  ['order_already_processed', 'talab'],
  ['order_lbl_cancelled', 'ilgha'],
  ['order_toast_cancelled', 'ilgha'],
  ['order_forward_failed', 'irsal'],
  ['order_lbl_approved', 'takid'],
  ['order_toast_sent', 'irsal'],
  // IS 2 DEDUP metni: "طلبك" (siparisiniz) icinde talab KOKU gecer
  ['order_duplicate_recent', 'talab'],
  ['note_already_done', 'khutwa'],
  ['note_ask_write', 'kitaba'],
  ['note_lbl_waiting', 'intizar'],
  ['note_toast_write', 'mulahaz'],
  ['note_order_missing', 'talab'],
  ['note_lbl_cancel', 'ilgha'],
  ['note_lbl_continue', 'mutabaa'],
  ['note_toast_awaiting', 'takid'],
  ['hk_ask_towel_type', 'minshafa'],
  ['hk_lbl_bath_towel', 'istihmam'],
  ['hk_lbl_face_towel', 'wajh'],
  ['hk_lbl_foot_towel', 'aqdam'],
  ['hk_ask_qty', 'turid'],
  ['hk_ask_qty_labeled', 'turid'],
  ['hk_fwd_ok', 'fariq'],
  ['hk_fwd_duplicate', 'fariq'],
  ['hk_fwd_error', 'khata'],
  ['hk_lbl_yes_now', 'naam'],
  ['hk_lbl_later', 'laysa'],
  ['hk_toast_selected', 'ikhtiyar'],
  ['hk_toast_invalid', 'salih'],
  ['hk_complaint_confirm_ask', 'natazir'],
  ['hk_complaint_later', 'turasil'],
  ['hk_lbl_selected', 'ikhtiyar'],
];
for (const [k, rootKey] of AR_TIER2_MUST) {
  const [pts, label] = AR_ROOTS[rootKey];
  const word = cp(...pts);
  const reversed = cp(...[...pts].reverse());
  // IC: mantiksal sirali kelime metinde VAR
  check(`12a[${k}] ar metni "${label}" TASIYOR`, guestText(k, 'ar').includes(word), true);
  // DIS: ayni kelimenin TERS yazimi metinde YOK (gorsel-sira kaydinin kesin isareti)
  check(`12b[${k}] ar metni TERS "${label}" TASIMIYOR`, guestText(k, 'ar').includes(reversed), false);
}
// KAPSAM KILIDI: Tier-2 anahtarlarinin HEPSI yon kapisindan gecmis olmali.
check('12z ar yon kapisi TUM Tier-2 anahtarlarini kapsiyor',
  new Set(AR_TIER2_MUST.map(([k]) => k)).size, TIER2_KEYS.length);

// AR metni '؟' (U+061F) ile BASLAMAMALI — bastaysa metin ters kaydedilmistir (§6 olcutu)
const AR_Q = 0x061f;
for (const k of TIER2_KEYS) {
  check(`12d[${k}] ar metni '؟' ile BASLAMIYOR`,
    guestText(k, 'ar').trimStart().codePointAt(0) === AR_Q, false);
}

// ── (13) note -> onay karti: yer tutucu ADI birebir eslesiyor mu? ────────────
// handle-note-callback `{ liste: itemsBlock }` gonderiyor; anahtar farkli bir ad
// bekliyorsa (or. {items}) guestText onu BOS string ile doldurur ve misafire
// URUNSUZ bir onay karti gider — sessiz veri kaybi.
for (const l of LANGS) {
  const filled = guestText('order_confirm_prompt', l, { liste: 'X1 × 2' });
  check(`13a[${l}] {liste} dolduruldu`, filled.includes('X1 × 2'), true);
  check(`13b[${l}] doldurulmamis yer tutucu KALMADI`, filled.includes('{'), false);
}

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
