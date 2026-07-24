// ── LEAD CAPTURE — etkinlik/organizasyon talebinde ad-soyad + telefon toplama ──
//
// SAF MODUL: IO yok, ag yok, LLM yok. Butun kararlar deterministik (KALICI KARAR #3);
// route.ts yalnizca bu modulun verdigi karari uygular.
//
// NEDEN VAR: sorumlu lead'e ulasamiyordu. inhouse_guests_v2'de telefon/e-posta
// kolonu YOK, Telegram da numara vermiyor — elde sadece Telegram profil adi kalir.
// Cozum: bot SORAR.
//
// IS 18 — TEK AKIS (misafir turu ayrimi KALKTI). Inhouse misafir de disaridan yazan
// da AYNI yoldan gecer:
//   1) Etkinlik/iletisim talebi -> kart YOK; misafire TEK acilista isim + soyisim +
//      telefon sorulur (lead_ask_all).
//   2) Gelen HER mesajda telefon (phone.ts) ve telefon disi metin (isim adayi)
//      toplanir; state'te birikir. Eksik olan TEKRAR sorulur — yalniz EKSIK OLAN.
//   3) Isim VE telefon tamamlaninca On Buro'ya TEK kart duser (buildLeadFinalCard).
//   4) Vazgecme sozcugu -> state temizlenir, kart YOK, iletim VAAT EDILMEZ.
//
// NEDEN kart yalniz tamamlaninca: isim+telefon olmadan dusen kart personele
// "bilinmiyor - bilinmiyor" der; uzerine gidilemez, misafir yarida birakirsa oksuz
// kalir. SESSIZ YUTMA ihlali degil — ortada iletilecek, uzerine gidilebilir bir lead
// olusmamistir; misafire de "ilettim" DENMEZ (bkz. lead_close metni).
//
// STATE conversations.metadata jsonb icinde tasinir: yeni kolon/MIGRATION GEREKMEZ
// (canli schema_migrations tutarsizligina bulasmamak icin bilincli tercih).
// DB kaydi YOK — bu akis yalnizca bildirimdir (karar: notify-only).
//
// Misafire giden metinler dil-basina STATIK ve TEK KAYNAKTA (guest-text.ts). LLM'e
// metin YAZDIRILMAZ; yalnizca DIL kodu LLM'den gelir (classify `language`) ve state'te
// tasinir — boylece devam turlari da ayni dilde sorulur. Personel KARTLARI TR kalir.

import { extractPhone, toAsciiDigits } from '@/lib/utils/phone';
import { normalizeGuestLang, guestText, type GuestLang } from '@/lib/i18n/guest-text';
import { normalizeTr } from '@/lib/utils/normalize-tr';

/** conversations.metadata icindeki anahtar. */
export const LEAD_METADATA_KEY = 'lead_capture';

export interface LeadCaptureState {
  /** Toplanan ad-soyad (telefon disi metin); henuz gelmediyse undefined. */
  name?: string;
  /** Toplanan telefon (phone.ts formatinda); henuz gelmediyse undefined. */
  phone?: string;
  /** Misafirin orijinal etkinlik mesaji — final kartta "Konu" satiri. */
  topic: string;
  /** Kartin dusecegi grup. */
  notifyChatId: number;
  /** Misafir dogrulanmissa oda no — final kartta ek takip yolu; yoksa null. */
  room?: string | null;
  /**
   * Misafirin dili — akisin GERI KALANI bu dilde sorulur. Turn'ler arasinda burada
   * tasinir cunku devam turlarinda classify HIC calismaz (lead kapisi 17.c'nin de
   * ustunde erken doner) -> dil baska yerden okunamaz.
   */
  language?: GuestLang;
}

// ── Misafire giden metinler ──────────────────────────────────────────────────
// TEK KAYNAK guest-text.ts; burada yalnizca anahtar secilir (ikinci metin kopyasi
// YASAK — biri degisince digeri sessizce kayar).

function askAll(lang: GuestLang): string {
  return guestText('lead_ask_all', lang);
}
function askPhone(lang: GuestLang): string {
  return guestText('lead_ask_phone', lang);
}
function askName(lang: GuestLang): string {
  return guestText('lead_ask_name', lang);
}
function closeText(lang: GuestLang): string {
  return guestText('lead_close', lang);
}
function thanksText(lang: GuestLang): string {
  return guestText('lead_thanks', lang);
}

// ── VAZGECME DEDEKTORU (deterministik, LLM'e sorulmaz) ───────────────────────
//
// Neden gerek: yeni akista telefon DISI her metin isim adayidir. Guard olmasa
// "istemiyorum" cevabi ad-soyad sayilip karta "Ad-Soyad: istemiyorum" olarak duserdi.
//
// KISA sozcukler (yok / no / нет ...) YALNIZ mesajin TAMAMI onlarsa sayilir; icerik
// taramasi yanlis pozitif uretir ("no" -> "Nolan", "yok" -> "yoksa").

const ABANDON_EXACT: ReadonlySet<string> = new Set([
  // tr
  'yok', 'hayir', 'olmasin', 'gerek yok', 'bosver', 'bos ver', 'kalsin', 'iptal',
  // en
  'no', 'nope', 'cancel',
  // de
  'nein',
  // ru
  'нет',
  // ar
  'لا',
]);

const ABANDON_INCLUDES: readonly string[] = [
  // tr
  'istemiyorum', 'istemem', 'vazgectim', 'vazgectik', 'gerek yok', 'gerekmiyor',
  'ilgilenmiyorum', 'iptal et',
  // en
  'no thank', 'not interested', 'dont want', 'do not want', 'never mind', 'nevermind',
  'forget it',
  // de
  'kein interesse', 'nicht interessiert', 'nein danke', 'abbrechen', 'vergiss es',
  // ru
  'не хочу', 'не нужно', 'не интересует', 'отмен',
  // ar
  'لا اريد', 'لا أريد', 'لا شكر', 'لست مهتم', 'الغاء', 'إلغاء',
];

/**
 * Normalize: TR buyuk/kucuk + aksan sadelestirme (paylasilan normalizeTr) + apostrof
 * varyantlarini duser ("don't" -> "dont") + coklu bosluk tekler.
 * Apostroflar TEK TEK listelenir, ARALIK (a-b) YOK: siralamasi bozulsa bile kume ayni
 * kalir (ters aralik modul yuklenirken patlatirdi — phone.ts dersi).
 */
function normalizeAbandon(text: string): string {
  return normalizeTr(String(text ?? ''))
    .replace(/[‘’ʼ'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Misafir akistan vazgecti mi? (Telefon TASIYAN mesaj asla vazgecme sayilmaz — bkz. advanceLead.) */
export function isLeadAbandon(text: string): boolean {
  const t = normalizeAbandon(text);
  if (!t) return false;
  if (ABANDON_EXACT.has(t)) return true;
  return ABANDON_INCLUDES.some((p) => t.includes(p));
}

// ── BILDIRIM KARARI ──────────────────────────────────────────────────────────
//
// IS 18: tek kural — kart YALNIZ tamamlanmada duser. Start'ta (talep algilandi) ve
// vazgecmede kart YOK; misafir turune gore dallanma KALKTI.
export type LeadNotifyKind = 'final_new';

export function decideLeadNotify(input: {
  phase: 'start' | 'complete' | 'abandon';
}): { send: boolean; kind: LeadNotifyKind | null } {
  return input.phase === 'complete'
    ? { send: true, kind: 'final_new' }   // ilk ve TEK kart burada olusur
    : { send: false, kind: null };
}

// ── Personel karti (HTML) ────────────────────────────────────────────────────
// PERSONELE gider -> TR kalir (kural: personel bildirimi her zaman Turkce).

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** FINAL KART: iletisim tamam. Oda satiri yalniz dogrulanmis misafirde eklenir. */
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
  if (typeof o.topic !== 'string' || !o.topic.trim()) return null;
  // GERIYE UYUM (IS 18): eski state'in `step` / `notifyMsgId` / `isInhouse` /
  // `phoneRetried` alanlari OKUNMAZ. Yarim kalmis eski akislar dogru devam eder:
  // toplanan `name` tasinir, eksikler yeni kurala gore sorulur. Tek gorunur fark —
  // deploy aninda ACIK olan bir inhouse ara-karti artik editlenmez, yerinde kalir.
  return {
    name: typeof o.name === 'string' && o.name.trim() ? o.name : undefined,
    phone: typeof o.phone === 'string' && o.phone.trim() ? o.phone : undefined,
    topic: o.topic,
    notifyChatId: typeof o.notifyChatId === 'number' ? o.notifyChatId : 0,
    room: typeof o.room === 'string' && o.room ? o.room : null,
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
 * Akisi baslat. Misafir turu ne olursa olsun (inhouse dahil) TEK acilis: isim +
 * soyisim + telefon birlikte istenir. Bilinen isim ON-DOLDURULMAZ — "herkes ayni
 * yol" kurali; DB'deki isim yerine misafirin verdigi iletisim adi kullanilir.
 */
export function startLeadCapture(p: {
  topic: string;
  room?: string | null;
  notifyChatId: number;
  /** Misafirin dili (classify `language`); verilmezse 'en' (normalizeGuestLang). */
  language?: string | null;
}): { state: LeadCaptureState; question: string } {
  const lang = normalizeGuestLang(p.language);
  const state: LeadCaptureState = {
    topic: p.topic,
    notifyChatId: p.notifyChatId,
    room: p.room ?? null,
    language: lang,
  };
  return { state, question: askAll(lang) };
}

export type LeadAdvance =
  | { action: 'ask_phone'; state: LeadCaptureState; reply: string }
  | { action: 'ask_name'; state: LeadCaptureState; reply: string }
  | { action: 'complete'; name: string; phone: string; reply: string }
  | { action: 'close'; reply: string };

/**
 * Telefonu metinden ayirir; geriye kalan (isim adayi) metni dondurur.
 * Rakam cevrimi phone.ts'in TEK KAYNAGINDAN gelir (ikinci regex kopyasi YOK):
 * AR/FA rakamli girdide numara ASCII'ye cevrildigi icin kalan metni ayni cevrilmis
 * kopyadan cikarmak gerekir.
 */
function splitPhone(text: string): { phone: string | null; rest: string } {
  const ascii = toAsciiDigits(String(text ?? ''));
  const phone = extractPhone(text);
  const rest = (phone ? ascii.replace(phone, ' ') : ascii).replace(/\s+/g, ' ').trim();
  return { phone, rest };
}

/**
 * Bekleyen lead turunda gelen mesaji degerlendirir (esnek doldurma).
 *
 * Her mesajda: telefon cikarilir, telefon DISI metin isim adayi sayilir; ikisi de
 * state'te birikir (once gelen KORUNUR — misafir ismini tekrar yazmak zorunda degil).
 *   isim + telefon -> COMPLETE (kart duser)
 *   yalniz isim    -> telefon istenir
 *   yalniz telefon -> isim istenir
 *   vazgecme       -> CLOSE (kart YOK)
 *
 * @param language opsiyonel override; verilmezse state.language kullanilir (tek kaynak).
 */
export function advanceLead(state: LeadCaptureState, text: string, language?: string | null): LeadAdvance {
  const incoming = String(text ?? '').trim();
  const lang = normalizeGuestLang(language ?? state.language ?? 'tr');

  // Bos mesaj pratikte bu noktaya ulasmaz (webhook bos metni islemez); yine de
  // sonsuz soru dongusu olmasin diye akis kapatilir.
  if (!incoming) return { action: 'close', reply: closeText(lang) };

  const { phone, rest } = splitPhone(incoming);

  // Vazgecme YALNIZ numara TASIMAYAN mesajda gecerlidir: "istemiyorum ama numaram
  // 0532..." diyen misafirin talebi yutulmasin.
  if (!phone && isLeadAbandon(incoming)) return { action: 'close', reply: closeText(lang) };

  const name = state.name || (rest || undefined);
  const nextPhone = state.phone || phone || undefined;

  if (name && nextPhone) {
    return { action: 'complete', name, phone: nextPhone, reply: thanksText(lang) };
  }

  const next: LeadCaptureState = { ...state, name, phone: nextPhone, language: lang };
  return name
    ? { action: 'ask_phone', state: next, reply: askPhone(lang) }
    : { action: 'ask_name', state: next, reply: askName(lang) };
}
