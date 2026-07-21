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

import { extractPhone } from '@/lib/utils/phone';

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
}

// ── Misafire giden sabit metinler (TAM Turkce) ───────────────────────────────

export const LEAD_ASK_NAME_TR =
  'Memnuniyetle. Satış ve etkinlik ekibimizin size ulaşabilmesi için önce ad-soyadınızı alabilir miyim?';

export const LEAD_ASK_PHONE_TR =
  'Memnuniyetle. Satış ve etkinlik ekibimizin size ulaşabilmesi için telefon numaranızı paylaşır mısınız?';

export const LEAD_RETRY_PHONE_TR =
  'Numaranızı tam olarak alamadım. Örneğin 0532 000 00 00 biçiminde yazabilir misiniz?';

/** Telefon alinamadi: akis kapanir. Ara-kart ZATEN dustugu icin "ilettim" DOGRU (sahte vaat degil). */
export const LEAD_CLOSE_TR =
  'Sorun değil. Talebinizi ekibimize ilettim, en kısa sürede sizinle ilgilenecekler.';

export const LEAD_THANKS_TR =
  'Teşekkürler, bilgilerinizi ilettim; ekibimiz en kısa sürede sizinle iletişime geçecek.';

/** Isim alindiktan sonraki telefon sorusu (isim bilinmiyorsa duz kalip). */
export function buildAskPhone(name?: string | null): string {
  const n = (name ?? '').trim();
  return n
    ? `Teşekkür ederim ${n}. Ekibimizin size ulaşabilmesi için telefon numaranızı paylaşır mısınız?`
    : LEAD_ASK_PHONE_TR;
}

// ── Personel kartlari (HTML) ─────────────────────────────────────────────────

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
}): { state: LeadCaptureState; question: string } {
  const name = (p.guestName ?? '').trim();
  const state: LeadCaptureState = {
    step: name ? 'phone' : 'name',
    name: name || undefined,
    topic: p.topic,
    notifyChatId: p.notifyChatId,
    notifyMsgId: p.notifyMsgId,
    room: p.room ?? null,
  };
  return { state, question: name ? LEAD_ASK_PHONE_TR : LEAD_ASK_NAME_TR };
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
 */
export function advanceLead(state: LeadCaptureState, text: string): LeadAdvance {
  const incoming = String(text ?? '').trim();

  if (state.step === 'name') {
    // Bos mesaj pratikte bu noktaya ulasmaz (webhook bos metni islemez); yine de
    // sonsuz soru dongusu olmasin diye akis kapatilir.
    if (!incoming) return { action: 'close', reply: LEAD_CLOSE_TR };
    const next: LeadCaptureState = { ...state, step: 'phone', name: incoming };
    return { action: 'ask_phone', state: next, reply: buildAskPhone(incoming) };
  }

  const phone = extractPhone(incoming);
  if (phone) {
    return { action: 'complete', name: state.name ?? '', phone, reply: LEAD_THANKS_TR };
  }
  if (!state.phoneRetried) {
    return { action: 'retry', state: { ...state, phoneRetried: true }, reply: LEAD_RETRY_PHONE_TR };
  }
  return { action: 'close', reply: LEAD_CLOSE_TR };
}
