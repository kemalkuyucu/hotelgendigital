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
  /** Ara-kartin dustugu grup (edit hedefi). */
  notifyChatId: number;
  /** Ara-kart message_id; null ise edit denenmez, fallback yeni mesaj gider. */
  notifyMsgId: number | null;
  /** inhouse ise oda no; non-guest'te null. */
  room?: string | null;
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

// ── Personel kartlari (HTML) ─────────────────────────────────────────────────
// PERSONELE gider -> TR kalir (kural: personel bildirimi her zaman Turkce).

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * ARA-KART: talep ANINDA duser (ilgi kaybolmasin — SESSIZ YUTMA YASAGI).
 * Iletisim bilgisi gelince editMessageText ile final karta donusur.
 */
export function buildLeadInterimCard(p: {
  room?: string | null;
  guestName?: string | null;
  message: string;
}): string {
  return (
    `🔔 <b>Bilgilendirme — Etkinlik / Organizasyon</b>\n\n` +
    `Oda: ${esc(p.room || 'bilinmiyor')} · Misafir: <b>${esc(p.guestName || 'bilinmiyor')}</b>\n\n` +
    `Misafir mesajı: "${esc(p.message)}"\n\n` +
    `⏳ Misafirden ad-soyad ve telefon bilgisi isteniyor; alınınca bu kart güncellenecektir. (Bilgilendirme - SLA yok)`
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
