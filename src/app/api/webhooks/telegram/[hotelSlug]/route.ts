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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bot token resolver — şimdilik sadece demo. Modül 7'de bridge_credentials'tan çekilecek.
function getBotTokenForHotel(slug: string): string | null {
  if (slug === 'demo-hotel') return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  return null;
}

// Demo hotel için bridge_credentials bypass — direkt env var'dan Supabase client.
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

  // 1) Secret doğrulama
  const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (!verifyTelegramSecret(headerSecret, expected)) {
    return NextResponse.json({ ok: false, error: 'invalid secret' }, { status: 401 });
  }

  // 2) Hotel resolve
  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    return NextResponse.json({ ok: false, error: 'hotel not found' }, { status: 404 });
  }
  if (hotel.status === 'suspended' || hotel.status === 'cancelled') {
    return NextResponse.json({ ok: true, info: 'hotel inactive' });
  }

  // 3) Bot token
  const botToken = getBotTokenForHotel(hotelSlug);
  if (!botToken) {
    console.error(`[telegram] bot token yok: ${hotelSlug}`);
    return NextResponse.json({ ok: true, info: 'no token' });
  }
  const tg = new TelegramClient(botToken);

  // 4) Hotel DB client
  const supa = await getSupaClientForSlug(hotelSlug, hotel.id);
  if (!supa) {
    console.error(`[telegram] hotel client alınamadı: ${hotelSlug} / ${hotel.id}`);
    return NextResponse.json({ ok: true, info: 'no db client' });
  }

  // 5) Update parse
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

  // 6) Mesajı işle
  try {
    await handleMessage({ supa, hotelId: hotel.id, hotelName: hotel.name, msg, tg });
  } catch (err) {
    console.error('[telegram] handleMessage error:', err);
    // Telegram'a 200 dön — retry'lamasın, biz log'larız
  }

  return NextResponse.json({ ok: true });
}

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

  // Sadece bire bir sohbetleri işle (grup mesajları Modül 7+'da)
  if (msg.chat.type !== 'private') {
    console.log(`[telegram] grup mesajı atlandı: chat ${chatId} (${msg.chat.type})`);
    return;
  }

  if (!userId) return;

  // /start ve /help komutları — AI çağrısı yapma, direkt cevapla
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

  // Normal mesaj akışı
  const { guestName, conversationId } = await upsertGuestAndConversation({ supa, msg });

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

  // Son 10 mesajı context olarak çek (eski → yeni sırada)
  const { data: contextRows } = await supa
    .from('bot_messages')
    .select('direction, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Eski → yeni sırala ve son mesajı (henüz eklenmiş olanı) context'e dahil etme
  const rawContext = (contextRows ?? []).reverse();
  const context: ConversationContextMessage[] = rawContext
    .filter((r) => r.text && r.text !== text) // son gelen mesajı context'e ekleme
    .slice(-9) // max 9 önceki mesaj
    .map((r) => ({
      direction: r.direction as 'inbound' | 'outbound',
      text: (r.text as string) ?? '',
      created_at: r.created_at as string,
    }));

  // Aktif departmanları çek — Modül 6: telegram_chat_id ve routing kolonları da dahil
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

  // AI için sadece code + display_name
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

  // AI fallback cevap (AI patladıysa)
  const responseText =
    aiResult?.response_to_guest ??
    'Mesajınız alındı, en kısa sürede ilgili departmandan dönüş yapılacaktır.';

  // ai_intents kaydı
  const { data: intentData, error: intentError } = await supa
    .from('ai_intents')
    .insert({
      conversation_id: conversationId,
      bot_message_id: inboundMsgId ?? null,
      classified_department: aiResult?.department ?? null,
      confidence: aiResult?.confidence ?? null,
      reasoning: aiResult?.reasoning ?? null,
      ai_response: responseText,
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

  // ── Modül 6: Departman grubuna forward ─────────────────────────────────────
  const routingResult = resolveTargetDepartment(
    aiResult?.department ?? null,
    departments as DeptRouteInfo[],
  );

  if (routingResult) {
    try {
      await forwardToDepartment({
        hotelSupa: supa,
        tg,
        aiIntentId: aiIntentId ?? null,
        classifiedDepartment: aiResult?.department ?? null,
        targetDept: routingResult.targetDept,
        targetChatId: routingResult.targetChatId,
        wasRerouted: routingResult.wasRerouted,
        // isOffHours: sınıflandırma yapıldı ama mesai dışı olduğu için yönlendirildi
        isOffHours: routingResult.wasRerouted && (aiResult?.department ?? null) !== null,
        guestName,
        guestMessage: text,
        aiResponse: responseText,
        confidence: aiResult?.confidence ?? 0,
      });
      console.log(
        `[telegram] forward OK → dept=${routingResult.targetDept} chat=${routingResult.targetChatId} rerouted=${routingResult.wasRerouted}`,
      );

      // conversations tablosunu rapor kolonlarıyla güncelle
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
  // ───────────────────────────────────────────────────────────────────────────

  // Outbound mesajı kaydet
  await supa.from('bot_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    text: responseText,
    message_type: 'text',
  });

  // Telegram'a cevap gönder
  await tg.sendMessage({
    chat_id: chatId,
    text: responseText,
  });
}

async function upsertGuestAndConversation(args: {
  supa: SupabaseClient;
  msg: TelegramMessage;
}): Promise<{ guestId: string; guestName: string; conversationId: string }> {
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

  // Conversation upsert
  const { data: existingConv } = await supa
    .from('conversations')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id as string;
    // last_message_at güncelle
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
      .select('id')
      .single();
    if (error) throw new Error(`conversation insert: ${error.message}`);
    conversationId = newConv!.id as string;
  }

  return { guestId, guestName: fullName, conversationId };
}
