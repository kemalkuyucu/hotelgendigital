// ── Phase B / B2.1 — Mesaj Tipi Taksonomisi ───────────────────────────────────
//
// SAF TAKSONOMİ MODÜLÜ — davranış-nötr.
// Bu dosya hiçbir çağrı/servis import ETMEZ ve (B2.1 itibarıyla) hiçbir yer
// tarafından import EDİLMEZ. Tek görevi: AI orchestrator'ın ürettiği `intent`
// stringlerini 4 mesaj tipine eşleyip, her tipin forward/buton/SLA davranış
// imzasını TEK YERDE tanımlamak. Tüketim B2.2 (routeIntentToDepartment) ve
// B2.3 (forward yolu) ile gelecek; o ana dek davranış DEĞİŞMEZ.
//
// Onaylanan harita (MODULE_MANIFEST Phase B, 2026-06-01):
//   SOHBET   → forward yok · buton yok · sla yok
//   BİLGİ    → forward yok · buton yok · sla yok   (cevap KB'den)
//   TALEP    → forward VAR · 2 buton VAR · sla_events VAR
//   BİLDİRİM → forward VAR · buton YOK · sla_events YOK
//
// NOT: Mevcut `routeIntentToDepartment` davranışıyla birebir uyumludur —
// SOHBET/BİLGİ = NON_FORWARDING_INTENTS, geri kalan her şey forward'lanır.
// Tek yeni resmîleştirme: `allergy` → BİLDİRİM (zaten button-free + sla-yok
// olan allergen-notify yolunu taksonomiye taşır).

/**
 * Dört mesaj tipi. Kod tarafı ASCII slug kullanır (Türkçe karşılıkları yorumda).
 *   SOHBET   = sosyal / non-actionable
 *   BILGI    = bilgi sorusu (knowledge_query)
 *   TALEP    = aksiyon gerektiren talep
 *   BILDIRIM = bilgilendirme (aksiyon beklenmez)
 */
export type MessageType = 'SOHBET' | 'BILGI' | 'TALEP' | 'BILDIRIM';

/**
 * Bir mesaj tipinin davranış imzası.
 *   forwards        → departman(lar)a iletilir mi
 *   withButtons     → forward'a SLA inline butonları eklenir mi (yalnız TALEP)
 *   createsSlaEvent → `sla_events` satırı yazılır mı (yalnız TALEP)
 */
export interface MessageTypeTraits {
  forwards: boolean;
  withButtons: boolean;
  createsSlaEvent: boolean;
}

/**
 * Tip → davranış tablosu. Forward yolunun TEK doğruluk kaynağı (B2.3 bunu tüketir).
 */
const MESSAGE_TYPE_TRAITS: Record<MessageType, MessageTypeTraits> = {
  SOHBET:   { forwards: false, withButtons: false, createsSlaEvent: false },
  BILGI:    { forwards: false, withButtons: false, createsSlaEvent: false },
  TALEP:    { forwards: true,  withButtons: true,  createsSlaEvent: true  },
  BILDIRIM: { forwards: true,  withButtons: false, createsSlaEvent: false },
};

/**
 * SOHBET — sosyal / non-actionable intent'ler.
 * (Mevcut classify-and-respond.NON_FORWARDING_INTENTS'in knowledge_query hariç
 *  alt kümesi; knowledge_query ayrı BİLGİ tipidir.)
 */
export const CHAT_INTENTS = new Set<string>([
  'greeting',        // merhaba, selam, hello, hi
  'acknowledgment',  // teşekkürler, sağol, thanks
  'chitchat',        // nasılsın, hava nasıl
  'farewell',        // görüşürüz, iyi geceler, bye
  'affirmation',     // evet, tamam, olur, yes
  'negation',        // hayır, gerek yok, no
]);

/**
 * BİLGİ — bilgi sorusu. Cevap KB'den verilir, forward yok.
 */
export const INFO_INTENTS = new Set<string>([
  'knowledge_query',
]);

/**
 * TALEP — aksiyon gerektiren talepler (forward + 2 buton + SLA).
 * Operasyonel + kişisel + şikayet intent'lerinin tümü.
 */
export const REQUEST_INTENTS = new Set<string>([
  // operasyonel
  'technical',
  'housekeeping',
  'fb',
  'spa',
  'animation',
  'room_service',
  // kişisel
  'billing',
  'lost_and_found',
  // şikayet
  'complaint',
]);

/**
 * BİLDİRİM — bilgilendirme (forward VAR, ama buton YOK + SLA YOK).
 * `allergy` burada resmîleşir (allergen-notify zaten button-free/sla-yok).
 * `late_checkout` gibi aksiyon-beklemeyen bildirimler de buraya eklenir.
 */
export const NOTIFICATION_INTENTS = new Set<string>([
  'allergy',
  'late_checkout',
]);

/**
 * Intent → MessageType statik haritası (yukarıdaki dört kümeden türetilir).
 * Bu map'te BULUNMAYAN bir intent için fallback = TALEP (bkz. getMessageType) —
 * çünkü mevcut routeIntentToDepartment de tanınmayan intent'i forward'lar.
 */
export const INTENT_MESSAGE_TYPE: Readonly<Record<string, MessageType>> = (() => {
  const map: Record<string, MessageType> = {};
  for (const i of CHAT_INTENTS) map[i] = 'SOHBET';
  for (const i of INFO_INTENTS) map[i] = 'BILGI';
  for (const i of REQUEST_INTENTS) map[i] = 'TALEP';
  for (const i of NOTIFICATION_INTENTS) map[i] = 'BILDIRIM';
  return Object.freeze(map);
})();

/**
 * Bir intent'in mesaj tipini döndür.
 * Tanınmayan / boş intent → TALEP (davranış-nötr fallback: mevcut kod da
 * bilinmeyen intent'i front_office'e forward'lar; TALEP imzası bununla uyumlu).
 */
export function getMessageType(intent: string | null | undefined): MessageType {
  const normalized = (intent ?? '').toLowerCase().trim();
  return INTENT_MESSAGE_TYPE[normalized] ?? 'TALEP';
}

/**
 * Bir mesaj tipinin (veya intent'in) davranış imzasını döndür.
 * Overload yerine tek imza: `MessageType` ver → o tipin trait'i; başka bir
 * string ver → önce getMessageType ile tipe çevrilir.
 */
export function messageTypeTraits(typeOrIntent: MessageType | string): MessageTypeTraits {
  const type: MessageType =
    typeOrIntent in MESSAGE_TYPE_TRAITS
      ? (typeOrIntent as MessageType)
      : getMessageType(typeOrIntent);
  return MESSAGE_TYPE_TRAITS[type];
}

/**
 * Etkinlik/organizasyon + açık iletişim talebinin BİLDİRİM imzası (LEG a / LEG b2).
 *
 * Bu yol ön büroya ULAŞIR ama TALEP kartı AÇMAZ: düğün/toplantı/etkinlik ve
 * "yetkiliyle görüşmek istiyorum" gibi konular operasyonel bir iş emri değil,
 * "ilgili yetkiliye aktarın" bilgilendirmesidir → SLA takibi + eskalasyon +
 * onay butonu YOK. Bayraklar BİLDİRİM trait'iyle birebir aynıdır.
 *
 * `notifyKind`, forward yolunda (route.ts) hangi bildirim şablonunun basılacağını
 * seçer — aynı bayrakları taşıyan bagaj bildiriminden bu alanla ayrılır.
 */
export const EVENT_CONTACT_NOTIFY = {
  messageType: 'BILDIRIM',
  withButtons: false,
  createsSlaEvent: false,
  notifyKind: 'event_contact',
} as const;
