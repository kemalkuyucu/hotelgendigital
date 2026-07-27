// ── ETKINLIK / ILETISIM FORWARD KAPISI (IS 17) ───────────────────────────────
//
// SAF MODUL: IO yok, ag yok, LLM cagrisi yok. classify-and-respond.ts LEG(a) ve
// LEG(b2) kararlarinin TEK KAYNAGI — burada yasar, orada yalnizca UYGULANIR.
//
// NEDEN AYRI DOSYA: karar mantigi classify-and-respond.ts icinde local const iken
// is8 testi onu AYNALAMAK zorundaydi (o dosya callAI import ettigi icin offline
// kosulamiyor). Ayna = kopya fonksiyon tuzagi (kopya YESIL doner, canli davranisla
// celisir). Karar buraya cikinca test GERCEK modulu import eder.
//
// IS 17 (cok dillilik): forward karari artik IKI kaynakli —
//   1) BIRINCIL: LLM'in `event_contact_request` etiketi (dil-BAGIMSIZ; KALICI KARAR #3
//      uyarinca LLM'e uygun is = intent ETIKETI, forward karari degil — bayragi
//      forward'a ceviren kod HALA burasi).
//   2) BACKSTOP: asagidaki TR keyword mantigi (IS 13'ten AYNEN korunur; LLM alani
//      hic gelmezse veya false gelirse TR yol eskisi gibi calisir -> regresyon yok).

import { normalizeTr } from '@/lib/utils/normalize-tr';

/**
 * Etkinlik konusu kokleri. Cogu SUBSTRING (TR ekleri serbest kalsin: "dugunumuz",
 * "organizasyonu", "toplantiya"). Uc tanesi kelime-siniri tasir cunku substring
 * hali gunluk kelimelerin ICINDE geciyordu:
 *   \bkina     -> "makina" ESLESMEZ (bas siniri yeterli; "kinamiz/kinaya" eslesir)
 *   \bbalo(?!n)-> "balon/balonlar" ESLESMEZ ("balomuz/balo salonu" eslesir)
 *   \bdavet(?!siz) -> "davetsiz" ESLESMEZ ("davetiniz/davetiye" eslesir)
 * Girdi normalizeTr'den GECMIS metindir (kucuk harf + TR diyakritigi katlanmis),
 * bu yuzden regex'lerde `i` bayragi gereksiz.
 */
export const EVENT_KEYWORD_RES: readonly RegExp[] = [
  /dugun/,
  /nikah/,
  /organizasyon/,
  /etkinlik/,
  /kongre/,
  /seminer/,
  /toplant/,
  /grup rezervasyon/,
  /\bkina/,
  /\bbalo(?!n)/,
  /\bdavet(?!siz)/,
];

/** Etkinligi TALEBE ceviren sinyaller (bilgi sorusundan ayirir). */
export const EVENT_REQUEST_SIGNALS: readonly string[] = [
  'organize', 'yaptirmak', 'planl', 'teklif', 'fiyat al', 'rezerv',
  'kimle gorus', 'beni ara', 'iletisim', 'gorusme', 'yetkili',
];

/** Konudan BAGIMSIZ acik iletisim/geri-arama talebi. */
export const CONTACT_SIGNALS: readonly string[] = [
  'kimle gorus', 'beni ara', 'iletisime gec', 'baglayabilir', 'yetkiliyle gorus',
];

/** Forward'siz "ilettim" vaadi (LEG b2 ikincil backstop — TR-only, bilinen sinir). */
export const PROMISE_SIGNALS: readonly string[] = [
  'ilettim', 'ilgili ekib', 'aktardim', 'iletiyorum', 'gorusulecek', 'talebinizi aldim',
];

export function hasEventKeyword(normalizedMsg: string): boolean {
  return EVENT_KEYWORD_RES.some((re) => re.test(normalizedMsg));
}

export function hasEventRequestSignal(normalizedMsg: string): boolean {
  return EVENT_REQUEST_SIGNALS.some((k) => normalizedMsg.includes(k));
}

export function hasContactSignal(normalizedMsg: string): boolean {
  return CONTACT_SIGNALS.some((k) => normalizedMsg.includes(k));
}

/**
 * FIYAT KAPISI NEGATIF GUARD (route.ts) — `isSpaContext` ikizi (b7b407b ayni deseni
 * spa icin kurmustu).
 *
 * KOK NEDEN (canli, 2026-07-28): canli fiyat kapisi classify'dan ONCE calisip
 * `return` ediyor. "dugun organizasyonu icin fiyat almak istiyoruz" mesaji
 * detectPriceIntent'e EVET dedirtip oraya takiliyor, bu yuzden
 * `decideEventContactForward` ve lead akisi HIC calismiyordu; misafire etkinlik
 * yerine oda fiyati icin tarih/kisi sayisi soruluyordu.
 *
 * Bu predicate KARAR VERMEZ — yalnizca mesajin event kapisina ULASMASINI saglar
 * (`decideEventContactForward` DEGISMEDI). Ikinci bir dedektor de degildir:
 * ayni dosyadaki hasEventKeyword / hasEventRequestSignal / hasContactSignal beslenir.
 *
 * AND sarti BILINCLI — keyword TEK BASINA yetmez: "dugun yapiyor musunuz",
 * "balo salonu kac kisilik" duz BILGI sorulari fiyat/KB akisinda KALIR.
 */
export function preferEventOverPrice(rawText: string): boolean {
  const n = normalizeTr(String(rawText ?? ''));
  return hasEventKeyword(n) && (hasEventRequestSignal(n) || hasContactSignal(n));
}

export interface EventContactDecision {
  forward: boolean;
  /** Karari KIM verdi — log/teshis icin. */
  source: 'llm' | 'tr-keyword' | 'none';
}

/**
 * Etkinlik/iletisim BILDIRIMI forward edilsin mi?
 *
 * @param guestMessage             misafirin HAM mesaji (normalizeTr burada uygulanir)
 * @param llmEventContactRequest   LLM `event_contact_request` alani; alan yoksa null
 * @param hasOperationalOrComplaintIntent
 *        Bu turda operasyonel (hk/teknik/fb/spa/animation/room_service) veya
 *        sikayet/alerji intent'i VAR mi? TRUE ise "tek basina iletisim sinyali"
 *        backstop'u DEVRE DISI kalir: "klimam bozuk, yetkiliyle gorusmek istiyorum"
 *        bir LEAD degildir — teknik talebi/sikayeti kendi departman akisinda kalmali,
 *        misafirden telefon istenmemelidir. (Etkinlik keyword + talep sinyali
 *        kombinasyonu bundan ETKILENMEZ: "dugun organizasyonu" gercekten etkinliktir.)
 */
export function decideEventContactForward(p: {
  guestMessage: string;
  llmEventContactRequest: boolean | null;
  hasOperationalOrComplaintIntent: boolean;
}): EventContactDecision {
  if (p.llmEventContactRequest === true) return { forward: true, source: 'llm' };

  const n = normalizeTr(p.guestMessage);
  const kwReq = hasEventKeyword(n) && hasEventRequestSignal(n);
  const contactOnly = hasContactSignal(n) && !p.hasOperationalOrComplaintIntent;

  return kwReq || contactOnly
    ? { forward: true, source: 'tr-keyword' }
    : { forward: false, source: 'none' };
}

/**
 * LEG(b2) ikincil backstop: cevap metninde TR forward-vaadi var mi?
 * Birincil sinyal LLM'in `claims_forward` alanidir (dil-bagimsiz); bu tarama
 * alan hic gelmezse VEYA LLM false derken metinde TR vaat kacarsa devreye girer.
 */
export function hasForwardPromiseTr(replyText: string): boolean {
  const raw = String(replyText ?? '');
  if (!raw.trim()) return false;
  const n = normalizeTr(raw);
  return PROMISE_SIGNALS.some((s) => n.includes(s));
}

/**
 * LEG(b2): sahte-vaat backstop'u ateslensin mi?
 * Kosul = "hicbir forward YOK" **VE** "cevapta iletme vaadi VAR".
 * Vaat sinyali: LLM `claims_forward` (BIRINCIL, dil-bagimsiz) VEYA TR metin taramasi
 * (IKINCIL). OR'dur: LLM alani gelmese de, LLM false derken TR vaat kacsa da yakalanir.
 */
export function shouldFireFalsePromiseGuard(p: {
  anyForward: boolean;
  llmClaimsForward: boolean | null;
  replyText: string;
}): boolean {
  if (p.anyForward) return false;
  return p.llmClaimsForward === true || hasForwardPromiseTr(p.replyText);
}
