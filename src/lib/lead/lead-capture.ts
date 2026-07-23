// ── LEAD CAPTURE — etkinlik/organizasyon talebinde ad-soyad + telefon toplama ──
//
// SAF MODUL: IO yok, ag yok, LLM yok. Butun kararlar deterministik (KALICI KARAR #3);
// route.ts yalnizca bu modulun verdigi karari uygular.
//
// NEDEN VAR: sorumlu lead'e ulasamiyordu. inhouse_guests_v2'de telefon/e-posta
// kolonu YOK, Telegram da numara vermiyor; disaridan yazan (inhouse olmayan)
// kiside elde sadece Telegram profil adi kaliyor. Cozum: bot SORAR.
//
// AKIS:
//   1) Etkinlik/iletisim talebi  -> On Buro'ya "iletisim bekleniyor" ARA-KART
//      (message_id state'e yazilir) + misafire deterministik soru.
//   2) Sonraki mesaj(lar)        -> isim turu / telefon turu (asagidaki advanceLead).
//   3) Telefon gelince           -> ara-kart editMessageText ile TEK temiz karta doner.
//
// STATE conversations.metadata jsonb icinde tasinir: yeni kolon/MIGRATION GEREKMEZ
// (canli schema_migrations tutarsizligina bulasmamak icin bilincli tercih).
// DB kaydi YOK — bu akis yalnizca bildirimdir (karar: notify-only).
//
// Misafire giden metinler TAM Turkce karakterli ve SABIT (prompt degil): forward'i
// kesen/yoneten kapinin metni de deterministik olmali (SAHTE VAAT YASAGI).
//
// IS 17 (cok dillilik): metinler ARTIK dil-basina STATIK map. LLM'e metin YAZDIRILMAZ;
// yalnizca DIL kodu LLM'den gelir (classify `language`) ve state'te tasinir — boylece
// sonraki turlar (isim/telefon) da ayni dilde sorulur. Personel KARTLARI TR kalir.

import { extractPhone } from '@/lib/utils/phone';
import { normalizeGuestLang, type GuestLang } from '@/lib/i18n/guest-text';

/** conversations.metadata icindeki anahtar. */
export const LEAD_METADATA_KEY = 'lead_capture';

export interface LeadCaptureState {
  /** Su an hangi bilgi bekleniyor. */
  step: 'name' | 'phone';
  /** Ad-soyad (inhouse ise basta dolu gelir, non-guest'te isim turunda dolar). */
  name?: string;
  /** Misafirin orijinal etkinlik mesaji — final kartta "Konu" satiri. */
  topic: string;
  /** Kartin dustugu / dusecegi grup (edit hedefi). */
  notifyChatId: number;
  /** Acik kartin message_id'si; null ise HENUZ kart YOK -> tamamlaninca taze kart gider. */
  notifyMsgId: number | null;
  /** inhouse ise oda no; non-guest'te null. */
  room?: string | null;
  /**
   * IS 17.1 — misafir INHOUSE mu (isim + oda BELLI)? Bildirim zamanlamasini bu belirler:
   * inhouse'ta talep ANINDA kart duser, non-guest'te kart YALNIZ telefon gelince olusur
   * (bkz. decideLeadNotify). start turunda hesaplanip state'te tasinir — devam turlarinda
   * classify calismadigi icin yeniden turetilemez.
   */
  isInhouse: boolean;
  /** Telefon icin nazik tekrar YAPILDI mi (yalniz BIR kez). */
  phoneRetried?: boolean;
  /**
   * Misafirin dili — akisin GERI KALANI bu dilde sorulur. Turn'ler arasinda burada
   * tasinir cunku devam turlarinda classify HIC calismaz (lead kapisi 17.c'nin de
   * ustunde erken doner) -> dil baska yerden okunamaz.
   */
  language?: GuestLang;
}

// ── Misafire giden sabit metinler (dil-basina STATIK) ────────────────────────
// TR metinler TAM Turkce karakterli ve mevcut sevkten BIREBIR ayni (davranis-notr);
// diger diller EKLENDI. Bilinmeyen dil -> normalizeGuestLang ile 'en'.

const ASK_NAME: Record<GuestLang, string> = {
  tr: 'Memnuniyetle. Satış ve etkinlik ekibimizin size ulaşabilmesi için önce ad-soyadınızı alabilir miyim?',
  en: 'With pleasure. So that our sales and events team can reach you, may I first have your full name?',
  de: 'Sehr gerne. Damit unser Vertriebs- und Veranstaltungsteam Sie erreichen kann, darf ich zuerst Ihren vollständigen Namen erfahren?',
  ru: 'С удовольствием. Чтобы наша команда по продажам и мероприятиям могла с вами связаться, подскажите, пожалуйста, ваши имя и фамилию.',
  ar: 'بكل سرور. حتى يتمكن فريق المبيعات والفعاليات من التواصل معك، هل يمكنني معرفة اسمك الكامل أولاً؟',
};

const ASK_PHONE: Record<GuestLang, string> = {
  tr: 'Memnuniyetle. Satış ve etkinlik ekibimizin size ulaşabilmesi için telefon numaranızı paylaşır mısınız?',
  en: 'With pleasure. Could you share your phone number so that our sales and events team can reach you?',
  de: 'Sehr gerne. Könnten Sie uns Ihre Telefonnummer mitteilen, damit unser Vertriebs- und Veranstaltungsteam Sie erreichen kann?',
  ru: 'С удовольствием. Не могли бы вы поделиться номером телефона, чтобы наша команда по продажам и мероприятиям могла с вами связаться?',
  ar: 'بكل سرور. هل يمكنك مشاركة رقم هاتفك حتى يتمكن فريق المبيعات والفعاليات من التواصل معك؟',
};

const RETRY_PHONE: Record<GuestLang, string> = {
  tr: 'Numaranızı tam olarak alamadım. Örneğin 0532 000 00 00 biçiminde yazabilir misiniz?',
  en: "I couldn't quite read your number. Could you write it with the country code, for example +90 532 000 00 00?",
  de: 'Ich konnte Ihre Nummer nicht genau lesen. Könnten Sie sie mit Ländervorwahl schreiben, zum Beispiel +90 532 000 00 00?',
  ru: 'Мне не удалось разобрать ваш номер. Напишите его, пожалуйста, с кодом страны, например +90 532 000 00 00.',
  ar: 'لم أتمكن من قراءة رقمك بوضوح. هل يمكنك كتابته مع رمز الدولة، مثل +90 532 000 00 00؟',
};

/** Telefon alinamadi: akis kapanir. Ara-kart ZATEN dustugu icin "ilettim" DOGRU (sahte vaat degil). */
const CLOSE: Record<GuestLang, string> = {
  tr: 'Sorun değil. Talebinizi ekibimize ilettim, en kısa sürede sizinle ilgilenecekler.',
  en: "No problem. I've passed your request on to our team; they will get back to you shortly.",
  de: 'Kein Problem. Ich habe Ihre Anfrage an unser Team weitergeleitet; man wird sich in Kürze bei Ihnen melden.',
  ru: 'Ничего страшного. Я передал ваш запрос нашей команде, с вами свяжутся в ближайшее время.',
  ar: 'لا مشكلة. لقد أحلت طلبك إلى فريقنا وسيتواصلون معك في أقرب وقت.',
};

const THANKS: Record<GuestLang, string> = {
  tr: 'Teşekkürler, bilgilerinizi ilettim; ekibimiz en kısa sürede sizinle iletişime geçecek.',
  en: "Thank you, I've passed your details on; our team will contact you shortly.",
  de: 'Vielen Dank, ich habe Ihre Angaben weitergeleitet; unser Team wird sich in Kürze bei Ihnen melden.',
  ru: 'Спасибо, я передал ваши данные; наша команда свяжется с вами в ближайшее время.',
  ar: 'شكرًا لك، لقد أرسلت بياناتك؛ سيتواصل معك فريقنا في أقرب وقت.',
};

/** Isim alindiktan sonraki telefon sorusu — isim bilinmiyorsa duz kalip (ASK_PHONE). */
const ASK_PHONE_NAMED: Record<GuestLang, (n: string) => string> = {
  tr: (n) => `Teşekkür ederim ${n}. Ekibimizin size ulaşabilmesi için telefon numaranızı paylaşır mısınız?`,
  en: (n) => `Thank you, ${n}. Could you share your phone number so that our team can reach you?`,
  de: (n) => `Vielen Dank, ${n}. Könnten Sie uns Ihre Telefonnummer mitteilen, damit unser Team Sie erreichen kann?`,
  ru: (n) => `Спасибо, ${n}. Не могли бы вы поделиться номером телефона, чтобы наша команда могла с вами связаться?`,
  ar: (n) => `شكرًا لك، ${n}. هل يمكنك مشاركة رقم هاتفك حتى يتمكن فريقنا من التواصل معك؟`,
};

// Geriye donuk TR sabitleri — mevcut tuketiciler (is8 korpusu) icin KORUNDU.
export const LEAD_ASK_NAME_TR = ASK_NAME.tr;
export const LEAD_ASK_PHONE_TR = ASK_PHONE.tr;
export const LEAD_RETRY_PHONE_TR = RETRY_PHONE.tr;
export const LEAD_CLOSE_TR = CLOSE.tr;
export const LEAD_THANKS_TR = THANKS.tr;

export function leadAskName(lang?: string | null): string {
  return ASK_NAME[normalizeGuestLang(lang)];
}
export function leadAskPhone(lang?: string | null): string {
  return ASK_PHONE[normalizeGuestLang(lang)];
}
export function leadRetryPhone(lang?: string | null): string {
  return RETRY_PHONE[normalizeGuestLang(lang)];
}
export function leadClose(lang?: string | null): string {
  return CLOSE[normalizeGuestLang(lang)];
}
export function leadThanks(lang?: string | null): string {
  return THANKS[normalizeGuestLang(lang)];
}

/** Isim alindiktan sonraki telefon sorusu (isim bilinmiyorsa duz kalip). */
export function buildAskPhone(name?: string | null, lang?: string | null): string {
  const n = (name ?? '').trim();
  const l = normalizeGuestLang(lang);
  return n ? ASK_PHONE_NAMED[l](n) : ASK_PHONE[l];
}

// ── BILDIRIM ZAMANLAMASI (IS 17.1) ───────────────────────────────────────────
//
// KOK SORUN: kart HER etkinlik talebinde ANINDA dusuyordu. Disaridan yazan (non-guest)
// kiside o anda elde ne isim ne oda var -> personele "bilinmiyor · bilinmiyor" iceren,
// uzerine gidilemeyen bir kart gidiyordu; misafir yarida birakirsa kart oksuz kaliyordu.
//
// KARAR (Kemal): kart, PERSONELIN USTUNE GIDEBILECEGI bilgi olustugu anda duser.
//   NON-GUEST : start'ta kart YOK -> once ad-soyad, sonra telefon; kart YALNIZ telefon
//               gelince (isim+telefon+konu). Yarida birakirsa kart HIC olusmaz.
//   INHOUSE   : oda+isim ZATEN biliniyor -> talep aninda kart DUSER (personel odaya
//               ulasabilir); telefon gelince AYNI kart guncellenir, gelmezse yerinde kalir.
//
// SESSIZ YUTMA YASAGI ihlali DEGIL: non-guest'te "kaybolan" bir talep yok — misafir
// akisi yarida birakmissa personele iletilecek uzerine-gidilebilir bir lead de yoktur
// (isim ve telefon ikisi de eksik). Inhouse'ta ise talep ANINDA iletilir.
//
// VAZGECME DURUSTLUGU (IS 17.1-ek): inhouse misafir telefon vermeden vazgecerse kart
// KALIR ama metni DURUSTLESIR. Aksi halde kart "Telefon isteniyor; gelince
// guncellenecektir" yazili donar ve personel ASLA gelmeyecek bir telefonu bekler —
// bu da bir tur sessiz yanlis-bilgilendirmedir. Kart 'inhouse_closed' ile "telefon
// alinamadi, oda uzerinden takip edilebilir" haline cevrilir.
export type LeadNotifyKind = 'inhouse_request' | 'update' | 'final_new' | 'inhouse_closed';

export function decideLeadNotify(input: {
  phase: 'start' | 'complete' | 'abandon';
  isInhouse: boolean;
}): { send: boolean; kind: LeadNotifyKind | null } {
  switch (input.phase) {
    case 'start':
      return input.isInhouse
        ? { send: true, kind: 'inhouse_request' }
        : { send: false, kind: null };
    case 'complete':
      return input.isInhouse
        ? { send: true, kind: 'update' }      // acik kart telefonla GUNCELLENIR
        : { send: true, kind: 'final_new' };  // ilk ve tek kart SIMDI olusur
    case 'abandon':
    default:
      return input.isInhouse
        ? { send: true, kind: 'inhouse_closed' } // acik kart DURUST duruma cevrilir
        : { send: false, kind: null };           // hic kart olusmadi -> olusturulmaz
  }
}

// ── Personel kartlari (HTML) ─────────────────────────────────────────────────
// PERSONELE gider -> TR kalir (kural: personel bildirimi her zaman Turkce).

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * INHOUSE TALEP KARTI (IS 17.1): yalniz inhouse misafirde, talep ANINDA duser.
 * Oda + isim BELLI oldugu icin personel telefon beklemeden ulasabilir.
 * Telefon gelince ayni mesaj buildLeadFinalCard ile GUNCELLENIR (editMessageText).
 * Non-guest'te bu kart HIC uretilmez — bkz. decideLeadNotify.
 */
export function buildLeadInhouseRequestCard(p: {
  room?: string | null;
  guestName?: string | null;
  topic: string;
}): string {
  return (
    `🔔 <b>Bilgilendirme — Etkinlik / Organizasyon</b>\n\n` +
    `Oda ${esc(p.room || 'bilinmiyor')} · <b>${esc(p.guestName || 'bilinmiyor')}</b> · ` +
    `"${esc(p.topic)}" talebinde bulundu.\n\n` +
    `⏳ Telefon isteniyor; gelince bu kart güncellenecektir. (Bildirim - SLA yok)`
  );
}

/**
 * INHOUSE VAZGECME KARTI (IS 17.1-ek): misafir telefon vermeden akisi birakti.
 * Kart SILINMEZ (talep gercek), ama "telefon bekleniyor" vaadi KALDIRILIR — personel
 * gelmeyecek bir bilgiyi beklemesin. Takip yolu oda numarasidir.
 * Non-guest'te bu kart HIC uretilmez: orada zaten bir kart olusmamistir.
 */
export function buildLeadInhouseClosedCard(p: {
  room?: string | null;
  guestName?: string | null;
  topic: string;
}): string {
  const room = esc(p.room || 'bilinmiyor');
  return (
    `🔔 <b>Bilgilendirme — Etkinlik / Organizasyon</b>\n\n` +
    `Oda ${room} · <b>${esc(p.guestName || 'bilinmiyor')}</b> · ` +
    `"${esc(p.topic)}" talebinde bulundu.\n\n` +
    `📵 Telefon alınamadı (misafir paylaşmadı); Oda ${room} üzerinden takip edilebilir. (Bildirim - SLA yok)`
  );
}

/** FINAL KART: iletisim tamam. Oda satiri yalniz inhouse misafirde eklenir. */
export function buildLeadFinalCard(p: {
  name: string;
  phone: string;
  topic: string;
  room?: string | null;
}): string {
  const roomPart = p.room ? ` · Oda: ${esc(p.room)}` : '';
  return (
    `🔔 <b>Bilgilendirme — Etkinlik / Organizasyon</b>\n\n` +
    `Ad-Soyad: <b>${esc(p.name || 'bilinmiyor')}</b>\n` +
    `Telefon: <b>${esc(p.phone)}</b>\n` +
    `Konu: ${esc(p.topic)}${roomPart}\n\n` +
    `Lütfen ilgili yetkiliye aktarınız. (SLA yok)`
  );
}

// ── State okuma / yazma (conversations.metadata jsonb, kayipsiz merge) ───────

export function readLeadCapture(metadata: unknown): LeadCaptureState | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>)[LEAD_METADATA_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.step !== 'name' && o.step !== 'phone') return null;
  if (typeof o.topic !== 'string' || !o.topic.trim()) return null;
  return {
    step: o.step,
    name: typeof o.name === 'string' && o.name.trim() ? o.name : undefined,
    topic: o.topic,
    notifyChatId: typeof o.notifyChatId === 'number' ? o.notifyChatId : 0,
    notifyMsgId: typeof o.notifyMsgId === 'number' ? o.notifyMsgId : null,
    room: typeof o.room === 'string' && o.room ? o.room : null,
    phoneRetried: o.phoneRetried === true,
    // GERIYE UYUM: IS 17 oncesi acilmis state'te alan YOK. O turlarin ilk sorusu
    // TR gitmisti -> 'tr' varsayilir (normalizeGuestLang'in 'en' fallback'i BURADA
    // yanlis olurdu: konusma ortasinda dil degistirmek misafiri sasirtir).
    language: typeof o.language === 'string' ? normalizeGuestLang(o.language) : 'tr',
    // GERIYE UYUM: IS 17.1 oncesi state'te alan YOK. O turlarda kart KOSULSUZ dusmustu,
    // yani notifyMsgId doludur ve tamamlanma edit'e gider — davranis korunur. isInhouse
    // yalnizca "oda biliniyor mu" bilgisinden turetilir (inhouse start'inin tek kaniti).
    isInhouse: typeof o.isInhouse === 'boolean' ? o.isInhouse : (typeof o.room === 'string' && !!o.room),
  };
}

/** metadata'nin DIGER anahtarlarini korur (kor UPDATE yok). */
export function withLeadCapture(metadata: unknown, state: LeadCaptureState): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  base[LEAD_METADATA_KEY] = state;
  return base;
}

export function clearLeadCapture(metadata: unknown): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  delete base[LEAD_METADATA_KEY];
  return base;
}

// ── Kararlar ─────────────────────────────────────────────────────────────────

/**
 * Akisi baslat. Isim ZATEN biliniyorsa (inhouse misafir) isim turu ATLANIR —
 * misafire bildigimiz seyi sormayiz.
 */
export function startLeadCapture(p: {
  topic: string;
  guestName?: string | null;
  room?: string | null;
  notifyChatId: number;
  notifyMsgId: number | null;
  /** Misafirin dili (classify `language`); verilmezse 'en' (normalizeGuestLang). */
  language?: string | null;
}): { state: LeadCaptureState; question: string } {
  const name = (p.guestName ?? '').trim();
  const lang = normalizeGuestLang(p.language);
  const state: LeadCaptureState = {
    step: name ? 'phone' : 'name',
    name: name || undefined,
    topic: p.topic,
    notifyChatId: p.notifyChatId,
    notifyMsgId: p.notifyMsgId,
    room: p.room ?? null,
    language: lang,
    // Cagiran taraf inhouse misafirde ismi DOLU gecer (Telegram profil adi ad-soyad
    // SAYILMAZ, route.ts orada null gecer) -> isim varligi inhouse'un tek olcutudur.
    isInhouse: !!name,
  };
  return { state, question: name ? ASK_PHONE[lang] : ASK_NAME[lang] };
}

export type LeadAdvance =
  | { action: 'ask_phone'; state: LeadCaptureState; reply: string }
  | { action: 'retry'; state: LeadCaptureState; reply: string }
  | { action: 'complete'; name: string; phone: string; reply: string }
  | { action: 'close'; reply: string };

/**
 * Bekleyen lead turunda gelen mesaji degerlendirir.
 *
 * isim turu   : mesajin TAMAMI isimdir (deterministik; LLM'e sorulmaz) -> telefon turu.
 * telefon turu: paylasilan extractPhone. Bulunursa TAMAMLA; bulunamazsa BIR kez
 *               nazik tekrar, ikincide akisi kapat (ara-kart zaten dustu).
 *
 * @param language opsiyonel override; verilmezse state.language kullanilir (tek kaynak).
 */
export function advanceLead(state: LeadCaptureState, text: string, language?: string | null): LeadAdvance {
  const incoming = String(text ?? '').trim();
  const lang = normalizeGuestLang(language ?? state.language ?? 'tr');

  if (state.step === 'name') {
    // Bos mesaj pratikte bu noktaya ulasmaz (webhook bos metni islemez); yine de
    // sonsuz soru dongusu olmasin diye akis kapatilir.
    if (!incoming) return { action: 'close', reply: CLOSE[lang] };
    const next: LeadCaptureState = { ...state, step: 'phone', name: incoming, language: lang };
    return { action: 'ask_phone', state: next, reply: buildAskPhone(incoming, lang) };
  }

  const phone = extractPhone(incoming);
  if (phone) {
    return { action: 'complete', name: state.name ?? '', phone, reply: THANKS[lang] };
  }
  if (!state.phoneRetried) {
    return { action: 'retry', state: { ...state, phoneRetried: true, language: lang }, reply: RETRY_PHONE[lang] };
  }
  return { action: 'close', reply: CLOSE[lang] };
}
