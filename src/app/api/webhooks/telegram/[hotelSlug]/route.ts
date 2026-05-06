import { NextRequest, NextResponse } from 'next/server';
import { TelegramClient } from '@/lib/telegram/client';
import { verifyTelegramSecret } from '@/lib/telegram/verify';
import type { TelegramUpdate, TelegramMessage } from '@/lib/telegram/types';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bot token resolver — şimdilik sadece demo. Modül 5'te bridge_credentials'tan çekilecek.
function getBotTokenForHotel(slug: string): string | null {
  if (slug === 'demo-hotel') return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  return null;
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
  if (hotel.status !== 'active') {
    // Telegram için 200 dön, retry'lamasın
    return NextResponse.json({ ok: true, info: 'hotel inactive' });
  }

  // 3) Bot token
  const botToken = getBotTokenForHotel(hotelSlug);
  if (!botToken) {
    console.error(`[telegram] bot token yok: ${hotelSlug}`);
    return NextResponse.json({ ok: true, info: 'no token' });
  }
  const tg = new TelegramClient(botToken);

  // 4) Hotel DB client (hotel.id ile — getHotelClient UUID alır)
  const supa = await getHotelClient(hotel.id);
  if (!supa) {
    console.error(`[telegram] hotel client alınamadı: ${hotel.id}`);
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
    await handleMessage({ supa, hotelId: hotel.id, msg, tg });
  } catch (err) {
    console.error('[telegram] handleMessage error:', err);
    // Telegram'a 200 dön — retry'lamasın, biz log'larız
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(args: {
  supa: SupabaseClient;
  hotelId: string;
  msg: TelegramMessage;
  tg: TelegramClient;
}) {
  const { supa, msg, tg } = args;
  const text = msg.text ?? msg.caption ?? '';
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  // Sadece bire bir sohbetleri işle (grup mesajları Modül 5'te)
  if (msg.chat.type !== 'private') {
    console.log(`[telegram] grup mesajı atlandı: chat ${chatId} (${msg.chat.type})`);
    return;
  }

  if (!userId) return;

  // Komutlar
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

  // Normal mesaj
  const { conversationId } = await upsertGuestAndConversation({ supa, msg });
  await saveMessage({ supa, conversationId, msg, direction: 'inbound' });

  // MVP echo — Modül 5'te AI orchestrator gelince kalkacak
  await tg.sendMessage({
    chat_id: chatId,
    text: `Mesajınız alındı, en kısa sürede ilgili departman tarafından yanıtlanacaktır. ✅`,
  });
}

async function upsertGuestAndConversation(args: {
  supa: SupabaseClient;
  msg: TelegramMessage;
}): Promise<{ guestId: string; conversationId: string }> {
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
  } else {
    const { data: newConv, error } = await supa
      .from('conversations')
      .insert({
        guest_id: guestId,
        channel: 'telegram',
        telegram_chat_id: chatId,
      })
      .select('id')
      .single();
    if (error) throw new Error(`conversation insert: ${error.message}`);
    conversationId = newConv!.id as string;
  }

  return { guestId, conversationId };
}

async function saveMessage(args: {
  supa: SupabaseClient;
  conversationId: string;
  msg: TelegramMessage;
  direction: 'inbound' | 'outbound';
}) {
  const { supa, conversationId, msg, direction } = args;
  const text = msg.text ?? msg.caption ?? '';
  const messageType = msg.voice ? 'voice' : msg.photo ? 'photo' : 'text';

  const { error } = await supa.from('messages').insert({
    conversation_id: conversationId,
    direction,
    content: text,
    message_type: messageType,
    metadata: {
      telegram_message_id: msg.message_id,
      telegram_date: msg.date,
      ...(msg.voice ? { voice_file_id: msg.voice.file_id } : {}),
      ...(msg.photo ? { photo_file_ids: msg.photo.map((p) => p.file_id) } : {}),
    },
  });
  if (error) throw new Error(`message insert: ${error.message}`);
}
