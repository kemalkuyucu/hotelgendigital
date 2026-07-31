/**
 * IS 2 — tekrar-talep (DEDUP) benzerlik karari testi (local, is8 korpusu).
 *
 * GERCEK modul import edilir (src/lib/sla/duplicate-guard.ts) — kopya fonksiyon
 * YASAK: kopya 100/100 yesil donerken canli davranisla celisebilir (bu tuzak bir
 * kez yasandi). Ag/LLM/DB cagrisi YOK.
 *
 * KAPSANAN KARAR: normalize (normalizeTr + harf/rakam disi -> bosluk + kisa token
 * eleme) + Jaccard >= esik. Pencere/aday seti/bildirim BU MODULDE DEGIL (cagirana
 * ait) -> burada dogrulanamaz.
 *
 * IKI CAGRI PROFILI ayri ayri kilitlenir:
 *   housekeeping (varsayilan)  minTokenLength=3 -> tek haneli MIKTAR elenir,
 *                              "2 X" ile "3 X" AYNI sayilir (canli davranis).
 *   F&B siparis                minTokenLength=1 -> miktar TOKEN olur, "2 kahve"
 *                              ile "3 kahve" AYRI siparistir.
 *
 * (8) M2 KAPISI: bulanik dedup'in HANGI siparise uygulandigi karari
 * (isStructuredOrder, src/lib/menu/pending-order.ts). Kapinin cagri yerindeki
 * bagi (if bloguna alinmis olmasi) burada DEGIL — canli UAT / kod okumasi konusu.
 *
 * DOGRULANAMAZ (canli UAT): gercek sla_events adaylarinin geldigi, kartin
 * acilmadigi, misafire dup mesajinin ulastigi.
 */
import { isDuplicateRequest } from '@/lib/sla/duplicate-guard';
import { isStructuredOrder, formatOrderSummary, type StructuredOrder } from '@/lib/menu/pending-order';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// F&B cagri profili — handle-order-callback.ts ile BIREBIR ayni opts
const FB = { threshold: 0.5, minTokenLength: 1 } as const;

// ── (1) BIREBIR AYNI metin -> tekrar ────────────────────────────────────────
check('1a birebir ayni (varsayilan)', isDuplicateRequest('2 yuz havlusu', ['2 yuz havlusu']), true);
check('1b birebir ayni (F&B profili)', isDuplicateRequest('2 kahve istiyorum', ['2 kahve istiyorum'], FB), true);
check('1c coklu adayda ikincisi tutar',
  isDuplicateRequest('yastik lutfen', ['sampuan bitti', 'yastik lutfen']), true);
check('1d bosluk/noktalama farki onemsiz',
  isDuplicateRequest('  yuz havlusu,,,  ', ['yuz havlusu.']), true);

// ── (2) MIKTAR FARKI — iki profil AYRI karar verir ──────────────────────────
// Varsayilan (housekeeping): tek haneli rakam min-3 filtresine takilir -> elenir,
// geriye ayni kume kalir -> TEKRAR sayilir. Bu satir canli HK davranisini KILITLER;
// degisirse HK dedup'i sessizce gevsemis demektir.
check('2a HK profili: "2 cay" vs "3 cay" -> TEKRAR (rakam elenir)',
  isDuplicateRequest('2 cay', ['3 cay']), true);
check('2b HK profili: "2 yuz havlusu" vs "3 yuz havlusu" -> TEKRAR',
  isDuplicateRequest('2 yuz havlusu', ['3 yuz havlusu']), true);
// F&B: miktar gercek bir siparis farkidir -> TEKRAR DEGIL.
check('2c F&B profili: "2 cay" vs "3 cay" -> tekrar DEGIL',
  isDuplicateRequest('2 cay', ['3 cay'], FB), false);
check('2d F&B profili: ayni miktar hala TEKRAR',
  isDuplicateRequest('2 cay', ['2 cay'], FB), true);

// ── (3) GERCEK KART METNI (formatOrderSummary ciktisi) ──────────────────────
// Kod-bazli sipariste sla_events.request_text bu bicimdedir; '×' ve '💰' harf/rakam
// disi oldugu icin bosluga cevrilir. Fiyat da degistigi icin F&B profilinde iki
// farkli adet net ayrisir.
const sum = (qty: number, total: number) => `• Kahve × ${qty} = ${total} TL\n💰 Toplam: ${total} TL`;
check('3a ayni siparis ozeti -> TEKRAR', isDuplicateRequest(sum(2, 100), [sum(2, 100)], FB), true);
check('3b farkli adet+tutar -> tekrar DEGIL', isDuplicateRequest(sum(3, 150), [sum(2, 100)], FB), false);
// Serbest metin siparis (structured yok) — ayni cumle tekrar
check('3c serbest metin ayni cumle -> TEKRAR',
  isDuplicateRequest('club sandwich istiyorum', ['club sandwich istiyorum'], FB), true);

// ── (4) AYRIK KELIMELER -> tekrar DEGIL ─────────────────────────────────────
check('4a tamamen farkli talep', isDuplicateRequest('yastik lutfen', ['sampuan bitti']), false);
check('4b ortak kelime yok (F&B)', isDuplicateRequest('kahve', ['portakal suyu'], FB), false);
check('4c tek ortak kelime yetmez',
  isDuplicateRequest('banyo havlusu sampuan terlik', ['banyo bornoz sabun dis']), false);

// ── (5) ESIK SINIRI — 0.5 ALT / TAM / UST ───────────────────────────────────
// A={havlu,sabun}; B'ye eleman ekledikce Jaccard duser (kesisim 2 sabit).
const A = 'havlu sabun';
const B_UST = 'havlu sabun sampuan';            // inter 2 / uni 3 = 0.667 > 0.5
const B_TAM = 'havlu sabun sampuan terlik';     // inter 2 / uni 4 = 0.500 = esik
const B_ALT = 'havlu sabun sampuan terlik bornoz'; // inter 2 / uni 5 = 0.400 < esik
check('5a esik USTU (0.667) -> TEKRAR', isDuplicateRequest(A, [B_UST]), true);
check('5b TAM esik (0.500) -> TEKRAR (>= karsilastirmasi)', isDuplicateRequest(A, [B_TAM]), true);
check('5c esik ALTI (0.400) -> tekrar DEGIL', isDuplicateRequest(A, [B_ALT]), false);
// Esik parametresi gercekten okunuyor mu: AYNI cift, farkli esik -> farkli karar
check('5d threshold 0.4 ile esik-alti cift TEKRAR olur',
  isDuplicateRequest(A, [B_ALT], { threshold: 0.4 }), true);
check('5e threshold 0.7 ile esik-ustu cift tekrar DEGIL',
  isDuplicateRequest(A, [B_UST], { threshold: 0.7 }), false);

// ── (6) BOS / ANLAMSIZ GIRDI -> daima tekrar DEGIL (bias: kayip talep yasak) ─
check('6a aday listesi bos', isDuplicateRequest('2 yuz havlusu', []), false);
check('6b newText bos', isDuplicateRequest('', ['2 yuz havlusu']), false);
check('6c aday bos string', isDuplicateRequest('2 yuz havlusu', ['']), false);
check('6d ikisi de bos', isDuplicateRequest('', ['']), false);
// Yalnizca kisa tokenlerden olusan metin: varsayilan profilde kume BOSALIR -> false.
check('6e sadece kisa token (varsayilan) -> tekrar DEGIL', isDuplicateRequest('2 3', ['2 3']), false);
check('6f ayni metin F&B profilinde TEKRAR (token elenmiyor)', isDuplicateRequest('2 3', ['2 3'], FB), true);
check('6g noktalama-only metin', isDuplicateRequest('...', ['...'], FB), false);

// ── (7) TR DIYAKRITIK — normalizeTr paylasimi (ikinci normalizer YOK) ───────
check('7a "çay şeker" == "cay seker"', isDuplicateRequest('çay şeker', ['cay seker']), true);
check('7b buyuk/kucuk harf farki', isDuplicateRequest('YÜZ HAVLUSU', ['yüz havlusu']), true);
check('7c TR I/i tuzagi ("İSTİYORUM" vs "istiyorum")',
  isDuplicateRequest('İSTİYORUM havlu', ['istiyorum havlu']), true);
check('7d "ığüşöç" tam kume', isDuplicateRequest('ığüşöç kelime', ['igusoc kelime']), true);
// Diyakritik normalize FARKLI kelimeleri ayni yapmamali
check('7e farkli kelimeler diyakritikten sonra da farkli',
  isDuplicateRequest('şeker', ['seker suyu portakal limon'], FB), false);

// ── (8) M2 KAPISI — bulanik dedup YALNIZ yapili (kod-bazli) sipariste ───────
// backlog #1: serbest metinde Jaccard TAM esige denk gelip GERCEK ikinci siparisi
// blokluyordu. Kapi handle-order-callback.ts'te: isStructuredOrder(structured)
// false ise isDuplicateRequest HIC cagrilmaz. Asagidaki iki satir KOK SORUNU
// (benzerlik gercekten >= 0.5) ve KAPININ kararini (yapili degil) AYRI AYRI
// kilitler; birlesimleri "bu cift artik bloklanmaz" demektir.
const BACKLOG_NEW = 'bir kahve daha istiyorum'; // {bir,kahve,daha,istiyorum}
const BACKLOG_OLD = 'kahve istiyorum';          // {kahve,istiyorum} -> 2/4 = 0.500
check('8a kok sorun: serbest-metin cifti TAM 0.5 -> guard TEK BASINA tekrar der',
  isDuplicateRequest(BACKLOG_NEW, [BACKLOG_OLD], FB), true);
check('8b serbest metin (structured yok) -> M2 kapisi KAPALI',
  isStructuredOrder(null), false);

// Yapili siparis MUHRU: kapi ACIK kalir ve identik ozet HALA tekrar sayilir.
const mkOrder = (qty: number, unitPrice: number): StructuredOrder => ({
  raw: `RS03 ${qty}`,
  lines: [{ code: 'RS03', name: 'Kahve', unitPrice, qty, lineTotal: unitPrice * qty }],
  total: unitPrice * qty,
  currency: 'TRY',
});
const RS03_2 = mkOrder(2, 50);
const RS03_3 = mkOrder(3, 50);
check('8c yapili siparis -> M2 kapisi ACIK', isStructuredOrder(RS03_2), true);
check('8d identik yapili siparis ozeti HALA tekrar (gercek formatOrderSummary)',
  isDuplicateRequest(formatOrderSummary(RS03_2), [formatOrderSummary(RS03_2)], FB), true);
check('8e farkli adet+tutar -> tekrar DEGIL (0.43 < 0.5)',
  isDuplicateRequest(formatOrderSummary(RS03_3), [formatOrderSummary(RS03_2)], FB), false);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
