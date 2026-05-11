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

  const msg = update.message ?? update.edited_message;
  if (!msg) {
    return NextResponse.json({ ok: true, info: 'no message' });
  }

  try {
    await handleMessage({ supa, hotelId: hotel.id, hotelName: hotel.name, msg, tg });
  } catch (err) {
    console.error('[telegram] handleMessage error:', err);
  }

  return NextResponse.json({ ok: true });
}

// ── Verification mesaj şablonları ─────────────────────────────────────────────

function getVerificationAskMsg(lang: string): string {
  const msgs: Record<string, string> = {
    tr: 'Talebinizi iletmek için lütfen oda numaranızı ve soyadınızı paylaşır mısınız? Örnek: 215 Yılmaz',
    en: 'To process your request, could you share your room number and last name? Example: 215 Smith',
    de: 'Bitte teilen Sie uns Ihre Zimmernummer und Ihren Nachnamen mit. Beispiel: 215 Müller',
    ru: 'Пожалуйста, укажите номер вашей комнаты и фамилию. Пример: 215 Иванов',
    ar: 'يرجى مشاركة رقم غرفتك واسم العائلة. مثال: 215 محمد',
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
    tr: 'Hem oda numaranızı hem de soyadınızı belirtmeniz gerekiyor. Örnek: 215 Yılmaz',
    en: 'Please provide both your room number and last name. Example: 215 Smith',
    de: 'Bitte geben Sie sowohl Ihre Zimmernummer als auch Ihren Nachnamen an. Beispiel: 215 Müller',
    ru: 'Пожалуйста, укажите и номер комнаты, и фамилию. Пример: 215 Иванов',
    ar: 'يرجى توفير رقم الغرفة والاسم الأخير معاً. مثال: 215 محمد',
  };
  return msgs[lang] ?? msgs['tr'];
}

function getVerificationSuccessMsg(lang: string, firstName: string | undefined): string {
  const name = firstName ?? '';
  const msgs: Record<string, string> = {
    tr: `Bilgileriniz doğrulandı${name ? `, ${name} Bey/Hanım` : ''}. Talebinizi iletiyorum.`,
    en: `Your details have been verified${name ? `, ${name}` : ''}. I'm forwarding your request now.`,
    de: `Ihre Daten wurden verifiziert${name ? `, ${name}` : ''}. Ich leite Ihre Anfrage weiter.`,
    ru: `Ваши данные подтверждены${name ? `, ${name}` : ''}. Перенаправляю ваш запрос.`,
    ar: `تم التحقق من بياناتك${name ? `، ${name}` : ''}. جاري إحالة طلبك.`,
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
}

interface VerificationFlowResult {
  shouldShortCircuit: boolean;
  replyText: string;
  verifiedGuestId: string | null;
  effectiveIntent: string;
}

async function handleVerificationFlow(args: {
  supa: SupabaseClient;
  conversationId: string;
  conversation: ConversationState;
  guestMessageText: string;
  aiIntent: string;
  aiReplyText: string;
  language: string;
}): Promise<VerificationFlowResult> {
  const { supa, conversationId, conversation, guestMessageText, aiIntent, language } = args;

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

  // 3. Mesajda doğrulama bilgisi var mı?
  const { roomNo, lastName } = parseVerificationInput(guestMessageText);
  const hasCredentials = roomNo !== null && lastName !== null;

  if (!hasCredentials) {
    if (!conversation.verification_pending_intent) {
      // İlk kez intent geldi, henüz sormadık → pending_intent kaydet, sor
      // Aynı zamanda eski birikmiş attempts'i sıfırla (fresh start)
      const pendingIntent = aiIntent;
      await supa
        .from('conversations')
        .update({
          verification_pending_intent: pendingIntent,
          verification_attempts: 0,
          verification_last_attempt_at: null,
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
      console.log(`[verification] Eksik format — pending_intent=${conversation.verification_pending_intent}, roomNo=${roomNo}, lastName=${lastName}`);
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
  console.log(`[verification] Deneniyor: room=${roomNo} lastName=${lastName}`);
  const result = await verifyGuest(supa, roomNo!, lastName!);

  void supa.from('verification_attempts').insert({
    conversation_id: conversationId,
    attempted_room_no: roomNo,
    attempted_last_name: lastName,
    result: result.matched ? 'success' : 'no_match',
    matched_guest_id: result.matched ? result.guestId : null,
    intent_at_attempt: conversation.verification_pending_intent ?? aiIntent,
  });

  if (result.matched) {
    // ✅ Doğrulama başarılı
    const effectiveIntent = conversation.verification_pending_intent ?? aiIntent;
    await supa
      .from('conversations')
      .update({
        verified_inhouse_guest_id: result.guestId,
        verified_at: new Date().toISOString(),
        verification_pending_intent: null,
        verification_attempts: 0,
        verification_last_attempt_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    const successMsg = getVerificationSuccessMsg(language, result.guestFirstName);
    console.log(`[verification] Başarılı — guest_id=${result.guestId} effectiveIntent=${effectiveIntent}`);
    return {
      shouldShortCircuit: false,
      replyText: successMsg,
      verifiedGuestId: result.guestId ?? null,
      effectiveIntent,
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
      // Kilitlendi
      console.log(`[verification] Kilitlendi — attempts=${newAttempts}`);
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
}) {
  const { supa, hotelId, hotelName, msg, tg } = args;
  const text = msg.text ?? msg.caption ?? '';
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

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
  const aiIntent = aiResult?.department ?? null;

  // ── Modül 10: Doğrulama Gate ──────────────────────────────────────────────
  let finalResponseText = aiReplyText;
  let finalIntent = aiIntent;
  let skipForward = aiResult?.answered_from_knowledge ?? false;

  if (requiresVerification(aiIntent) || (conversation.verification_pending_intent && !isVerificationValid(conversation.verified_at))) {
    // Verification gerekiyor veya pending var
    const effectiveIntent = requiresVerification(aiIntent) ? aiIntent! : (conversation.verification_pending_intent ?? aiIntent ?? 'unknown');

    const vResult = await handleVerificationFlow({
      supa,
      conversationId,
      conversation,
      guestMessageText: text,
      aiIntent: effectiveIntent,
      aiReplyText,
      language,
    });

    if (vResult.shouldShortCircuit) {
      finalResponseText = vResult.replyText;
      finalIntent = vResult.effectiveIntent;
      skipForward = true;
      // Kilitlendi ve front_office → forward gerekiyor
      if (vResult.effectiveIntent === 'front_office' && vResult.verifiedGuestId === null && conversation.verification_attempts + 1 >= MAX_VERIFICATION_ATTEMPTS) {
        skipForward = false;
      }
    } else {
      // Doğrulandı — success mesajı + orijinal akış
      finalResponseText = vResult.replyText;
      finalIntent = vResult.effectiveIntent;
      // Doğrulandıktan sonra forward yapılır (skipForward = false)
      skipForward = false;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ai_intents kaydı
  const { data: intentData, error: intentError } = await supa
    .from('ai_intents')
    .insert({
      conversation_id: conversationId,
      bot_message_id: inboundMsgId ?? null,
      classified_department: finalIntent ?? null,
      confidence: aiResult?.confidence ?? null,
      reasoning: aiResult?.reasoning ?? null,
      ai_response: finalResponseText,
      model: aiResult?.model ?? 'claude-sonnet-4-6',
      prompt_tokens: aiResult?.prompt_tokens ?? null,
      completion_tokens: aiResult?.completion_tokens ?? null,
      latency_ms: aiResult?.latency_ms ?? null,
      error: aiError,
    })
    .select('id')
    .single();

  if (intentError) {
    console.error('[telegram] ai_intents insert error:', intentError.message);
  }

  const aiIntentId = intentData?.id as string | undefined;

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
    // ── Departman forward ─────────────────────────────────────────────────
    const routingResult = resolveTargetDepartment(
      finalIntent ?? null,
      departments as DeptRouteInfo[],
    );

    if (routingResult) {
      try {
        await forwardToDepartment({
          hotelSupa: supa,
          tg,
          aiIntentId: aiIntentId ?? null,
          classifiedDepartment: finalIntent ?? null,
          targetDept: routingResult.targetDept,
          targetChatId: routingResult.targetChatId,
          wasRerouted: routingResult.wasRerouted,
          isOffHours: routingResult.wasRerouted && (finalIntent ?? null) !== null,
          guestName,
          guestMessage: text,
          aiResponse: finalResponseText,
          confidence: aiResult?.confidence ?? 0,
        });
        console.log(
          `[telegram] forward OK → dept=${routingResult.targetDept} chat=${routingResult.targetChatId} rerouted=${routingResult.wasRerouted}`,
        );

        await supa
          .from('conversations')
          .update({
            last_intent: routingResult.targetDept,
            last_forwarded_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
      } catch (fwdErr) {
        console.error('[telegram] forwardToDepartment error:', fwdErr);
      }
    } else {
      console.warn('[telegram] routing result null — forward atlandı (dept chat_id yok?)');
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
    .select('id, verified_inhouse_guest_id, verified_at, verification_pending_intent, verification_attempts')
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
