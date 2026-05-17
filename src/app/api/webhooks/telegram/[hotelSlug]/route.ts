import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TelegramClient } from '@/lib/telegram/client';
import { verifyTelegramSecret } from '@/lib/telegram/verify';
import type { TelegramUpdate, TelegramMessage } from '@/lib/telegram/types';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
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
import { sendForwardWithSlaButtons } from '@/lib/sla/send-forward-with-buttons';
// Modül 15.4: Auto-file belge gönderme
import {
  sendTelegramDocument,
  shouldSendDocument,
  findRelevantAutoFileDocument,
} from '@/lib/telegram/send-document';

export const runtime = 'nodejs';

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

function getBotTokenForHotel(slug: string): string | null {
  if (slug === 'demo-hotel') return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  return null;
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

  const botToken = getBotTokenForHotel(hotelSlug);
  if (!botToken) {
    console.error(`[telegram] bot token yok: ${hotelSlug}`);
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
    await handleMessage({ supa, hotelId: hotel.id, hotelName: hotel.name, msg, tg, botToken });
  } catch (err) {
    console.error('[telegram] handleMessage error:', err);
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
    tr: 'Oda numarası ve soyad eşleşmedi. Lütfen tekrar deneyin veya ön büromuza ulaşın.',
    en: 'Room number and last name did not match. Please try again or contact our front desk.',
    de: 'Zimmernummer und Nachname stimmen nicht überein. Bitte versuchen Sie es erneut oder wenden Sie sich an die Rezeption.',
    ru: 'Номер комнаты и фамилия не совпадают. Пожалуйста, попробуйте ещё раз или обратитесь на стойку регистрации.',
    ar: 'رقم الغرفة واسم العائلة غير متطابقين. يرجى المحاولة مرة أخرى أو التواصل مع مكتب الاستقبال.',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getVerificationLockedMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Doğrulama başarısız oldu. Lütfen ön büromuza ulaşın.',
    en: 'Verification failed. Please contact our front desk.',
    de: 'Verifizierung fehlgeschlagen. Bitte wenden Sie sich an die Rezeption.',
    ru: 'Верификация не удалась. Пожалуйста, обратитесь на стойку регистрации.',
    ar: 'فشل التحقق. يرجى التواصل مع مكتب الاستقبال.',
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

// ── Doğrulama akışı ────────────────────────────────────────────────────────────

interface ConversationState {
  id: string;
  verified_inhouse_guest_id: string | null;
  verified_at: string | null;
  verification_pending_intent: string | null;
  verification_attempts: number;
  pending_request_text: string | null; // Modül 10.4: doğrulama öncesi orijinal talep
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
    await supa
      .from('conversations')
      .update({
        verified_inhouse_guest_id: result.guestId,
        verified_at: new Date().toISOString(),
        verification_pending_intent: null,
        verification_attempts: 0,
        verification_last_attempt_at: new Date().toISOString(),
        pending_request_text: null, // ← TEMİZLE (forward sonrası)
      })
      .eq('id', conversationId);

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
  msg: TelegramMessage;
  tg: TelegramClient;
  botToken: string;
}) {
  const { supa, hotelId, hotelName, msg, tg, botToken } = args;
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

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

  if (text.startsWith('/start')) {
    await tg.sendMessage({
      chat_id: chatId,
      text: 'Merhaba! HotelGen demo bot\'a hoş geldiniz. 🎉\n\nİsteğinizi yazabilirsiniz, ilgili departmana iletilecektir.\n\nKomutlar:\n/help — yardım',
    });
    await upsertGuestAndConversation({ supa, msg });
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

  if (!aiShouldForward) {
    // Sosyal intent — doğrulama gate'ine GIRME, doğrudan bot cevabı gönder
    console.log(`[telegram] Sosyal intent (${aiRawIntent ?? 'null'}) — forward ve doğrulama atlanıyor. shouldForward=false`);
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
    const today = new Date().toISOString().slice(0, 10);

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
  } else if (aiShouldForward && (requiresVerification(aiRawIntent) || (conversation.verification_pending_intent && !isVerificationValid(conversation.verified_at)))) {
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
    } else {
      // Doğrulandı — success mesajı + orijinal akış
      finalResponseText = vResult.replyText;
      finalIntent = vResult.effectiveIntent;
      // Modül 10.4: Yeni doğrulama ile elde edilen verifiedGuest kaydını persistentVerifiedGuest'e ata
      // (persistentVerifiedGuest daha önce null'dı — bu branch sadece fresh verification'da çalışır)
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
      // Modül 10.4: Orijinal talebi override et (doğrulama cevabı yerine)
      if (vResult.originalRequestText) {
        // forward'da guestMessage olarak originalRequestText kullanılacak (aşağıda override)
        console.log(`[verification] Orijinal talep forward'a aktarılacak: "${vResult.originalRequestText}"`);
      }
      if (vResult.embeddedRequest) {
        console.log(`[verification] Embedded request tespit edildi: "${vResult.embeddedRequest}" — doğrudan forward edilecek`);
      }
      // Doğrulandıktan sonra forward yapılır (skipForward = false)
      skipForward = false;
      // vResult'u sakla — aşağıdaki forward çağrısında kullanmak için
      // (TypeScript scope'u için referans dışarıya taşıyoruz)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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
    .select('id, verified_inhouse_guest_id, verified_at, verification_pending_intent, verification_attempts, pending_request_text')
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
      pending_request_text: null, // Modül 10.4
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
