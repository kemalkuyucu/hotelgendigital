import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TelegramClient } from '@/lib/telegram/client';
import { verifyTelegramSecret } from '@/lib/telegram/verify';
import type { TelegramUpdate, TelegramMessage } from '@/lib/telegram/types';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import { classifyAndRespond } from '@/lib/ai/classify-and-respond';
import type { ConversationContextMessage } from '@/lib/ai/classify-and-respond';
import { resolveTargetDepartment, type DeptRouteInfo } from '@/lib/telegram/off-hours';
import { forwardToDepartment } from '@/lib/telegram/forward-to-department';
import { requiresVerification, MAX_VERIFICATION_ATTEMPTS } from '@/lib/ai/verification-intents';
import { parseVerificationInput, verifyGuest, isVerificationValid } from '@/lib/verification/verify-guest';
import { formatGuestAddress } from '@/lib/utils/salutation';
import { downloadTelegramAudio } from '@/lib/voice/download-telegram-audio';
import { whisperTranscribe } from '@/lib/voice/whisper-transcribe';
import { overrideSocialIntent } from '@/lib/ai/social-intent-override';
// Modül 11: SLA imports
import { handleSlaCallback } from '@/lib/sla/handle-callback';
import { handleReceptionReply } from '@/lib/sla/handle-reception-reply';
import { getTurkeyToday } from '@/lib/date/turkeyTime'; // Modül 18: timezone fix
import { sendForwardWithSlaButtons } from '@/lib/sla/send-forward-with-buttons';
// Modül 15.4: Auto-file belge gönderme
import {
  sendTelegramDocument,
  shouldSendDocument,
  findRelevantAutoFileDocument,
} from '@/lib/telegram/send-document';
// Modül 4: Alerjen bildirim yönlendirme
import { sendAllergenNotifications } from '@/lib/telegram/allergen-notify';
// Modül 16.b (refactor): meeting_rooms artık hotel-context.ts içinde HOTEL CONTEXT'e gömülü gelir.
// detectMeetingRoomIntent / formatMeetingRoomsBlock gate'i kaldırıldı.


export const runtime = 'nodejs';

// ============================================================
// KATMAN 1 — RATE LIMIT (module-level in-memory, cold start'ta sıfırlanır)
// 60 saniyelik sliding window'da kullanıcı başına max 10 mesaj.
// ============================================================
const _rateLimitMap = new Map<number, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 saniye
const RATE_LIMIT_MAX_MSGS  = 10;     // max 10 mesaj / pencere

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (_rateLimitMap.get(userId) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX_MSGS) {
    return false; // drop — sessizce
  }
  timestamps.push(now);
  _rateLimitMap.set(userId, timestamps);
  return true; // allow
}
// ── RATE LIMIT SONU ───────────────────────────────────────────────────────────

// ============================================================
// KATMAN 3 — URL FİLTRESİ regex (AI/Haiku token harcamadan)
// ============================================================
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]*|telegram\.me\/[^\s]*|[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tr|dev|app|info|biz|gov|edu|uk|de|fr|nl|es|it|pl|pt|se|no|fi|dk|be|at|ch|cz|sk|hu|ro|bg|hr|rs|si|lt|lv|ee|gr|cy|mt|lu|ie|is|li|ba|mk|al|ge|am|az|kz|uz|by|ua|mn|vn|th|ph|my|sg|id|in|pk|bd|lk|np|af|ir|iq|sa|ae|qa|kw|bh|om|jo|lb|sy|eg|ly|tn|dz|ma|gh|ng|ke|za|br|ar|cl|pe|ve|mx|ca|au|nz))(\/[^\s]*)?/i;

function containsUrl(text: string): boolean {
  return URL_PATTERN.test(text);
}
// ── URL FİLTRE SONU ──────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#+\s/gm, '');
}

export const dynamic = 'force-dynamic';

// ── ADIM 4B-1: Multi-intent forward helper ────────────────────────────────────

interface ForwardableItem {
  dept: string;
  chatId: number;
  requestText: string;
  rawDepartment: string;
}

function buildForwardableItems(
  classifiedIntents: any[] | undefined,
  fallbackIntent: string | null,
  departments: DeptRouteInfo[],
  fallbackRequestText: string,
): ForwardableItem[] {
  // classifiedIntents varsa onları kullan, yoksa legacy (tek intent)
  const intents =
    classifiedIntents && classifiedIntents.length > 0
      ? classifiedIntents
      : [
          {
            department: fallbackIntent ?? 'unknown',
            requestText: fallbackRequestText,
            shouldForward: true,
            rawDepartment: fallbackIntent ?? 'unknown',
          },
        ];

  const items: ForwardableItem[] = [];
  for (const item of intents) {
    if (!item.shouldForward) continue;
    const resolved = resolveTargetDepartment(item.department, departments);
    if (!resolved || !resolved.targetChatId) continue;
    items.push({
      dept: resolved.targetDept ?? item.department,
      chatId: resolved.targetChatId,
      requestText: item.requestText || fallbackRequestText,
      rawDepartment: item.rawDepartment ?? item.department,
    });
  }
  return items;
}

/**
 * Bot token'ı belirle:
 * 1. demo-hotel → env var (geriye dönük uyumluluk)
 * 2. Diğer oteller → bridge_credentials tablosundan decrypt et
 */
async function getBotTokenForHotel(
  slug: string,
  hotelId: string,
): Promise<string | null> {
  if (slug === 'demo-hotel') {
    return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  }
  // Tenant oteller: bridge_credentials'dan decrypt et
  const bridge = await getDecryptedBridge(hotelId);
  return bridge?.telegramBotToken ?? null;
}

function getDemoHotelClient(): SupabaseClient | null {
  const url = process.env.DEMO_HOTEL_SUPABASE_URL;
  const key = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getSupaClientForSlug(
  slug: string,
  hotelId: string,
): Promise<SupabaseClient | null> {
  if (slug === 'demo-hotel') return getDemoHotelClient();
  return getHotelClient(hotelId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hotelSlug: string }> },
) {
  const { hotelSlug } = await params;

  const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (!verifyTelegramSecret(headerSecret, expected)) {
    return NextResponse.json({ ok: false, error: 'invalid secret' }, { status: 401 });
  }

  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    return NextResponse.json({ ok: false, error: 'hotel not found' }, { status: 404 });
  }
  if (hotel.status === 'suspended' || hotel.status === 'cancelled') {
    return NextResponse.json({ ok: true, info: 'hotel inactive' });
  }

  const botToken = await getBotTokenForHotel(hotelSlug, hotel.id);
  if (!botToken) {
    console.error(`[telegram] bot token yok — slug=${hotelSlug} hotelId=${hotel.id}. Bridge credentials'da telegram_bot_token_encrypted eksik.`);
    return NextResponse.json({ ok: true, info: 'no token' });
  }
  const tg = new TelegramClient(botToken);

  const supa = await getSupaClientForSlug(hotelSlug, hotel.id);
  if (!supa) {
    console.error(`[telegram] hotel client alınamadı: ${hotelSlug} / ${hotel.id}`);
    return NextResponse.json({ ok: true, info: 'no db client' });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // ============================================================
  // MODÜL 11: callback_query dispatch (inline button basımları)
  // ============================================================
  if (update.callback_query) {
    const cq = update.callback_query;

    if (cq.data?.startsWith('sla:respond:')) {
      await handleSlaCallback({
        hotelSupabase: supa,
        botToken,
        callbackQueryId: cq.id,
        callbackData: cq.data,
        fromTelegramId: String(cq.from.id),
        fromUsername: cq.from.username,
        fromFirstName: cq.from.first_name,
      });
      return NextResponse.json({ ok: true });
    }

    // SLA noop (kaldırılmış butona basıldı)
    if (cq.data === 'sla:noop') {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id, text: 'Bu talep zaten işlendi' }),
      });
      return NextResponse.json({ ok: true });
    }

    // Diğer callback'ler — şimdilik yoksay
    return NextResponse.json({ ok: true });
  }

  const msg = update.message ?? update.edited_message;
  if (!msg) {
    return NextResponse.json({ ok: true, info: 'no message' });
  }

  // ============================================================
  // MODÜL 11: Resepsiyon grup reply → SLA escalation reply handler
  // Grup mesajı + reply_to varsa, SLA escalation mesajına reply mi kontrol et
  // ============================================================
  if (
    msg.reply_to_message?.message_id &&
    msg.chat?.type !== 'private' &&
    msg.text
  ) {
    try {
      const result = await handleReceptionReply({
        hotelSupabase: supa,
        botToken,
        chatId: String(msg.chat.id),
        replyToMessageId: msg.reply_to_message.message_id,
        replyText: msg.text,
        responderTelegramId: String(msg.from?.id ?? 0),
      });
      if (result.handled) {
        return NextResponse.json({ ok: true });
      }
    } catch (replyErr) {
      console.error('[telegram] handleReceptionReply error:', replyErr);
    }
  }

  try {
    await handleMessage({ supa, hotelId: hotel.id, hotelName: hotel.name, hotelSlug, msg, tg, botToken });
  } catch (err) {
    console.error('[telegram] handleMessage error:', err);

    // ── Modül 17.7-C: Bot kritik hata bildirimi ─────────────────────────────
    // Önbüro grubuna bildirim gönder — sessizce yut, webhook 200 dön.
    try {
      const { data: foDept } = await supa
        .from('departments')
        .select('telegram_chat_id')
        .eq('code', 'front_office')
        .maybeSingle();

      if (foDept?.telegram_chat_id) {
        const foChatId = Number(foDept.telegram_chat_id);
        const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
        const alertText =
          `🔴 BOT HATASI\n\n` +
          `Misafir mesaj attı, bot cevap veremedi.\n\n` +
          `Chat ID: ${update.message?.chat.id ?? '—'}\n` +
          `Otel: ${hotelSlug}\n` +
          `Hata: ${errorMessage}\n` +
          `Zaman: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`;

        await tg.sendMessage({ chat_id: foChatId, text: alertText });
        console.log(`[17.7-C] Bot kritik hata bildirimi gönderildi → chatId=${foChatId}`);
      } else {
        console.warn('[17.7-C] front_office telegram_chat_id bulunamadı, bildirim atlandı');
      }
    } catch (notifyErr) {
      console.error('[17.7-C] Bot kritik hata bildirimi gönderilemedi:', notifyErr instanceof Error ? notifyErr.message : notifyErr);
    }
    // ── Modül 17.7-C SONU ────────────────────────────────────────────────────
  }

  return NextResponse.json({ ok: true });
}

// ── Verification mesaj şablonları ─────────────────────────────────────────────

function getVerificationAskMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Yardımcı olabilmemiz için lütfen oda numaranızı, adınızı ve soyadınızı paylaşır mısınız? Örnek: 312 Kemal Kuyucu',
    en: 'To process your request, could you share your room number, first name, and last name? Example: 312 John Smith',
    de: 'Bitte teilen Sie uns Ihre Zimmernummer, Vorname und Nachname mit. Beispiel: 312 Hans Müller',
    ru: 'Чтобы обработать ваш запрос, укажите номер комнаты, имя и фамилию. Пример: 312 Иван Иванов',
    ar: 'يرجى مشاركة رقم غرفتك واسمك الأول واسم العائلة. مثال: 312 محمد علي',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getVerificationFailMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Bilgilerinizi doğrulayamadım. Oda numarası ve soyadınızı kontrol edip tekrar deneyebilir misiniz? Örnek: 312 Kuyucu',
    en: 'I could not verify your details. Could you double-check your room number and last name and try again? Example: 312 Smith',
    de: 'Ihre Angaben konnten nicht bestätigt werden. Bitte prüfen Sie Zimmernummer und Nachname. Beispiel: 312 Müller',
    ru: 'Не удалось подтвердить данные. Проверьте номер комнаты и фамилию и попробуйте снова. Пример: 312 Иванов',
    ar: 'تعذّر التحقق من بياناتك. يرجى التحقق من رقم الغرفة واسم العائلة والمحاولة مجدداً. مثال: 312 علي',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getVerificationLockedMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Birkaç deneme sonuç vermedi. Sizi resepsiyonumuza yönlendiriyorum, orada hemen yardımcı olacaklar.',
    en: 'After a few attempts, I wasn\'t able to verify your details. Please visit our front desk — they will be happy to help.',
    de: 'Nach mehreren Versuchen konnte ich Ihre Daten nicht bestätigen. Bitte wenden Sie sich an unsere Rezeption.',
    ru: 'После нескольких попыток не удалось подтвердить данные. Пожалуйста, обратитесь на стойку регистрации.',
    ar: 'بعد عدة محاولات، لم أتمكن من التحقق من بياناتك. يرجى التوجه إلى مكتب الاستقبال للمساعدة.',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getIncompleteFormatMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Oda numaranızı, adınızı ve soyadınızı birlikte belirtmeniz gerekiyor. Örnek: 312 Kemal Kuyucu',
    en: 'Please provide your room number, first name, and last name together. Example: 312 John Smith',
    de: 'Bitte geben Sie Ihre Zimmernummer, Vorname und Nachname zusammen an. Beispiel: 312 Hans Müller',
    ru: 'Пожалуйста, укажите номер комнаты, имя и фамилию вместе. Пример: 312 Иван Иванов',
    ar: 'يرجى توفير رقم الغرفة والاسم الأول واسم العائلة معاً. مثال: 312 محمد علي',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getReVerificationMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Hoş geldiniz! Önceki konaklamaniz sona ermiş görünüyor. Yeniden talepte bulunmak için lütfen oda numaranızı, adınızı ve soyadınızı paylaşır mısınız? Örnek: 312 Kemal Kuyucu',
    en: 'Welcome back! Your previous stay appears to have ended. To make a new request, please share your room number, first name, and last name. Example: 312 John Smith',
    de: 'Willkommen! Ihr vorheriger Aufenthalt scheint beendet zu sein. Bitte teilen Sie Zimmernummer, Vorname und Nachname mit. Beispiel: 312 Hans Müller',
    ru: 'Добро пожаловать! Предыдущее пребывание завершено. Укажите номер комнаты, имя и фамилию. Пример: 312 Иван Иванов',
    ar: 'مرحباً! يبدو أن إقامتك السابقة قد انتهت. لتقديم طلب جديد، يرجى مشاركة رقم غرفتك واسمك الأول واسم العائلة. مثال: 312 محمد علي',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getVerificationSuccessMsg(
  lang: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  gender: 'male' | 'female' | null | undefined,
): string {
  const address = formatGuestAddress(firstName ?? null, lastName ?? null, lang, gender);
  const addrPart = address ? `, ${address}` : '';
  const msgs: Record<string, string> = {
    tr: `Bilgileriniz doğrulandı${addrPart}. Talebinizi iletiyorum.`,
    en: `Your details have been verified${addrPart}. I'm forwarding your request now.`,
    de: `Ihre Daten wurden verifiziert${addrPart}. Ich leite Ihre Anfrage weiter.`,
    ru: `Ваши данные подтверждены${addrPart}. Перенаправляю ваш запрос.`,
    ar: `تم التحقق من بياناتك${addrPart ? `، ${address}` : ''}. جاري إحالة طلبك.`,
  };
  return msgs[lang] ?? msgs['tr'];
}

// ── Dil tespiti (basit — misafirin Telegram language_code veya önceki mesaj dili) ──

function detectLanguage(msg: TelegramMessage): string {
  const code = msg.from?.language_code ?? 'tr';
  if (code.startsWith('tr')) return 'tr';
  if (code.startsWith('en')) return 'en';
  if (code.startsWith('de')) return 'de';
  if (code.startsWith('ru')) return 'ru';
  if (code.startsWith('ar')) return 'ar';
  return 'tr';
}

// ── Bilgi sorusu tespiti (Module 17.c bypass) ────────────────────────────────
//
// Misafir oda no vermeden GENEL BİLGİ sorusu soruyorsa (toplantı salonu,
// wifi, adres, telefon, otel hizmetleri vb.) — oda no zorunluluğunu atlat.
// Sadece kişisel talep/şikayet/servis için oda no bağlantısı gereklidir.
//
// Yaklaşım: keyword tabanlı pre-classifier (detectInterestTag + social-intent-override
// ile aynı mantık). AI'dan önce çalışır — ucuz ve hızlı.

function isInfoOnlyQuery(text: string): boolean {
  if (!text || text.trim().length < 2) return false;

  const t = text
    .toLowerCase()
    .replace(/[İ]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .replace(/[Ii]/g, 'i');

  // ── 1. Açık "konaklamıyorum / bilgi almak istiyorum" bildirimleri ─────────
  const nonGuestPatterns = [
    'konaklam', // konaklamıyorum, konaklama
    'misafir degil', 'musteri degil',
    'bilgi almak', 'bilgi istiyorum', 'bilgi alabilir',
    'sormak istiyorum', 'merak ediyorum',
    'rezervasyon yaptirmak', 'rezervasyon yapmak',
  ];
  if (nonGuestPatterns.some((p) => t.includes(p))) return true;

  // ── 2. Sıradan selamlama / sosyal mesaj ───────────────────────────────────
  const socialPatterns = [
    'merhaba', 'selam', 'iyi gunler', 'iyi aksamlar', 'iyi geceler',
    'nasils', 'nasilsin', 'hello', 'hi ', 'hey ',
    'tesekkur', 'sagol', 'tamam', 'peki', 'anladim',
  ];
  if (socialPatterns.some((p) => t.includes(p))) return true;

  // ── 3. Otel hizmetleri / genel bilgi soruları ─────────────────────────────
  const infoKeywords = [
    // Toplantı / salon / etkinlik — GENİŞLETİLDİ
    'toplanti', 'toplanti salon', 'konferans', 'konferans salon', 'event',
    'balo', 'balo salon', 'seminer', 'sempozyum', 'kongre',
    'organizasyon', 'etkinlik', 'dugun', 'nisan', 'kokteyl',
    // Toplantı ekipmanları — YENİ
    'projeksiyon', 'mikrofon', 'ses sistemi', 'ekran', 'beyaz tahta',
    'tahta', 'flip chart', 'iklimlendirme', 'kapasi', 'kac kisilik',
    // Konaklama/rezervasyon bilgisi
    'check-in', 'check in', 'check-out', 'check out',
    'oda fiyat', 'fiyat nedir', 'fiyat listesi', 'tarife',
    'musaitlik', 'uygun oda', 'bos oda',
    // Otel olanakları
    'havuz', 'spa', 'restoran', 'kahvalti', 'bar ', 'fitness',
    'otopark', 'vale', 'transfer', 'servis',
    'wifi', 'internet', 'sifre', 'parola',
    // Adres / konum
    'adres', 'nerede', 'konum', 'ulasim', 'nasil gelinir',
    'yol tarifi', 'harita', 'maps',
    // İletişim
    'telefon', 'mail', 'eposta', 'iletisim',
    // Pet / genel
    'pet', 'hayvan', 'evcil',
    'sigara', 'smoking',
    // Bilgi sorusu kalıpları — GENİŞLETİLDİ
    'var mi', 'var mi?', 'hizmet veriyor', 'sunuluyor',
    'saatler', 'calisma saati', 'acilis', 'kapanis',
    'kac', 'kacta', 'ne zaman', 'nasil',
    'ozellik', 'imkan', 'ozellikler', 'imkanlar',
  ];
  if (infoKeywords.some((p) => t.includes(p))) return true;

  // ── 4. Soru işareti içeren kısa mesajlar (talep değil, sorgu) ────────────
  // "?" + uzunluk < 80 → büyük ihtimalle bilgi sorusu
  if (t.includes('?') && text.trim().length < 80) return true;

  return false;
}

// ── Doğrulama akışı ────────────────────────────────────────────────────────────

interface ConversationState {
  id: string;
  verified_inhouse_guest_id: string | null;
  verified_at: string | null;
  verification_pending_intent: string | null;
  verification_attempts: number;
  pending_request_text: string | null; // Modül 10.4: doğrulama öncesi orijinal talep
  // Modül 3 — Alerjen akışı
  allergen_asked: boolean;   // Bu konuşmada alerji sorusu soruldu mu?
  allergen_pending: boolean; // Şu an alerji cevabı bekleniyor mu?
  // Modül 3 — Alerjen State İzolasyonu (015_allergen_state_isolation)
  allergen_verify_pending: boolean;       // Oda no + isim doğrulaması bekleniyor (allergen_room_verify mini flow)
  allergen_verify_pending_at: string | null; // TTL timestamp — 24h sonra otomatik temizlenir
  allergen_verify_attempts: number;         // Max 3 deneme
}

interface VerificationFlowResult {
  shouldShortCircuit: boolean;
  replyText: string;
  verifiedGuestId: string | null;
  effectiveIntent: string;
  embeddedRequest?: string | null; // hasEmbeddedRequest=true ise talep metni
  originalRequestText?: string | null; // Modül 10.4: orijinal talep (forward için)
  // Doğrulama başarılı olunca tüm inhouse_guests alanları
  verifiedGuestRecord?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    room_number: string;
    language: string | null;
    gender: string | null;
  } | null;
}

async function notifyFrontDeskUnverified(params: {
  hotelSupabase: SupabaseClient;
  botToken: string;
  tg: TelegramClient;
  conversationId: string;
  guestTelegramId: string;
  guestTelegramUsername: string | null;
  pendingIntent: string;
  attemptedRoomNumber: string | null;
  attemptedLastName: string | null;
  originalMessage: string;
  language: string;
}): Promise<void> {
  // 1) Demo_OnBuro chat_id'sini çek
  const { data: dept } = await params.hotelSupabase
    .from('departments')
    .select('telegram_chat_id, name')
    .eq('code', 'front_office')
    .maybeSingle();

  if (!dept?.telegram_chat_id) {
    console.warn('[unverified-notify] front_office grup chat_id yok');
    return;
  }

  const frontOfficeChatId = dept.telegram_chat_id as number;

  // 2) HTML mesajı hazırla
  const intentLabel: Record<string, string> = {
    allergy: '🧴 Alerji bildirimi',
    room_service: '🛎 Oda servisi talebi',
    complaint: '⚠️ Şikayet',
    billing: '💳 Fatura/hesap',
    lost_and_found: '🔍 Kayıp eşya',
  };

  const html =
    `🚨 <b>Kayıt Dışı Misafir Talebi</b>\n\n` +
    `${intentLabel[params.pendingIntent] || params.pendingIntent}\n\n` +
    `📞 <b>Telegram:</b> ${params.guestTelegramUsername ? '@' + params.guestTelegramUsername : 'ID ' + params.guestTelegramId}\n` +
    `🚪 <b>Beyan ettiği oda:</b> ${params.attemptedRoomNumber || '—'}\n` +
    `👤 <b>Beyan ettiği soyad:</b> ${params.attemptedLastName || '—'}\n` +
    `🌐 <b>Dil:</b> ${params.language || '—'}\n\n` +
    `📝 <b>İlk mesaj:</b>\n<i>${escapeHtml(params.originalMessage)}</i>\n\n` +
    `❗ Bu kişi in-house listede yok. Lütfen kontrol edip gerekirse panelden ekleyin.`;

  // 3) Telegram'a gönder
  try {
    await params.tg.sendMessage({
      chat_id: frontOfficeChatId,
      text: html,
      parse_mode: 'HTML',
    });
    console.log(`[unverified-notify] front_office bildirimi gönderildi → chatId=${frontOfficeChatId}`);
  } catch (err) {
    console.error('[unverified-notify] Telegram gönderim hatası:', err instanceof Error ? err.message : err);
    return;
  }

  // 4) forwarded_messages tablosuna log
  await params.hotelSupabase.from('forwarded_messages').insert({
    conversation_id: params.conversationId,
    department_code: 'front_office',
    target_type: 'unverified_alert',
    target_chat_id: frontOfficeChatId,
    message_html: html,
    sent_at: new Date().toISOString(),
    source_department: params.pendingIntent,
    target_department: 'front_office',
    status: 'sent',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function handleVerificationFlow(args: {
  supa: SupabaseClient;
  tg: TelegramClient;
  botToken: string;
  conversationId: string;
  conversation: ConversationState;
  guestMessageText: string;
  guestTelegramId: string;
  guestTelegramUsername: string | null;
  aiIntent: string;
  aiReplyText: string;
  language: string;
}): Promise<VerificationFlowResult> {
  const { supa, tg, botToken, conversationId, conversation, guestMessageText, aiIntent, language } = args;

  // 1. Zaten doğrulanmış ve TTL geçerli → normal akışa devam
  if (
    conversation.verified_inhouse_guest_id &&
    isVerificationValid(conversation.verified_at)
  ) {
    console.log(`[verification] Zaten doğrulanmış guest_id=${conversation.verified_inhouse_guest_id}`);
    return {
      shouldShortCircuit: false,
      replyText: args.aiReplyText,
      verifiedGuestId: conversation.verified_inhouse_guest_id,
      effectiveIntent: aiIntent,
    };
  }

  // 2. Kilitlenmiş mi? (attempts >= MAX ve hâlâ doğrulanmamış)
  if (conversation.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
    console.log(`[verification] Kilitli — attempts=${conversation.verification_attempts}`);
    const lockedMsg = getVerificationLockedMsg(language);
    return {
      shouldShortCircuit: true,
      replyText: lockedMsg,
      verifiedGuestId: null,
      effectiveIntent: 'front_office',
    };
  }

  // 3. Mesajda doğrulama bilgisi var mı? (yeni parseVerificationInput kullan)
  const parsed = parseVerificationInput(guestMessageText);
  const { roomNumber, firstName, lastName, hasEmbeddedRequest, embeddedRequest } = parsed;
  const hasCredentials = roomNumber !== null && firstName !== null && lastName !== null;

  if (!hasCredentials) {
    if (!conversation.verification_pending_intent) {
      // İlk kez intent geldi, henüz sormadık → pending_intent kaydet, sor
      // Aynı zamanda eski birikmiş attempts'i sıfırla (fresh start)
      const pendingIntent = aiIntent;
      // Modül 10.4: Orijinal talebi pending_request_text olarak sakla
      await supa
        .from('conversations')
        .update({
          verification_pending_intent: pendingIntent,
          verification_attempts: 0,
          verification_last_attempt_at: null,
          pending_request_text: guestMessageText, // ← ORİJİNAL TALEBİ SAKLA
        })
        .eq('id', conversationId);

      console.log(`[verification] İlk intent — pending_intent=${pendingIntent} kaydedildi, credentials isteniyor`);
      const askMsg = getVerificationAskMsg(language);
      return {
        shouldShortCircuit: true,
        replyText: askMsg,
        verifiedGuestId: null,
        effectiveIntent: aiIntent,
      };
    } else {
      // Daha önce sorduk ama kullanıcı eksik bilgi gönderdi (sadece oda no veya sadece soyad)
      // attempts artırma — bu bir format hatası, yanlış girişim sayılmaz
      console.log(`[verification] Eksik format — pending_intent=${conversation.verification_pending_intent}, roomNumber=${roomNumber}, lastName=${lastName}`);
      const incompleteMsg = getIncompleteFormatMsg(language);
      return {
        shouldShortCircuit: true,
        replyText: incompleteMsg,
        verifiedGuestId: null,
        effectiveIntent: aiIntent,
      };
    }
  }

  // 4. Doğrulama bilgisi var — verifyGuest çağır
  console.log(`[verification] Deneniyor: room=${roomNumber} firstName=${firstName} lastName=${lastName} hasEmbeddedRequest=${hasEmbeddedRequest}`);
  const result = await verifyGuest(supa, roomNumber!, firstName!, lastName!);

  void supa.from('verification_attempts').insert({
    conversation_id: conversationId,
    attempted_room_no: roomNumber,
    attempted_last_name: lastName,
    result: result.matched ? 'success' : 'no_match',
    matched_guest_id: result.matched ? result.guestId : null,
    intent_at_attempt: conversation.verification_pending_intent ?? aiIntent,
  });

  if (result.matched) {
    // ✅ Doğrulama başarılı
    const effectiveIntent = conversation.verification_pending_intent ?? aiIntent;
    // Modül 10.4: Orijinal talebi al, ardından pending'i temizle
    const originalRequestText = conversation.pending_request_text || null;
    const verifiedAt = new Date().toISOString();
    await supa
      .from('conversations')
      .update({
        verified_inhouse_guest_id: result.guestId,
        verified_at: verifiedAt,
        verification_pending_intent: null,
        verification_attempts: 0,
        verification_last_attempt_at: verifiedAt,
        pending_request_text: null, // ← TEMİZLE (forward sonrası)
      })
      .eq('id', conversationId);

    // Bug 1 fix: in-memory conversation nesnesini DB ile senkronize et.
    // Aksi halde Modül 3'teki verificationIsActive hesabı eski (stale)
    // nesneyi görür, TRUE döner ve canAskAllergen=false olur.
    conversation.verification_pending_intent = null;
    conversation.verified_at = verifiedAt;

    // Doğrulanmış misafirin tam kaydını çek (forward + CC için)
    let verifiedGuestRecord: VerificationFlowResult['verifiedGuestRecord'] = null;
    if (result.guestId) {
      const { data: gRec } = await supa
        .from('inhouse_guests')
        .select('id, first_name, last_name, room_number, language, gender')
        .eq('id', result.guestId)
        .maybeSingle();
      if (gRec) {
        verifiedGuestRecord = {
          id: gRec.id as string,
          first_name: gRec.first_name as string | null,
          last_name: gRec.last_name as string | null,
          room_number: gRec.room_number as string,
          language: gRec.language as string | null,
          gender: gRec.gender as string | null,
        };
      }
    }

    // Salutation helper ile hitap üret
    const successMsg = getVerificationSuccessMsg(
      result.guestLanguage ?? language,
      result.guestFirstName ?? null,
      result.guestLastName ?? null,
      result.guestGender ?? null,
    );
    console.log(`[verification] Başarılı — guest_id=${result.guestId} effectiveIntent=${effectiveIntent} hasEmbeddedRequest=${hasEmbeddedRequest} originalRequest="${originalRequestText}"`);
    return {
      shouldShortCircuit: false,
      replyText: successMsg,
      verifiedGuestId: result.guestId ?? null,
      effectiveIntent,
      embeddedRequest: hasEmbeddedRequest ? (embeddedRequest ?? null) : null,
      originalRequestText, // Modül 10.4: orijinal talep (forward için)
      verifiedGuestRecord,  // Modül 10.4: tam inhouse_guests kaydı
    };
  } else {
    // ❌ Eşleşme yok — attempts artır
    const newAttempts = conversation.verification_attempts + 1;
    await supa
      .from('conversations')
      .update({
        verification_attempts: newAttempts,
        verification_last_attempt_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (newAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      // Kilitlendi → ön büroya bildirim gönder
      console.log(`[verification] Kilitlendi — attempts=${newAttempts}`);

      // Bildirim — void (hata olsa bile kilidi uygula)
      void notifyFrontDeskUnverified({
        hotelSupabase: supa,
        botToken,
        tg,
        conversationId,
        guestTelegramId: args.guestTelegramId,
        guestTelegramUsername: args.guestTelegramUsername,
        pendingIntent: conversation.verification_pending_intent ?? aiIntent,
        attemptedRoomNumber: roomNumber,
        attemptedLastName: lastName,
        originalMessage: guestMessageText,
        language,
      });

      const lockedMsg = getVerificationLockedMsg(language);
      return {
        shouldShortCircuit: true,
        replyText: lockedMsg,
        verifiedGuestId: null,
        effectiveIntent: 'front_office',
      };
    }

    const failMsg = getVerificationFailMsg(language);
    return {
      shouldShortCircuit: true,
      replyText: failMsg,
      verifiedGuestId: null,
      effectiveIntent: aiIntent,
    };
  }
}

// ── Ana mesaj işleyici ────────────────────────────────────────────────────────

async function handleMessage(args: {
  supa: SupabaseClient;
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  msg: TelegramMessage;
  tg: TelegramClient;
  botToken: string;
}) {
  const { supa, hotelId, hotelName, hotelSlug, msg, tg, botToken } = args;
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  // ============================================================
  // KATMAN 1 — RATE LIMIT GATE (AI/DB'den önce — para riski sıfır)
  // ============================================================
  if (userId !== undefined) {
    if (!checkRateLimit(userId)) {
      console.log(`[rate-limit] dropped user=${userId}`);
      return; // HTTP 200 dönecek (sessizce, spammer anlamasın)
    }
  }
  // ── RATE LIMIT GATE SONU ─────────────────────────────────────────────────

  // ============================================================
  // MODÜL 10.5 — VOICE DETECTION
  // ============================================================
  let rawText = msg.text ?? msg.caption ?? '';

  const voiceObj = msg.voice || msg.audio;
  if (!rawText && voiceObj) {
    // Süre limiti: 5 dakika (300 saniye)
    if (voiceObj.duration && voiceObj.duration > 300) {
      await tg.sendMessage({
        chat_id: chatId,
        text: '⏳ Ses mesajınız çok uzun (5 dakikadan fazla). Lütfen daha kısa bir ses kaydı gönderir misiniz, ya da mesajınızı yazılı paylaşır mısınız?',
      });
      return;
    }
    try {
      const audio = await downloadTelegramAudio({
        botToken,
        fileId: voiceObj.file_id,
        durationSeconds: voiceObj.duration,
      });
      const transcript = await whisperTranscribe({
        audioBuffer: audio.buffer,
        filename: audio.filename,
        mimeType: audio.mimeType,
        promptHint: `${hotelName} otelinde misafir mesajı. Misafir oda, talep, şikayet veya bilgi sorusu iletebilir.`,
      });
      if (!transcript.text || transcript.text.length < 2) {
        await tg.sendMessage({
          chat_id: chatId,
          text: '🎤 Sesinizi anlayamadım. Lütfen tekrar deneyebilir misiniz, ya da mesajınızı yazılı paylaşır mısınız?',
        });
        return;
      }
      rawText = transcript.text;
      console.log('[voice]', {
        chatId,
        duration: voiceObj.duration,
        transcript: transcript.text.slice(0, 100),
        language: transcript.language,
      });
    } catch (err: unknown) {
      console.error('[voice] error:', err);
      await tg.sendMessage({
        chat_id: chatId,
        text: '🎤 Ses mesajınızı işlerken bir sorun oluştu. Lütfen yazılı tekrar dener misiniz?',
      });
      return;
    }
  }

  const text = rawText;
  // ============================================================
  // VOICE DETECTION SONU
  // ============================================================

  if (msg.chat.type !== 'private') {
    console.log(`[telegram] grup mesajı atlandı: chat ${chatId} (${msg.chat.type})`);
    return;
  }

  if (!userId) return;

  // ============================================================
  // KATMAN 2 — MEDYA FİLTRESİ (rate limit'ten sonra, safety'den önce)
  // Voice/audio zaten yukarıda Whisper ile transcript'e çevrildi.
  // Diğer medya tipleri: photo, video, document, sticker, animation, video_note.
  // Caption varsa rawText zaten dolu → bu if'e girmez, normal akışa devam.
  // Caption yoksa rawText boş → sabit cevap, AI'a/classifier'a gitme.
  // ============================================================
  {
    const hasNonAudioMedia =
      !!msg.photo ||
      !!msg.video ||
      !!msg.document ||
      !!msg.sticker ||
      !!msg.animation ||
      !!msg.video_note;

    if (hasNonAudioMedia && !text) {
      const mediaType =
        msg.photo     ? 'photo'      :
        msg.video     ? 'video'      :
        msg.document  ? 'document'   :
        msg.sticker   ? 'sticker'    :
        msg.animation ? 'animation'  :
        'video_note';
      console.log(`[media-filter] type=${mediaType} user=${userId}`);
      await tg.sendMessage({
        chat_id: chatId,
        text: 'Sadece metin mesajlarına yardımcı olabiliyorum. Sorunuzu yazabilir misiniz? 🙂',
      });
      return;
    }
  }
  // ── MEDYA FİLTRESİ SONU ──────────────────────────────────────────────────

  // ============================================================
  // KATMAN 3 — URL FİLTRESİ (medya filtresinden sonra, safety'den önce)
  // Regex tabanlı — AI/Haiku token harcamadan çalışır, DB kaydı yok.
  // ============================================================
  if (text && containsUrl(text)) {
    console.log(`[url-filter] user=${userId}`);
    await tg.sendMessage({
      chat_id: chatId,
      text: 'Lütfen sorunuzu yazılı olarak iletebilir misiniz? Link içeren mesajları işleyemiyoruz.',
    });
    return;
  }
  // ── URL FİLTRESİ SONU ────────────────────────────────────────────────────

  if (text.startsWith('/start')) {
    // Fix C: /start → sadece sıcak hoşgeldin mesajı. Oda no SORMA.
    // Misafir mesaj yazınca AI bilgi sorusu mu / talep mi ayırt eder.
    // Talep ise (oda servisi, şikayet vb.) o zaman oda no istenir.
    await upsertGuestAndConversation({ supa, msg });

    // Dinamik otel adı: hotel_settings.hotel_name > hotels.name
    const { data: hsRow } = await supa
      .from('hotel_settings')
      .select('hotel_name')
      .limit(1)
      .maybeSingle();
    const displayHotelName = (hsRow?.hotel_name as string | null | undefined) || hotelName;

    await tg.sendMessage({
      chat_id: chatId,
      text: `Merhaba! ${displayHotelName}'e hos geldiniz. Size nasil yardimci olabilirim?`,
    });
    return;
  }
  if (text.startsWith('/help')) {
    await tg.sendMessage({
      chat_id: chatId,
      text: 'Bot kullanımı:\n• Mesajınızı yazın, otelimize ulaşır.\n• Sesli mesaj gönderebilirsiniz.\n• Fotoğraf ekleyebilirsiniz.\n\nDestek için resepsiyona da ulaşabilirsiniz.',
    });
    return;
  }

  const { guestName, conversationId, conversation } = await upsertGuestAndConversation({ supa, msg });
  const language = detectLanguage(msg);

  // ============================================================
  // MODULE 17.c — INHOUSE GUEST MATCHING GATE
  // If not yet linked to inhouse_guests_v2 → handle room number flow
  // ============================================================
  {
    // Check if conversation has inhouse_match_guest_id set
    const { data: convMatch } = await supa
      .from('conversations')
      .select('inhouse_match_guest_id, multi_match_pending_room, multi_match_attempts, multi_match_notified')
      .eq('id', conversationId)
      .maybeSingle();

    const isLinkedToInhouse = !!(convMatch?.inhouse_match_guest_id);
    const multiMatchPendingRoom = (convMatch?.multi_match_pending_room as string | null) ?? null;
    const multiMatchAttempts = (convMatch?.multi_match_attempts as number) ?? 0;
    const multiMatchNotified = (convMatch?.multi_match_notified as boolean) ?? false;

    if (!isLinkedToInhouse) {
      // ── Modül 17.c: Bilgi sorusu bypass ──────────────────────────────────────
      // Misafir oda no vermeden sadece bilgi sorusu soruyorsa (salon, wifi, adres vb.)
      // oda no bağlantısı zorunlu DEĞİL — AI'a ilet, doğrulama gate'ine düşürme.
      // Sadece kişisel talep/şikayet/servis için oda no bağlantısı gerekli.
      if (isInfoOnlyQuery(text)) {
        console.log(`[17c] Bilgi sorusu tespit edildi — oda no gate atlanıyor. text="${text.slice(0, 80)}"`);
        // Fall through: Module 17.c block sona erer, normal AI akışı başlar.
      } else {
      // Treat message as a room number attempt
      const roomAttempt = text.trim().replace(/[^0-9a-zA-Z]/g, '');
      const looksLikeRoom = /^\d{1,4}[a-zA-Z]?$/.test(roomAttempt) && roomAttempt.length > 0;

      if (looksLikeRoom) {
        console.log(`[17c] Room matching attempt: userId=${userId} room="${roomAttempt}"`);

        const { data: roomMatches } = await supa
          .from('inhouse_guests_v2')
          .select('id, guest_name, room_number')
          .eq('room_number', roomAttempt)
          .eq('status', 'active');

        if (!roomMatches || roomMatches.length === 0) {
          // No match → (1) misafire hemen cevap, (2) DB'ye kaydet, (3) önbüro bildirimi

          // ── ADIM 1: Misafire önce cevap ver (misafir beklesin) ────────────
          await tg.sendMessage({
            chat_id: chatId,
            text: 'Belirtilen oda numarasinda kayit bulunamadi. Ondan emin olmak icin resepsiyonu bilgilendiriyorum, lutfen bekleyin.',
          });

          // ── ADIM 2: pending_guest_matches tablosuna kaydet ────────────────
          await supa.from('pending_guest_matches').insert({
            telegram_id: userId,
            platform: 'telegram',
            attempted_room_number: roomAttempt,
            message_excerpt: text.slice(0, 200),
          });
          console.log(`[17c] No inhouse match for room=${roomAttempt}, logged pending_guest_match`);

          // ── ADIM 3 (MODÜL 17.7): Önbüro grubuna anlık Telegram bildirimi ──
          // void yerine await — Vercel Hobby'de void fire-and-forget response
          // sonrası kill edildiğinden bildirim gitmiyordu.
          try {
            const { data: foDept } = await supa
              .from('departments')
              .select('telegram_chat_id')
              .eq('code', 'front_office')
              .maybeSingle();

            if (!foDept?.telegram_chat_id) {
              console.warn('[17.7] front_office telegram_chat_id bulunamadı, bildirim atlandı');
            } else {
              const foChatId = Number(foDept.telegram_chat_id);
              const now = new Date();
              const timeStr =
                `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')} ` +
                `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              const frontOfficeUrl = `https://hotelgen-v2.vercel.app/hotel-admin/${hotelSlug}/front-office`;

              const alertText =
                `⚠️ KONAKLAYAN MISAFIR ESLESMIYOR\n\n` +
                `Misafirden alinan oda numarasi sistemdeki in-house listesiyle eslesmedi. Lutfen guncel in-house listesini sisteme yeniden yukleyin ve bu misafiri manuel olarak eslestirin.\n\n` +
                `📱 Platform: Telegram\n` +
                `🆔 Misafir ID: ${userId}\n` +
                `🚪 Denenen Oda: ${roomAttempt}\n` +
                `🕐 Saat: ${timeStr}\n\n` +
                `👉 Front-Office paneli:\n` +
                frontOfficeUrl;

              await tg.sendMessage({ chat_id: foChatId, text: alertText });
              console.log(`[17.7] Ön büro bildirimi gönderildi → chatId=${foChatId} room=${roomAttempt}`);
            }
          } catch (notifyErr) {
            console.error('[17.7] Ön büro Telegram bildirimi gönderilemedi:', notifyErr instanceof Error ? notifyErr.message : notifyErr);
          }
          // ── MODÜL 17.7 SONU ───────────────────────────────────────────────

          return;
        }

        if (roomMatches.length === 1) {
          const matched = roomMatches[0];
          // Link telegram_id in inhouse_guests_v2
          await supa
            .from('inhouse_guests_v2')
            .update({ telegram_id: userId })
            .eq('id', matched.id);

          // Link conversation
          await supa
            .from('conversations')
            .update({ inhouse_match_guest_id: matched.id })
            .eq('id', conversationId);

          console.log(`[17c] Linked telegram_id=${userId} → inhouse_guest_id=${matched.id} room=${matched.room_number}`);

          await tg.sendMessage({
            chat_id: chatId,
            text: `Tesekkurler ${matched.guest_name}, sizin icin hazirim. Nasil yardimci olabilirim?`,
          });
          return;
        }

        // Multiple matches → save pending room + ask for name
        await supa
          .from('conversations')
          .update({ multi_match_pending_room: roomAttempt, multi_match_attempts: 0 })
          .eq('id', conversationId);

        await tg.sendMessage({
          chat_id: chatId,
          text: 'Birden fazla kayit goruldu. Lutfen adinizi yaziniz:',
        });
        return;
      }

      // ── Modül 17.7-B: Çoklu eşleşme isim denemesi ─────────────────────────
      // Not a room number, but we are waiting for a name (multi_match_pending_room set)
      if (multiMatchPendingRoom) {
        const nameAttempt = text.trim();
        console.log(`[17.7-B] İsim denemesi: room=${multiMatchPendingRoom} name="${nameAttempt}" attempt=${multiMatchAttempts + 1}`);

        // Query candidates for that room
        const { data: candidates } = await supa
          .from('inhouse_guests_v2')
          .select('id, guest_name, room_number')
          .eq('room_number', multiMatchPendingRoom)
          .eq('status', 'active');

        const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const matched = (candidates ?? []).find((c) =>
          normalise(c.guest_name as string).includes(normalise(nameAttempt)),
        );

        if (matched) {
          // ✅ Name matched — link and welcome
          await supa
            .from('inhouse_guests_v2')
            .update({ telegram_id: userId })
            .eq('id', matched.id);

          await supa
            .from('conversations')
            .update({
              inhouse_match_guest_id: matched.id,
              multi_match_pending_room: null,
              multi_match_attempts: 0,
            })
            .eq('id', conversationId);

          console.log(`[17.7-B] İsim eşleşti → inhouse_guest_id=${matched.id} room=${matched.room_number}`);

          await tg.sendMessage({
            chat_id: chatId,
            text: `Tesekkurler ${matched.guest_name}, sizin icin hazirim. Nasil yardimci olabilirim?`,
          });
          return;
        }

        // ❌ No match — increment attempts
        const newAttempts = multiMatchAttempts + 1;
        await supa
          .from('conversations')
          .update({ multi_match_attempts: newAttempts })
          .eq('id', conversationId);

        const MAX_MULTI_MATCH_ATTEMPTS = 3;

        if (newAttempts >= MAX_MULTI_MATCH_ATTEMPTS && !multiMatchNotified) {
          // ── Önbüro grubuna bildirim ────────────────────────────────────────
          try {
            const { data: foDept } = await supa
              .from('departments')
              .select('telegram_chat_id')
              .eq('code', 'front_office')
              .maybeSingle();

            if (!foDept?.telegram_chat_id) {
              console.warn('[17.7-B] front_office telegram_chat_id bulunamadı, bildirim atlandı');
            } else {
              const foChatId = Number(foDept.telegram_chat_id);

              // Kaç misafir kayıtlı?
              const { count: guestCount } = await supa
                .from('inhouse_guests_v2')
                .select('id', { count: 'exact', head: true })
                .eq('room_number', multiMatchPendingRoom)
                .eq('status', 'active');

              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hotelgen-v2.vercel.app';
              const frontOfficeUrl = `${appUrl}/hotel-admin/${hotelSlug}/front-office`;

              const alertText =
                `⚠️ ÇOKLU EŞLEŞME ÇÖZÜLEMEDİ\n\n` +
                `Oda: ${multiMatchPendingRoom}\n` +
                `Kayıtlı misafir sayısı: ${guestCount ?? (candidates ?? []).length}\n` +
                `Misafir 3 denemede doğru ismi giremedi.\n\n` +
                `Front-Office panelinden manuel eşleştirme gerekli:\n` +
                `${frontOfficeUrl}\n\n` +
                `Zaman: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`;

              await tg.sendMessage({ chat_id: foChatId, text: alertText });
              console.log(`[17.7-B] Çoklu eşleşme bildirimi gönderildi → chatId=${foChatId} room=${multiMatchPendingRoom}`);
            }

            // Flag — tek seferlik bildirim
            await supa
              .from('conversations')
              .update({ multi_match_notified: true })
              .eq('id', conversationId);
          } catch (notifyErr) {
            console.error('[17.7-B] Çoklu eşleşme bildirimi gönderilemedi:', notifyErr instanceof Error ? notifyErr.message : notifyErr);
          }
          // ── Modül 17.7-B SONU ────────────────────────────────────────────────

          await tg.sendMessage({
            chat_id: chatId,
            text: 'Isminizi eslestiremedik. On buromuz sizinle iletisime gececek, lutfen bekleyiniz.',
          });
          return;
        }

        // Still within attempt limit — ask again
        await tg.sendMessage({
          chat_id: chatId,
          text: 'Isminizi eslestiremedik. Lutfen tekrar adinizi yaziniz:',
        });
        return;
      }
      // ── Modül 17.7-B SONU (multi_match_pending_room yoksa) ────────────────

      // Not a room number and not linked → ask for room number
      // Dinamik otel adı: hotel_settings.hotel_name > hotels.name
      const { data: hsRowFallback } = await supa
        .from('hotel_settings')
        .select('hotel_name')
        .limit(1)
        .maybeSingle();
      const displayHotelNameFallback = (hsRowFallback?.hotel_name as string | null | undefined) || hotelName;
      await tg.sendMessage({
        chat_id: chatId,
        text: `Merhaba! ${displayHotelNameFallback}'e hos geldiniz. Size daha iyi hizmet verebilmemiz icin lutfen oda numaranizi yaziniz.`,
      });
      return;
    } // if (!isInfoOnlyQuery) end
    } // if (!isLinkedToInhouse) end
  }
  // MODULE 17.c SONU

  // ============================================================
  // MODÜL 3 — ALLERGEN GATE (tüm akışlardan ÖNCE)
  // ─────────────────────────────────────────────────────────────
  // KURAL 1: allergen_pending=true → bu mesaj alerji cevabıdır.
  //          Verification, AI, forward'a GİRMEZ.
  // KURAL 2: allergen_verify_pending=true → bu mesaj oda no + isim doğrulamasıdır.
  //          Normal verification gate'e, AI'a, forward'a GİRMEZ.
  //          verification_pending_intent KULLANILMAZ (tamamen izole).
  // ============================================================

  // ── Adım 0: Stale TTL temizliği (24h) ──────────────────────────────────────
  const now24h = new Date();
  if (
    conversation.allergen_verify_pending &&
    conversation.allergen_verify_pending_at
  ) {
    const diffHours =
      (now24h.getTime() - new Date(conversation.allergen_verify_pending_at).getTime()) /
      (1000 * 60 * 60);
    if (diffHours >= 24) {
      console.log(`[allergen-gate] allergen_verify_pending TTL geçti (${diffHours.toFixed(1)}h) — temizleniyor`);
      await supa
        .from('conversations')
        .update({
          allergen_verify_pending: false,
          allergen_verify_pending_at: null,
          allergen_verify_attempts: 0,
        })
        .eq('id', conversationId);
      conversation.allergen_verify_pending = false;
      conversation.allergen_verify_pending_at = null;
      conversation.allergen_verify_attempts = 0;
    }
  }
  // ── Stale TTL temizliği SONU ───────────────────────────────────────────────

  if (conversation.allergen_pending) {
    console.log(`[allergen-sc] allergen_pending=true — short-circuit başlıyor. text="${text.slice(0, 80)}"`);

    // Inbound mesajı kaydet (kayıt mantığı korunuyor)
    await supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'inbound',
      text,
      message_type: msg.voice ? 'voice' : msg.photo ? 'photo' : 'text',
      metadata: {
        telegram_message_id: msg.message_id,
        telegram_date: msg.date,
        ...(msg.voice ? { voice_file_id: msg.voice.file_id } : {}),
        ...(msg.photo ? { photo_file_ids: msg.photo.map((p) => p.file_id) } : {}),
      },
    });

    const answerRaw = text.trim().toLowerCase();
    const noAllergenPatterns = /\b(yok|yoq|hayır|hayir|hayr|alerjim yok|alerjisi yok|alerji yok|no|none|nichts|нет)\b/i;
    const hasAllergenText = answerRaw.length > 0 && !noAllergenPatterns.test(answerRaw);
    // Çok kısa (< 2 karakter) metinler alakasız sayılır
    const isIrrelevant = answerRaw.length < 2;

    let allergenStatus: string;
    let allergenText: string | null = null;
    let reportedAt: string | null = null;
    let scReplyText = '';

    if (isIrrelevant) {
      allergenStatus = 'asked_no_response';
      scReplyText = language === 'en'
        ? 'Understood, thank you.'
        : language === 'de'
          ? 'Verstanden, vielen Dank.'
          : 'Anlaşıldı, teşekkürler.';
      console.log(`[allergen-sc] Alakasız cevap → status=asked_no_response`);
    } else if (!hasAllergenText) {
      // noAllergenPatterns eşleşti → "yok"
      allergenStatus = 'none';
      scReplyText = language === 'en'
        ? 'Noted, thank you! Please let us know if there is anything else we can help you with.'
        : language === 'de'
          ? 'Notiert, vielen Dank! Lassen Sie uns wissen, wenn wir noch etwas für Sie tun können.'
          : 'Anlaşıldı, teşekkürler! Başka bir isteğiniz varsa lütfen belirtin.';
      console.log(`[allergen-sc] Alerji yok → status=none`);
    } else {
      // Alerjen belirtmiş → reported (oda no henüz bilinmiyor olabilir, sonra sorulacak)
      allergenStatus = 'reported';
      allergenText = text.trim(); // ham metin (küçük harfe çevirme yok)
      reportedAt = new Date().toISOString();
      // scReplyText oda no durumuna göre aşağıda belirleniyor
      console.log(`[allergen-sc] Alerjen bildirildi → status=reported text="${allergenText}"`);
    }

    // guest_allergens kaydını güncelle/oluştur
    const platformUserIdSc = String(userId);
    const updatePayloadSc: Record<string, unknown> = {
      status: allergenStatus,
      updated_at: new Date().toISOString(),
    };
    if (allergenText !== null) updatePayloadSc.allergen_text = allergenText;
    if (reportedAt !== null) updatePayloadSc.reported_at = reportedAt;

    const { data: allergenRowSc } = await supa
      .from('guest_allergens')
      .select('id')
      .eq('platform', 'telegram')
      .eq('platform_user_id', platformUserIdSc)
      .eq('is_active', true)
      .maybeSingle();

    // guest_allergens güncelle/oluştur; ID'yi yakala (bildirim için gerekli)
    let resolvedAllergenId: string | null = allergenRowSc?.id ?? null;

    if (allergenRowSc) {
      await supa
        .from('guest_allergens')
        .update(updatePayloadSc)
        .eq('id', allergenRowSc.id);
    } else {
      // Güvenli fallback: kayıt yoksa yeni oluştur
      const { data: insertedRow } = await supa
        .from('guest_allergens')
        .insert({
          platform: 'telegram',
          platform_user_id: platformUserIdSc,
          status: allergenStatus,
          ...(allergenText ? { allergen_text: allergenText } : {}),
          ...(reportedAt ? { reported_at: reportedAt } : {}),
        })
        .select('id')
        .single();
      resolvedAllergenId = (insertedRow as { id: string } | null)?.id ?? null;
    }

    if (allergenStatus === 'reported' && !resolvedAllergenId) {
      console.error('[allergen-sc] KRITIK: resolvedAllergenId null — bildirim atlanamaz, kayıt kontrol edilmeli!');
    }

    // ── Modül 3+4: reported durumunda oda no kontrolü ─────────────────────────
    // KURAL: alerji bildirildiyse → önce oda no var mı bak.
    //   Varsa (doğrulanmış misafir): bildirimi hemen gönder.
    //   Yoksa: oda no sor, bildirim SONRAYA ertelendi (allergen_room_verify akışı).
    if (allergenStatus === 'reported' && allergenText && resolvedAllergenId) {
      const { data: gaRow } = await supa
        .from('guest_allergens')
        .select('room_number, guest_full_name')
        .eq('id', resolvedAllergenId)
        .maybeSingle();

      const notifyRoomNumber: string | null = (gaRow?.room_number as string | null) ?? null;
      const notifyGuestName: string | null  = (gaRow?.guest_full_name as string | null) ?? null;

      if (notifyRoomNumber) {
        // ✅ Oda no zaten biliniyor (doğrulanmış misafir) → bildirimi hemen gönder
        console.log(`[allergen-sc] Oda mevcut → bildirim hemen gönderiliyor. room=${notifyRoomNumber}`);
        scReplyText = language === 'en'
          ? 'Thank you for letting us know! We have informed the relevant team about your allergy.'
          : language === 'de'
            ? 'Vielen Dank! Wir haben das zuständige Team über Ihre Allergie informiert.'
            : 'Bilgilendirme için teşekkürler! İlgili ekibimizi alerjiniz hakkında haberdar ettik.';

        try {
          await sendAllergenNotifications({
            hotelSupa: supa,
            tg,
            guestAllergenId: resolvedAllergenId,
            roomNumber: notifyRoomNumber,
            guestFullName: notifyGuestName,
            allergenText,
          });
        } catch (notifyErr) {
          console.error(
            '[allergen-sc] sendAllergenNotifications HATA (akış devam ediyor):',
            notifyErr instanceof Error ? notifyErr.message : notifyErr,
          );
        }

        // conversation state güncelle
        await supa
          .from('conversations')
          .update({ allergen_pending: false, allergen_asked: true })
          .eq('id', conversationId);

      } else {
        // ⏳ Oda no bilinmiyor → ŞİMDİ oda no sor, bildirim oda no alındıktan sonra gönderilecek
        // KURAL: bu turda YALNIZCA oda no sorusu çıkar — başka hiçbir akış ÇALIŞMAZ.
        console.log(`[allergen-sc] Oda no yok — allergen_room_verify akışı başlıyor, conversationId=${conversationId}`);
        scReplyText = language === 'en'
          ? 'Thank you for letting us know about your allergy! To notify our team, could you please share your room number, first name, and last name? Example: 101 John Smith'
          : language === 'de'
            ? 'Vielen Dank für die Information! Um unser Team zu informieren, teilen Sie bitte Zimmernummer, Vorname und Nachname mit. Beispiel: 101 Hans Müller'
            : 'Bilgilendirme için teşekkürler! Ekibimizi haberdar edebilmemiz için lütfen oda numaranızı, adınızı ve soyadınızı paylaşır mısınız? Örnek: 101 Kemal Kuyucu';

        // allergen_pending=false + allergen_asked=true + allergen_verify_pending=TRUE
        // NOT: verification_pending_intent'e DOKUNULMAZ — alerjen kendi alanını kullanır
        await supa
          .from('conversations')
          .update({
            allergen_pending: false,
            allergen_asked: true,
            allergen_verify_pending: true,
            allergen_verify_pending_at: new Date().toISOString(),
            allergen_verify_attempts: 0,
          })
          .eq('id', conversationId);
        conversation.allergen_verify_pending = true;
        conversation.allergen_verify_pending_at = new Date().toISOString();
        conversation.allergen_verify_attempts = 0;

        await supa.from('bot_messages').insert({
          conversation_id: conversationId,
          direction: 'outbound',
          text: scReplyText,
          message_type: 'text',
        });
        await tg.sendMessage({ chat_id: chatId, text: scReplyText });
        console.log(`[allergen-sc] Oda no sorusu gönderildi → conversationId=${conversationId}`);
        return; // ← Başka hiçbir akışa girme — oda no bekleniyor (allergen_room_verify)
      }
    } else {
      // none / asked_no_response → conversation state güncelle
      await supa
        .from('conversations')
        .update({ allergen_pending: false, allergen_asked: true })
        .eq('id', conversationId);
    }
    // ── Modül 3+4 SONU ───────────────────────────────────────────────────────

    // Outbound mesajı kaydet
    await supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      text: scReplyText,
      message_type: 'text',
    });

    // Misafire tek ve net cevap gönder — forward YOK
    await tg.sendMessage({ chat_id: chatId, text: scReplyText });

    console.log(`[allergen-sc] Short-circuit tamamlandı → status=${allergenStatus}, conversationId=${conversationId}`);
    return; // ← Başka hiçbir akışa girme
  }
  // ============================================================
  // MODÜL 3 — ALERJEN SHORT-CIRCUIT SONU
  // ============================================================

  // ============================================================
  // MODÜL 3 — ALLERGEN VERIFY GATE
  // allergen_verify_pending=true: misafir oda no + isim cevabı bekleniyor.
  // Bu blok tamamen izoledir: verification_pending_intent'e dokunmaz,
  // normal doğrulama akışına girmez, AI'a gitmez.
  // ============================================================
  if (conversation.allergen_verify_pending) {
    console.log(`[allergen-verify-gate] allergen_verify_pending=true — oda no doğrulaması. text="${text.slice(0, 80)}"`);

    // Inbound mesajı kaydet
    await supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'inbound',
      text,
      message_type: msg.voice ? 'voice' : msg.photo ? 'photo' : 'text',
      metadata: {
        telegram_message_id: msg.message_id,
        telegram_date: msg.date,
        ...(msg.voice ? { voice_file_id: msg.voice.file_id } : {}),
        ...(msg.photo ? { photo_file_ids: msg.photo.map((p) => p.file_id) } : {}),
      },
    });

    const MAX_ALLERGEN_VERIFY_ATTEMPTS = 3;
    const currentAttempt = (conversation.allergen_verify_attempts ?? 0) + 1;

    // ─── Format parse ────────────────────────────────────────────────────────
    // Beklenen format: "101 Kemal Kuyucu" (oda no + isim)
    // parseVerificationInput ile parse et
    const avParsed = parseVerificationInput(text);
    const avRoom = avParsed.roomNumber;
    const avLastName = avParsed.lastName;

    if (!avRoom || !avLastName) {
      // Format eksik → tekrar sor (deneme sayılmaz)
      console.log(`[allergen-verify-gate] Eksik format: room=${avRoom} lastName=${avLastName}`);
      const incompleteMsg =
        language === 'en'
          ? 'Please provide your room number and last name together. Example: 101 John Smith'
          : language === 'de'
            ? 'Bitte geben Sie Zimmernummer und Nachname an. Beispiel: 101 Hans Müller'
            : 'Lütfen oda numaranızı ve soyadınızı birlikte yazın. Örnek: 101 Kemal Kuyucu';

      await supa.from('bot_messages').insert({ conversation_id: conversationId, direction: 'outbound', text: incompleteMsg, message_type: 'text' });
      await tg.sendMessage({ chat_id: chatId, text: incompleteMsg });
      return;
    }

    // ─── inhouse_guests_v2 sorgusu ─────────────────────────────────────────
    const { data: avV2Rows, error: avV2Error } = await supa
      .from('inhouse_guests_v2')
      .select('id, guest_name, room_number')
      .eq('room_number', avRoom.trim())
      .eq('status', 'active');

    if (avV2Error) {
      console.error('[allergen-verify-gate] inhouse_guests_v2 sorgu hatası:', avV2Error.message);
    }

    // Eşleşme: guest_name case-insensitive, trim (son kelime = soyad)
    const avLastLower = avLastName.trim().toLowerCase();
    const avMatched = (avV2Rows ?? []).find((row) => {
      const gn: string = (row.guest_name as string) ?? '';
      const parts = gn.trim().split(/\s+/);
      const lastWord = parts[parts.length - 1]?.toLowerCase() ?? '';
      return lastWord === avLastLower;
    });

    if (avMatched) {
      // ✅ Eşleşti — guest_allergens güncelle + bildirim gönder
      const guestNameFull: string = (avMatched.guest_name as string) ?? '';
      const nameParts = guestNameFull.trim().split(/\s+/);
      const avFirstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : guestNameFull;
      const verifiedRoom = avMatched.room_number as string;
      const verifiedFullName = guestNameFull.trim();

      console.log(`[allergen-verify-gate] ✅ Eşleşti: room=${verifiedRoom} name="${verifiedFullName}"`);

      // guest_allergens güncelle
      const avPlatformUserId = String(userId);
      const { data: avAllergenRow } = await supa
        .from('guest_allergens')
        .select('id, allergen_text')
        .eq('platform', 'telegram')
        .eq('platform_user_id', avPlatformUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (avAllergenRow) {
        const { error: avGaErr } = await supa
          .from('guest_allergens')
          .update({
            room_number: verifiedRoom,
            guest_full_name: verifiedFullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', avAllergenRow.id);

        if (avGaErr) {
          console.error('[allergen-verify-gate] guest_allergens UPDATE HATASI:', avGaErr.message);
        } else {
          console.log(`[allergen-verify-gate] guest_allergens güncellendi → room=${verifiedRoom} name=${verifiedFullName}`);
        }

        // Bildirim gönder
        try {
          await sendAllergenNotifications({
            hotelSupa: supa,
            tg,
            guestAllergenId: avAllergenRow.id,
            roomNumber: verifiedRoom,
            guestFullName: verifiedFullName,
            allergenText: (avAllergenRow.allergen_text as string) ?? '',
          });
          console.log(`[allergen-verify-gate] sendAllergenNotifications OK → room=${verifiedRoom}`);
        } catch (notifyErr) {
          console.error('[allergen-verify-gate] sendAllergenNotifications HATA:', notifyErr instanceof Error ? notifyErr.message : notifyErr);
        }
      } else {
        console.warn('[allergen-verify-gate] guest_allergens kaydı bulunamadı — bildirim atlandı');
      }

      // State temizle: allergen_verify_pending=false, allergen_asked=true
      await supa
        .from('conversations')
        .update({
          allergen_verify_pending: false,
          allergen_verify_pending_at: null,
          allergen_verify_attempts: 0,
          allergen_asked: true,
        })
        .eq('id', conversationId);

      // Başarı mesajı
      const avSuccessMsg =
        language === 'en'
          ? `Thank you, ${avFirstName}! Your allergy information has been forwarded to our team. Have a pleasant stay!`
          : language === 'de'
            ? `Danke, ${avFirstName}! Ihre Allergieinformation wurde an unser Team weitergeleitet. Guten Aufenthalt!`
            : `Teşekkürler, ${avFirstName}! Alerjiniz ilgili ekibimize iletildi. İyi konaklamalar!`;

      await supa.from('bot_messages').insert({ conversation_id: conversationId, direction: 'outbound', text: avSuccessMsg, message_type: 'text' });
      await tg.sendMessage({ chat_id: chatId, text: avSuccessMsg });
      console.log(`[allergen-verify-gate] Tamamlandı → conversationId=${conversationId}`);
      return;

    } else {
      // ❌ Eşleşmedi
      console.log(`[allergen-verify-gate] ❌ Eşleşmedi: room=${avRoom} lastName=${avLastName} attempt=${currentAttempt}/${MAX_ALLERGEN_VERIFY_ATTEMPTS}`);

      if (currentAttempt >= MAX_ALLERGEN_VERIFY_ATTEMPTS) {
        // Max deneme aşıldı → temizle, ön büroyu yönlendir
        await supa
          .from('conversations')
          .update({
            allergen_verify_pending: false,
            allergen_verify_pending_at: null,
            allergen_verify_attempts: 0,
          })
          .eq('id', conversationId);

        const avGiveUpMsg =
          language === 'en'
            ? 'We could not match your room number and name. Please contact our front desk for assistance.'
            : language === 'de'
              ? 'Zimmernummer und Name konnten nicht zugeordnet werden. Bitte wenden Sie sich an die Rezeption.'
              : 'Oda numarası ve isim eşleşmedi. Lütfen ön büromuza ulaşabilirsiniz.';

        await supa.from('bot_messages').insert({ conversation_id: conversationId, direction: 'outbound', text: avGiveUpMsg, message_type: 'text' });
        await tg.sendMessage({ chat_id: chatId, text: avGiveUpMsg });
        console.log(`[allergen-verify-gate] Max deneme aşıldı — state temizlendi, ön büro yönlendirmesi yapıldı`);
        return;
      }

      // Deneme artır, tekrar sor
      await supa
        .from('conversations')
        .update({ allergen_verify_attempts: currentAttempt })
        .eq('id', conversationId);

      const avRetryMsg =
        language === 'en'
          ? `Room number and name did not match (attempt ${currentAttempt}/${MAX_ALLERGEN_VERIFY_ATTEMPTS}). Please try again. Example: 101 John Smith`
          : language === 'de'
            ? `Zimmernummer und Name stimmen nicht überein (Versuch ${currentAttempt}/${MAX_ALLERGEN_VERIFY_ATTEMPTS}). Bitte erneut versuchen. Beispiel: 101 Hans Müller`
            : `Oda numarası ve isim eşleşmedi (${currentAttempt}/${MAX_ALLERGEN_VERIFY_ATTEMPTS} deneme). Lütfen tekrar deneyin. Örnek: 101 Kemal Kuyucu`;

      await supa.from('bot_messages').insert({ conversation_id: conversationId, direction: 'outbound', text: avRetryMsg, message_type: 'text' });
      await tg.sendMessage({ chat_id: chatId, text: avRetryMsg });
      return;
    }
  }
  // ============================================================
  // MODÜL 3 — ALLERGEN VERIFY GATE SONU
  // ============================================================

  // Inbound mesajı kaydet
  const { data: inboundData, error: inboundError } = await supa
    .from('bot_messages')
    .insert({
      conversation_id: conversationId,
      direction: 'inbound',
      text,
      message_type: msg.voice ? 'voice' : msg.photo ? 'photo' : 'text',
      metadata: {
        telegram_message_id: msg.message_id,
        telegram_date: msg.date,
        ...(msg.voice ? { voice_file_id: msg.voice.file_id } : {}),
        ...(msg.photo ? { photo_file_ids: msg.photo.map((p) => p.file_id) } : {}),
      },
    })
    .select('id')
    .single();

  if (inboundError) {
    console.error('[telegram] inbound insert error:', inboundError.message);
  }

  const inboundMsgId = inboundData?.id as string | undefined;

  // Son 10 mesajı context olarak çek
  const { data: contextRows } = await supa
    .from('bot_messages')
    .select('direction, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const rawContext = (contextRows ?? []).reverse();
  const context: ConversationContextMessage[] = rawContext
    .filter((r) => r.text && r.text !== text)
    .slice(-9)
    .map((r) => ({
      direction: r.direction as 'inbound' | 'outbound',
      text: (r.text as string) ?? '',
      created_at: r.created_at as string,
    }));

  // Aktif departmanları çek
  const { data: deptRows } = await supa
    .from('departments')
    .select('code, display_name, telegram_chat_id, working_hours, off_hours_behavior')
    .eq('is_enabled', true);

  const departments = (deptRows ?? []).map((d) => ({
    code: d.code as string,
    display_name: d.display_name as string,
    telegram_chat_id: (d.telegram_chat_id as number | null) ?? null,
    working_hours: (d.working_hours as string | null) ?? null,
    off_hours_behavior: (d.off_hours_behavior as string | null) ?? null,
  }));

  const deptInfoForAI = departments.map((d) => ({
    code: d.code,
    display_name: d.display_name,
  }));

  // (Modül 16.b gate kaldırıldı — meeting_rooms artık HOTEL CONTEXT bloğunda AI'a gidiyor)

  // Claude AI çağrısı
  let aiResult: Awaited<ReturnType<typeof classifyAndRespond>> | null = null;
  let aiError: string | null = null;

  try {
    aiResult = await classifyAndRespond({
      hotelId: args.hotelId,
      hotelName,
      departments: deptInfoForAI,
      guestMessage: text,
      context,
    });
  } catch (err) {
    aiError = err instanceof Error ? err.message : 'unknown AI error';
    console.error('[telegram] AI hatası:', aiError);
  }

  const rawResponseText =
    aiResult?.response_to_guest ??
    'Mesajınız alındı, en kısa sürede ilgili departmandan dönüş yapılacaktır.';

  const aiReplyText = stripMarkdown(rawResponseText);
  // Modül 10.6: Ham AI intent'i (routing kararı için)
  const aiRawIntentRaw = aiResult?.department ?? null; // department zaten routeIntentToDepartment çıktısı
  const aiShouldForwardRaw = aiResult?.shouldForward ?? true; // sosyal intent ise false

  // ── Modül 10.7: Sosyal keyword override ────────────────────────────────────
  // AI bazen kısa sosyal mesajları yanlış sınıflandırıyor; keyword-based override uygula
  const { finalIntent: overriddenIntent, overridden: intentOverridden, reason: overrideReason } =
    overrideSocialIntent(text, aiRawIntentRaw ?? 'unknown');

  if (intentOverridden) {
    console.log('[social-override]', {
      aiIntent: aiRawIntentRaw,
      finalIntent: overriddenIntent,
      reason: overrideReason,
      text: text.slice(0, 80),
    });
  }

  // Sosyal intent override sonrası shouldForward kararı:
  // Override sosyal intent verdiyse → forward yok; aksi hâlde AI kararına bak
  const SOCIAL_NO_FORWARD_INTENTS = new Set(['greeting', 'acknowledgment', 'farewell', 'affirmation', 'negation', 'chitchat']);
  const aiShouldForward = intentOverridden
    ? !SOCIAL_NO_FORWARD_INTENTS.has(overriddenIntent)
    : aiShouldForwardRaw;
  const aiRawIntent = overriddenIntent === 'unknown' ? aiRawIntentRaw : overriddenIntent;

  // ── Modül 10: Doğrulama Gate ────────────────────────────────────
  let finalResponseText = aiReplyText;
  let finalIntent = aiRawIntent;
  // Modül 10.6/10.7: shouldForward=false (sosyal) VEYA KB cevabı → forward yok
  let skipForward = !aiShouldForward || (aiResult?.answered_from_knowledge ?? false);
  // Modül 3: Bu turda oda no (doğrulama) sorusu sorulduysa true — alerji sorusu ASLA aynı turda çıkmasın
  let verificationAskedThisRound = false;

  if (!aiShouldForward) {
    // Sosyal intent — doğrulama gate'ine GIRME, doğrudan bot cevabı gönder
    console.log(`[telegram] Sosyal intent (${aiRawIntent ?? 'null'}) — forward ve doğrulama atlanıyor. shouldForward=false`);
  }

  // ── Mikro Adım 4: Safety Gate ────────────────────────────────────────────────
  // AI güvenlik kuralı tetiklendiyse forward'ı tamamen iptal et.
  // SLA event oluşturma, departman mesajı gönderme — sadece misafire AI cevabı git.
  if (aiResult?.safetyTriggered === true) {
    const safetyCategory = aiResult.safetyCategory ?? 'unknown';
    console.log(`[safety] Forward iptal edildi. Kategori: ${safetyCategory}`);
    skipForward = true;
  }

  // ============================================================
  // PERSISTENT VERIFICATION CHECK (Modül 10.2)
  // ============================================================
  // Conversation zaten doğrulanmış mı? Doğrulanmışsa, misafir hâlâ
  // in-house mu (check_out_date >= bugün)? Cevap evet'se doğrulama atla.
  // ============================================================

  let persistentVerifiedGuest: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    room_number: string;
    language: string | null;
    gender: string | null;
    check_out_date: string;
    is_active: boolean;
  } | null = null;

  let needsReVerification = false;

  if (conversation.verified_inhouse_guest_id) {
    const today = getTurkeyToday(); // Modül 18: Europe/Istanbul timezone

    const { data: linkedGuest } = await supa
      .from('inhouse_guests')
      .select('id, first_name, last_name, room_number, language, gender, check_out_date, is_active')
      .eq('id', conversation.verified_inhouse_guest_id)
      .maybeSingle();

    if (
      linkedGuest &&
      linkedGuest.is_active === true &&
      (linkedGuest.check_out_date as string) >= today
    ) {
      // ✅ Misafir hâlâ aktif, doğrulama atla
      persistentVerifiedGuest = linkedGuest as unknown as typeof persistentVerifiedGuest;
      console.log(`[persistent-verify] Misafir hâlâ aktif, doğrulama atlaniyor. guest_id=${conversation.verified_inhouse_guest_id}`);
    } else {
      // ❌ Çıkış yapmış veya pasif → re-verify gerekiyor
      needsReVerification = true;
      console.log(`[persistent-verify] Misafir artık aktif değil, re-verify gerekiyor. guest_id=${conversation.verified_inhouse_guest_id}`);

      // Conversation'u temizle
      await supa
        .from('conversations')
        .update({
          verified_inhouse_guest_id: null,
          verified_at: null,
          verification_pending_intent: null,
          verification_attempts: 0,
        })
        .eq('id', conversationId);

      // conversation state'i de güncelle (handleVerificationFlow'a doğru state gitsin)
      conversation.verified_inhouse_guest_id = null;
      conversation.verified_at = null;
      conversation.verification_pending_intent = null;
      conversation.verification_attempts = 0;
    }
  }

  // ── Modül 10.7: Verification gate debug log ───────────────────────────────
  {
    type PvgType = { id: string; first_name: string | null; last_name: string | null; room_number: string; language: string | null; gender: string | null; check_out_date: string; is_active: boolean } | null;
    const pvg = persistentVerifiedGuest as PvgType;
    console.log('[verification-gate]', {
      conversationId,
      hasVerifiedGuestId: !!conversation.verified_inhouse_guest_id,
      resolvedVerifiedGuest: !!pvg,
      verifiedGuestRoom: pvg ? pvg.room_number : null,
      verifiedGuestName: pvg ? `${pvg.first_name} ${pvg.last_name}` : null,
      aiIntent: aiRawIntentRaw,
      finalIntent,
      aiShouldForward,
      skipForward,
    });
  }

  // ── Modül 10.7: Re-verification (oda değiştirme algılaması) ──────────────
  // Verified misafir mesajında yeni oda+ad+soyad bilgisi varsa re-verify yap
  // TypeScript narrowing bypass: yerel değişkene kopyala
  type VerifiedGuestShape = {
    id: string; first_name: string | null; last_name: string | null;
    room_number: string; language: string | null; gender: string | null;
    check_out_date: string; is_active: boolean;
  };
  const currentVerifiedGuest: VerifiedGuestShape | null = persistentVerifiedGuest as VerifiedGuestShape | null;

  if (currentVerifiedGuest && aiShouldForward) {
    const reParsed = parseVerificationInput(text);
    if (
      reParsed.roomNumber !== null &&
      reParsed.firstName !== null &&
      reParsed.lastName !== null &&
      (
        reParsed.roomNumber !== currentVerifiedGuest.room_number ||
        reParsed.lastName.toLowerCase() !== (currentVerifiedGuest.last_name ?? '').toLowerCase()
      )
    ) {
      // Misafir yeni kimlik bilgisi yazmış → re-verify
      console.log('[re-verify] Yeni oda/ad/soyad tespit edildi, re-verify deneniyor', {
        oldRoom: currentVerifiedGuest.room_number,
        newRoom: reParsed.roomNumber,
        oldLast: currentVerifiedGuest.last_name,
        newLast: reParsed.lastName,
      });

      const reVerResult = await verifyGuest(supa, reParsed.roomNumber!, reParsed.firstName!, reParsed.lastName!);

      if (reVerResult.matched && reVerResult.guestId) {
        // Yeni misafir DB'de doğrulandı → güncelle
        await supa
          .from('conversations')
          .update({
            verified_inhouse_guest_id: reVerResult.guestId,
            verified_at: new Date().toISOString(),
          })
          .eq('id', conversationId);

        // persistentVerifiedGuest'i güncelle
        const { data: newGuestRec } = await supa
          .from('inhouse_guests')
          .select('id, first_name, last_name, room_number, language, gender, check_out_date, is_active')
          .eq('id', reVerResult.guestId)
          .maybeSingle();

        if (newGuestRec) {
          persistentVerifiedGuest = newGuestRec as unknown as typeof persistentVerifiedGuest;
        }

        console.log('[re-verify] Başarılı —', {
          newGuest: `${reVerResult.guestFirstName} ${reVerResult.guestLastName}`,
          newRoom: reParsed.roomNumber,
        });

        const reVerMsg =
          language === 'en'
            ? `I've updated your information, ${reVerResult.guestFirstName ?? ''}. I've recorded that you are now in room ${reParsed.roomNumber}. Would you like me to forward your request?`
            : language === 'de'
              ? `Ihre Informationen wurden aktualisiert, ${reVerResult.guestFirstName ?? ''}. Ich habe notiert, dass Sie nun in Zimmer ${reParsed.roomNumber} sind. Soll ich Ihre Anfrage weiterleiten?`
              : `Bilgilerinizi güncelledim, ${reVerResult.guestFirstName ?? ''} Bey. Şu an ${reParsed.roomNumber} numaralı odada konakladığınızı kayıt ettim. Talebinizi iletmemi ister misiniz?`;

        await supa.from('bot_messages').insert({
          conversation_id: conversationId,
          direction: 'outbound',
          text: reVerMsg,
          message_type: 'text',
        });
        await tg.sendMessage({ chat_id: chatId, text: reVerMsg });
        return;
      } else {
        // Eşleşme yok → ön büroya yönlendir, eski verified guest devam eder
        console.log('[re-verify] Eşleşme yok — eski verified devam ediyor');
        const noMatchMsg =
          language === 'en'
            ? `I couldn't find a match for the details you provided. Our front desk will assist you.`
            : language === 'de'
              ? `Die von Ihnen angegebenen Daten konnten nicht gefunden werden. Unsere Rezeption wird Ihnen helfen.`
              : `Verdiğiniz bilgilerle in-house listesinde eşleşme bulamadım. Ön büromuza yönlendiriyorum, sizinle ilgilenecekler.`;

        await supa.from('bot_messages').insert({
          conversation_id: conversationId,
          direction: 'outbound',
          text: noMatchMsg,
          message_type: 'text',
        });
        await tg.sendMessage({ chat_id: chatId, text: noMatchMsg });
        return;
      }
    }
  }

  // ── Modül 3: Alerji önce gelir — isFbIntent / canAskAllergen önceden hesapla ──
  // KURAL: canAskAllergen=true olan turda doğrulama gate'i ÇALIŞMAZ.
  //         Sıra: allerjen sor → allerjen cevabı al → oda no sor → doğrula → bildirim.
  const isFbIntent =
    finalIntent === 'fb' ||
    (aiRawIntent != null && ['fb', 'room_service'].includes((aiRawIntent ?? '').toLowerCase()));

  const verificationIsActive =
    !!conversation.verification_pending_intent && !isVerificationValid(conversation.verified_at);
  const canAskAllergen =
    isFbIntent &&
    !conversation.allergen_asked &&
    !conversation.allergen_pending &&
    !verificationIsActive;

  // Persistent misafir varsa doğrulama akışına girme
  if (persistentVerifiedGuest) {
    // KB cevabı değilse forward yapılacak (skipForward zaten false/sosyal kontrolü yukarıda)
    console.log(`[persistent-verify] Forward akışına gidiliyor. intent=${finalIntent}`);
  } else if (needsReVerification) {
    // Doğrulanmış misafirin konağı bitti → özel mesaj gönder
    const reVerMsg = getReVerificationMsg(language);
    finalResponseText = reVerMsg;
    finalIntent = 'front_office';
    skipForward = true;

    await supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      text: finalResponseText,
      message_type: 'text',
    });
    await tg.sendMessage({ chat_id: chatId, text: finalResponseText });
    return;
  } else if (
    // Modül 10: Normal doğrulama gate
    // NOT: allergen_room_verify artık buraya GELMİYOR — allergen_verify_pending kendi gate'inde işlendi (yukarıda).
    aiShouldForward &&
    !canAskAllergen && // ← Modül 3: alerji önce sorulacak turda oda no sorusu ÇIKMASIN
    (requiresVerification(aiRawIntent) || (conversation.verification_pending_intent && !isVerificationValid(conversation.verified_at)))
  ) {
    // Modül 10.7: verified misafir varsa doğrulama akışına GİRME (needsVerification = personalIntent && !persistentVerifiedGuest)

    const effectiveIntent = requiresVerification(aiRawIntent) ? aiRawIntent! : (conversation.verification_pending_intent ?? aiRawIntent ?? 'unknown');

    const vResult = await handleVerificationFlow({
      supa,
      tg,
      botToken,
      conversationId,
      conversation,
      guestMessageText: text,
      guestTelegramId: String(userId),
      guestTelegramUsername: msg.from?.username ?? null,
      aiIntent: effectiveIntent,
      aiReplyText,
      language,
    });

    if (vResult.shouldShortCircuit) {
      finalResponseText = vResult.replyText;
      finalIntent = vResult.effectiveIntent;
      // Kilitlendi ve front_office → artık bildirim atıldı, forward atla
      skipForward = true;
      // Modül 3: Bu turda oda no sorusu soruldu — alerji sorusu aynı turda çıkmasın
      verificationAskedThisRound = true;
    } else {
      // Doğrulandı — success mesajı + orijinal akış
      finalResponseText = vResult.replyText;
      finalIntent = vResult.effectiveIntent;
      // Modül 10.4: Yeni doğrulama ile elde edilen verifiedGuest kaydını persistentVerifiedGuest'e ata
      if (vResult.verifiedGuestRecord) {
        persistentVerifiedGuest = {
          id: vResult.verifiedGuestRecord.id,
          first_name: vResult.verifiedGuestRecord.first_name,
          last_name: vResult.verifiedGuestRecord.last_name,
          room_number: vResult.verifiedGuestRecord.room_number,
          language: vResult.verifiedGuestRecord.language,
          gender: vResult.verifiedGuestRecord.gender,
          check_out_date: '', // forward'da kullanılmaz
          is_active: true,
        };
      }
      if (vResult.originalRequestText) {
        console.log(`[verification] Orijinal talep forward'a aktarılacak: "${vResult.originalRequestText}"`);
      }
      if (vResult.embeddedRequest) {
        console.log(`[verification] Embedded request tespit edildi: "${vResult.embeddedRequest}" — doğrudan forward edilecek`);
      }

      // Normal doğrulama (verification_pending_intent, allergen değil) — forward devam eder
      skipForward = false;
      // vResult'u sakla — aşağıdaki forward çağrısında kullanmak için
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ============================================================
  // MODÜL 3 — ALERJEN AKIŞI
  // F&B intent + allergen_asked=false → alerji sorusu ekle + kayıt aç
  // allergen_pending=true → misafirin cevabını yorumla ve kaydet
  // ============================================================

  // isFbIntent, verificationIsActive, canAskAllergen yukarıda (doğrulama gate'inden ÖNCE) hesaplandı.
  // KURAL: canAskAllergen=true ise o turda doğrulama gate'i çalışmadı (guard eklendi).

  if (canAskAllergen) {
    // (a) Alerji sorusu F&B cevabına EKLENMEZ — 900ms sonra ayrı mesaj olarak gönderilir.
    // finalResponseText değiştirilmez.

    // allergen_pending=true yap
    await supa
      .from('conversations')
      .update({ allergen_pending: true })
      .eq('id', conversationId);

    // guest_allergens tablosuna 'asked' kaydı aç/güncelle (idempotent: önce bak)
    const platformUserId = String(userId);
    const { data: existingAllergen } = await supa
      .from('guest_allergens')
      .select('id')
      .eq('platform', 'telegram')
      .eq('platform_user_id', platformUserId)
      .eq('is_active', true)
      .maybeSingle();

    const guestFullNameForAllergen = persistentVerifiedGuest
      ? `${persistentVerifiedGuest.first_name ?? ''} ${persistentVerifiedGuest.last_name ?? ''}`.trim()
      : guestName;

    if (existingAllergen) {
      // Kayıt var, sadece asked_at güncelle
      await supa
        .from('guest_allergens')
        .update({
          status: 'asked' as string,
          asked_at: new Date().toISOString(),
          guest_full_name: guestFullNameForAllergen || null,
          room_number: persistentVerifiedGuest?.room_number ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAllergen.id);
    } else {
      // Yeni kayıt aç
      await supa.from('guest_allergens').insert({
        platform: 'telegram',
        platform_user_id: platformUserId,
        guest_full_name: guestFullNameForAllergen || null,
        room_number: persistentVerifiedGuest?.room_number ?? null,
        status: 'asked',
        asked_at: new Date().toISOString(),
      });
    }

    console.log(`[allergen] Alerji sorusu eklendi → conversationId=${conversationId}`);
  }
  // Not: allergen_pending=true durumu artık yukarıda (MODULE 17.c SONU'ndan sonra)
  // short-circuit ile işleniyor — buraya DÜŞMEZ.
  // ============================================================
  // MODÜL 3 — ALERJEN AKIŞI SONU
  // ============================================================

  // ai_intents kaydı
  // Multi-intent: classifiedIntents varsa her biri için ayrı satır,
  // yoksa legacy fallback (tek satır, finalIntent ile)
  const guestMessageGroupId = crypto.randomUUID();
  const classifiedIntentsForInsert =
    (aiResult?.classifiedIntents && aiResult.classifiedIntents.length > 0)
      ? aiResult.classifiedIntents
      : [{
          department: finalIntent ?? 'unknown',
          requestText: '',
          shouldForward: false,
          rawDepartment: finalIntent ?? 'unknown',
        }];

  const intentInserts = classifiedIntentsForInsert.map((item) => ({
    conversation_id: conversationId,
    bot_message_id: inboundMsgId ?? null,
    classified_department: item.department,
    guest_message_id: guestMessageGroupId,
    confidence: aiResult?.confidence ?? null,
    reasoning: aiResult?.reasoning ?? null,
    ai_response: finalResponseText,
    model: aiResult?.model ?? 'claude-sonnet-4-6',
    prompt_tokens: aiResult?.prompt_tokens ?? null,
    completion_tokens: aiResult?.completion_tokens ?? null,
    latency_ms: aiResult?.latency_ms ?? null,
    error: aiError,
  }));

  const { data: intentData, error: intentError } = await supa
    .from('ai_intents')
    .insert(intentInserts)
    .select('id');

  console.log(`[telegram] aiShouldForward=${aiShouldForward} skipForward=${skipForward} finalIntent=${finalIntent}`);

  if (intentError) {
    console.error('[telegram] ai_intents insert error:', intentError.message);
  }

  // intentData artık array — ilk satırın id'si legacy aiIntentId olarak kullanılır
  const aiIntentId = (intentData as Array<{ id: string }> | null)?.[0]?.id as string | undefined;

  // ── KB cevabı veya doğrulama short-circuit → forward yapma ───────────────
  if (skipForward) {
    console.log(`[telegram] Forward atlandı (KB veya verification gate). intent=${finalIntent}`);
    if (aiResult?.answered_from_knowledge) {
      await logKnowledgeAnswer(supa, {
        conversationId,
        predictedIntent: finalIntent ?? null,
        questionText: text,
        answerText: finalResponseText,
      });
    }
  } else {
    // ── ADIM 4B-1: Multi-intent forward (Modül 11: SLA butonlu) ─────────────

    // Modül 10.4: Orijinal talebi kullan (doğrulama sonrası veya direkt mesaj)
    const baseForwardGuestMessage = (persistentVerifiedGuest != null && conversation.pending_request_text)
      ? conversation.pending_request_text
      : text;

    // Multi-intent için forwardable item listesi oluştur
    const forwardableItems = buildForwardableItems(
      aiResult?.classifiedIntents,
      finalIntent,
      departments as DeptRouteInfo[],
      baseForwardGuestMessage,
    );

    if (forwardableItems.length === 0) {
      console.log('[forward] No forwardable items, skipping');
    } else {
      for (let itemIndex = 0; itemIndex < forwardableItems.length; itemIndex++) {
        const fwdItem = forwardableItems[itemIndex];
        try {
          const targetDept = fwdItem.dept;
          const targetChatId = fwdItem.chatId;
          const deptChatIdForSla = String(targetChatId);

          // ── Modül 11: Departman DB'den sla_minutes çek ──
          const { data: deptSla } = await supa
            .from('departments')
            .select('code, telegram_chat_id, sla_minutes, reception_sla_minutes')
            .eq('code', targetDept)
            .maybeSingle();

          const slaMinutes = (deptSla as { sla_minutes?: number | null } | null)?.sla_minutes ?? 1;

          // ── Modül 11: sla_events satırı oluştur (önce DB, sonra Telegram mesajı) ──
          const nowSla = new Date();
          const slaDedline = new Date(nowSla.getTime() + slaMinutes * 60 * 1000);

          const guestFullNameForSla = persistentVerifiedGuest
            ? `${persistentVerifiedGuest.first_name ?? ''} ${persistentVerifiedGuest.last_name ?? ''}`.trim().toUpperCase()
            : guestName.toUpperCase();

          // ai_intent_id eşleştirmesi: sıra korunuyor, index ile eşleştir
          const aiIntentIdForItem: string | null =
            (intentData as Array<{ id: string }> | null)?.[itemIndex]?.id ?? null;

          console.log(`[sla-forward] START [item: ${targetDept}]`, {
            dept: targetDept,
            deptChatIdForSla,
            slaMinutes,
            deptSlaRaw: deptSla,
            persistentVerifiedGuest: !!persistentVerifiedGuest,
            roomNumber: persistentVerifiedGuest?.room_number ?? null,
            guestFullNameForSla,
            requestText: fwdItem.requestText.slice(0, 80),
            itemIndex,
            aiIntentIdForItem,
          });

          const { data: slaEvent, error: slaErr } = await supa
            .from('sla_events')
            .insert({
              conversation_id: conversationId,
              inhouse_guest_id: persistentVerifiedGuest?.id ?? null,
              department_code: targetDept,
              department_chat_id: deptChatIdForSla,
              request_text: fwdItem.requestText,
              room_number: persistentVerifiedGuest?.room_number ?? null,
              guest_full_name: guestFullNameForSla,
              forwarded_at: nowSla.toISOString(),
              sla_deadline: slaDedline.toISOString(),
            })
            .select('id')
            .single();

          if (slaErr || !slaEvent) {
            console.error(`[sla-forward] sla_events INSERT FAILED [item: ${targetDept}]`, {
              errorCode: slaErr?.code,
              errorMsg: slaErr?.message,
              errorDetails: slaErr?.details,
              errorHint: slaErr?.hint,
              slaEventNull: !slaEvent,
            });
          } else {
            console.log(`[sla-forward] inserted [item: ${targetDept}]`, { slaEventId: slaEvent.id });
          }

          // ── Grup mesajı metnini formatla ──
          const trDateStr = (() => {
            const now = new Date();
            return new Intl.DateTimeFormat('tr-TR', {
              timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit',
              day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
            }).format(now) + ' (TR)';
          })();

          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const roomLine = persistentVerifiedGuest?.room_number
            ? `🚪 <b>Oda:</b> ${esc(persistentVerifiedGuest.room_number)}\n`
            : '';
          const groupMsgHtml =
            `🛎 <b>Misafir Talebi</b>\n\n` +
            roomLine +
            `👤 <b>Misafir:</b> ${esc(guestFullNameForSla)}\n` +
            `📝 <b>Talep:</b> "${esc(fwdItem.requestText)}"\n` +
            `🕐 <b>Saat:</b> ${esc(trDateStr)}`;

          // ── Modül 11: Departman grubuna SLA butonlu mesaj gönder ──
          if (slaEvent) {
            const { messageId: slaMsgId, ok: slaOk } = await sendForwardWithSlaButtons({
              botToken,
              chatId: deptChatIdForSla,
              html: groupMsgHtml,
              slaEventId: slaEvent.id as string,
            });
            console.log(`[sla-forward] sent [item: ${targetDept}]`, { messageId: slaMsgId, ok: slaOk, deptChatIdForSla });

            if (slaOk && slaMsgId) {
              await supa
                .from('sla_events')
                .update({ department_message_id: slaMsgId })
                .eq('id', slaEvent.id as string);
              console.log(`[sla] department message sent with buttons [item: ${targetDept}]. msgId=${slaMsgId}`);
            } else {
              console.error(`[sla-forward] sendForwardWithSlaButtons FAILED or no messageId [item: ${targetDept}]`, { slaOk, slaMsgId });
            }
          } else {
            // sla_events oluşturulamadı — butonlu olmayan fallback mesaj gönder
            await tg.sendMessage({
              chat_id: targetChatId,
              text: groupMsgHtml,
              parse_mode: 'HTML',
            });
            console.warn(`[sla-forward] fallback (no-button) group message sent [item: ${targetDept}] — sla_events INSERT failed above`);
          }

          // ── Staff DM + OnBüro CC ──
          await forwardToDepartment({
            hotelSupa: supa,
            tg,
            aiIntentId: aiIntentIdForItem ?? null,
            classifiedDepartment: targetDept ?? null,
            targetDept: targetDept,
            targetChatId: -1, // Grup mesajı SLA tarafından gönderildi, grup'a tekrar gönderme
            wasRerouted: false,
            isOffHours: false,
            guestName,
            guestMessage: fwdItem.requestText,
            aiResponse: finalResponseText,
            confidence: aiResult?.confidence ?? 0,
            verifiedGuest: persistentVerifiedGuest != null
              ? {
                  first_name: persistentVerifiedGuest.first_name,
                  last_name: persistentVerifiedGuest.last_name,
                  room_number: persistentVerifiedGuest.room_number,
                }
              : null,
            guestTelegramId: String(userId),
            skipGroupMessage: true, // Modül 11: grup mesajı zaten SLA butonlu gönderildi
          });

          console.log(
            `[telegram] forward OK (SLA) [item: ${targetDept}] → dept=${targetDept} chat=${targetChatId}`,
          );

          await supa
            .from('conversations')
            .update({
              last_intent: targetDept,
              last_forwarded_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
        } catch (fwdErr) {
          console.error(`[telegram] forwardToDepartment error [item: ${fwdItem.dept}]:`, fwdErr);
          // continue — diğer intent'ler etkilenmesin
        }
      }
    }
  }

  // Outbound mesajı kaydet
  await supa.from('bot_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    text: finalResponseText,
    message_type: 'text',
  });

  // Telegram'a cevap gönder
  await tg.sendMessage({
    chat_id: chatId,
    text: finalResponseText,
  });

  // (a) Alerji sorusu — F&B cevabından 900ms sonra ayrı mesaj
  if (canAskAllergen) {
    const allergenQuestion =
      language === 'en'
        ? 'Do you have any food allergies or dietary requirements? If yes, please let us know. If not, just reply \'none\'.'
        : language === 'de'
          ? 'Haben Sie Lebensmittelallergien oder besondere Ernährungsbedürfnisse? Falls ja, teilen Sie uns diese bitte mit. Falls nein, schreiben Sie einfach \'nein\'.'
          : 'Herhangi bir gıda alerjiniz var mı? Varsa belirtir misiniz, yoksa \'yok\' yazmanız yeterli.';
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    await supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      text: allergenQuestion,
      message_type: 'text',
    });
    await tg.sendMessage({ chat_id: chatId, text: allergenQuestion });
    console.log(`[allergen] Alerji sorusu ayrı mesaj olarak gönderildi (900ms) → conversationId=${conversationId}`);
  }

  // Modül 15.4 — Auto-file belge gönderme
  try {
    if (shouldSendDocument(finalResponseText)) {
      const doc = await findRelevantAutoFileDocument(supa, text);
      if (doc) {
        const sendResult = await sendTelegramDocument({
          botToken,
          chatId,
          supabase: supa,
          doc: { ...doc, caption: doc.file_name },
        });
        if (!sendResult.ok) {
          console.error('[Module 15.4] Document send failed:', sendResult.error);
        }
      }
    }
  } catch (err) {
    console.error('[Module 15.4] Document send exception:', err);
  }
}

async function upsertGuestAndConversation(args: {
  supa: SupabaseClient;
  msg: TelegramMessage;
}): Promise<{ guestId: string; guestName: string; conversationId: string; conversation: ConversationState }> {
  const { supa, msg } = args;
  const userId = msg.from!.id;
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name ?? '';
  const lastName = msg.from?.last_name ?? '';
  const username = msg.from?.username ?? null;
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ').trim() || `Telegram ${userId}`;

  // Guest upsert
  const { data: existingGuest } = await supa
    .from('guests')
    .select('id')
    .eq('telegram_user_id', userId)
    .maybeSingle();

  let guestId: string;
  if (existingGuest) {
    guestId = existingGuest.id as string;
  } else {
    const { data: newGuest, error } = await supa
      .from('guests')
      .insert({
        full_name: fullName,
        telegram_user_id: userId,
        telegram_username: username,
        first_name: firstName || null,
        last_name: lastName || null,
      })
      .select('id')
      .single();
    if (error) throw new Error(`guest insert: ${error.message}`);
    guestId = newGuest!.id as string;
  }

  // Conversation upsert — doğrulama state sütunlarını da çek
  const { data: existingConv } = await supa
    .from('conversations')
    .select('id, verified_inhouse_guest_id, verified_at, verification_pending_intent, verification_attempts, pending_request_text, allergen_asked, allergen_pending, allergen_verify_pending, allergen_verify_pending_at, allergen_verify_attempts')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  let conversationId: string;
  let conversation: ConversationState;

  if (existingConv) {
    conversationId = existingConv.id as string;
    conversation = {
      id: conversationId,
      verified_inhouse_guest_id: (existingConv.verified_inhouse_guest_id as string | null) ?? null,
      verified_at: (existingConv.verified_at as string | null) ?? null,
      verification_pending_intent: (existingConv.verification_pending_intent as string | null) ?? null,
      verification_attempts: (existingConv.verification_attempts as number) ?? 0,
      pending_request_text: (existingConv.pending_request_text as string | null) ?? null, // Modül 10.4
      allergen_asked: (existingConv.allergen_asked as boolean) ?? false,             // Modül 3
      allergen_pending: (existingConv.allergen_pending as boolean) ?? false,         // Modül 3
      allergen_verify_pending: (existingConv.allergen_verify_pending as boolean) ?? false,         // Modül 3 izolasyon
      allergen_verify_pending_at: (existingConv.allergen_verify_pending_at as string | null) ?? null, // Modül 3 izolasyon
      allergen_verify_attempts: (existingConv.allergen_verify_attempts as number) ?? 0,             // Modül 3 izolasyon
    };
    await supa
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  } else {
    const { data: newConv, error } = await supa
      .from('conversations')
      .insert({
        guest_id: guestId,
        channel: 'telegram',
        telegram_chat_id: chatId,
        last_message_at: new Date().toISOString(),
      })
      .select('id, verified_inhouse_guest_id, verified_at, verification_pending_intent, verification_attempts')
      .single();
    if (error) throw new Error(`conversation insert: ${error.message}`);
    conversationId = newConv!.id as string;
    conversation = {
      id: conversationId,
      verified_inhouse_guest_id: null,
      verified_at: null,
      verification_pending_intent: null,
      verification_attempts: 0,
      pending_request_text: null,          // Modül 10.4
      allergen_asked: false,               // Modül 3
      allergen_pending: false,             // Modül 3
      allergen_verify_pending: false,      // Modül 3 izolasyon
      allergen_verify_pending_at: null,    // Modül 3 izolasyon
      allergen_verify_attempts: 0,         // Modül 3 izolasyon
    };
  }

  return { guestId, guestName: fullName, conversationId, conversation };
}

async function logKnowledgeAnswer(
  supa: SupabaseClient,
  args: {
    conversationId: string;
    predictedIntent: string | null;
    questionText: string;
    answerText: string;
  },
): Promise<void> {
  const { error } = await supa.from('knowledge_answers').insert({
    conversation_id: args.conversationId,
    predicted_intent: args.predictedIntent ?? null,
    question_text: args.questionText,
    answer_text: args.answerText,
  });
  if (error) {
    console.error('[kb] knowledge_answers insert error:', error.message);
  }
}
