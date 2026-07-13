import { SupabaseClient } from '@supabase/supabase-js';
import { sendForwardWithSlaButtons } from './send-forward-with-buttons';

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

interface OrderCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string; // order:confirm:<convId> | order:cancel:<convId>
  callbackChatId: number | string;
  callbackMessageId: number;
}

const FB_CHAT_ID = '-5401380483'; // Regnum F&B dept grubu

async function answer(token: string, id: string, text: string) {
  await fetch(TG(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  }).catch(() => {});
}

async function editCard(token: string, chatId: number | string, msgId: number, label: string) {
  await fetch(TG(token, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'order:noop' }]] },
    }),
  }).catch(() => {});
}

const msgConfirmed = (lang: string) =>
  lang === 'en' ? 'Your order has been sent to our team. They will assist you shortly.'
  : lang === 'de' ? 'Ihre Bestellung wurde an unser Team gesendet. Wir kuemmern uns gleich darum.'
  : 'Siparisiniz ilgili ekibe iletildi. En kisa surede ilgileniyoruz.';

const msgCancelled = (lang: string) =>
  lang === 'en' ? 'No problem, I am here if you need anything.'
  : lang === 'de' ? 'Kein Problem, ich bin fuer Sie da.'
  : 'Tabii, bilgi icin buradayim.';

export async function handleOrderCallback(params: OrderCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // confirm | cancel
  const conversationId = parts.slice(2).join(':');

  // conversation + guest bilgisi cek
  const { data: conv, error: convErr } = await params.supa
    .from('conversations')
    .select('id, order_pending, order_pending_text, telegram_chat_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (convErr) console.error('[order-callback] conv lookup hatasi:', convErr.message);

  if (!conv) { await answer(params.botToken, params.callbackQueryId, 'Kayit bulunamadi.'); return; }

  // dil: order_pending_text icerigine gore degil, basit fallback (callback'te detectLanguage yok)
  const lang = 'tr';

  // idempotency — bayrak zaten kapaliysa islenmistir
  if (!conv.order_pending) {
    await answer(params.botToken, params.callbackQueryId, 'Bu siparis zaten islendi.');
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, 'Islendi');
    return;
  }

  const guestChatId = conv.telegram_chat_id as string;
  const orderText = (conv.order_pending_text as string) || '';

  if (action === 'cancel') {
    await params.supa.from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId);
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: msgCancelled(lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, 'Iptal edildi');
    await answer(params.botToken, params.callbackQueryId, 'Iptal edildi.');
    return;
  }

  if (action === 'confirm') {
    // bayragi KAPAT (cift basim korumasi icin once)
    await params.supa.from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId);

    // guest oda/isim — inhouse_guests_v2'den (telegram_id ile)
    let roomNumber: string | null = null;
    let guestName = '';
    const { data: inhouse } = await params.supa
      .from('inhouse_guests_v2')
      .select('room_number, guest_name')
      .eq('telegram_id', String(guestChatId))
      .eq('status', 'active')
      .maybeSingle();
    if (inhouse) {
      roomNumber = (inhouse.room_number as string) ?? null;
      guestName = (inhouse.guest_name as string) ?? '';
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 15 * 60 * 1000); // 15 dk SLA

    const { data: slaEvent, error: slaErr } = await params.supa
      .from('sla_events')
      .insert({
        conversation_id: conversationId,
        inhouse_guest_id: null,
        department_code: 'fb',
        department_chat_id: FB_CHAT_ID,
        request_text: orderText,
        room_number: roomNumber,
        guest_full_name: guestName,
        forwarded_at: now.toISOString(),
        sla_deadline: deadline.toISOString(),
      })
      .select('id')
      .single();

    if (slaErr || !slaEvent) {
      console.error('[order-confirm] sla_events INSERT FAILED', slaErr);
      await answer(params.botToken, params.callbackQueryId, 'Bir sorun olustu, tekrar deneyin.');
      return;
    }

    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const roomTxt = roomNumber ? `${esc(roomNumber)} numarali oda` : 'Oda bilinmiyor';
    const html =
      `🍽 <b>Room Service Siparisi</b>\n\n` +
      `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
      `<b>Talep:</b> ${esc(orderText)}`;

    const { messageId, ok } = await sendForwardWithSlaButtons({
      botToken: params.botToken,
      chatId: FB_CHAT_ID,
      html,
      slaEventId: slaEvent.id as string,
      variant: 'normal',
    });

    if (ok && messageId) {
      await params.supa.from('sla_events')
        .update({ department_message_id: messageId })
        .eq('id', slaEvent.id as string);
    } else {
      // ROLLBACK — forward basarisiz, orphan sla_event birak
      console.error('[order-confirm] forward FAILED, rollback', { ok, messageId });
      await params.supa.from('sla_events').delete().eq('id', slaEvent.id as string);
      await answer(params.botToken, params.callbackQueryId, 'Iletim basarisiz, tekrar deneyin.');
      return;
    }

    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: msgConfirmed(lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, '✅ Onaylandi');
    await answer(params.botToken, params.callbackQueryId, 'Siparis iletildi.');
    return;
  }

  await answer(params.botToken, params.callbackQueryId, 'Bilinmeyen islem.');
}
