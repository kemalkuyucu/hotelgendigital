import { SupabaseClient } from '@supabase/supabase-js';
import { bumpPendingOrder } from '@/lib/menu/pending-order';
import { guestText, readPreferredLang, resolvePreferredLang } from '@/lib/i18n/guest-text';

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

interface NoteCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string; // note:add:<convId> | note:none:<convId>
  callbackChatId: number | string;
  callbackMessageId: number;
}

async function answer(token: string, id: string, text: string) {
  await fetch(TG(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  }).catch(() => {});
}

// Butonlari kaldir (tek pasif buton birak)
async function clearButtons(token: string, chatId: number | string, msgId: number, label: string) {
  await fetch(TG(token, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'note:noop' }]] },
    }),
  }).catch(() => {});
}

type OrderLine = { code: string; name: string; unitPrice: number; qty: number; lineTotal: number };
type StoredOrder = { raw: string; lines: OrderLine[]; total: number; currency: string };

function parseStoredOrder(raw: string | null): StoredOrder | null {
  if (!raw || !raw.trim().startsWith('{')) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredOrder>;
    if (!obj || !Array.isArray(obj.lines) || obj.lines.length === 0) return null;
    return {
      raw: obj.raw ?? '',
      lines: obj.lines as OrderLine[],
      total: Number(obj.total ?? 0),
      currency: obj.currency || 'TRY',
    };
  } catch {
    return null;
  }
}

export async function handleNoteCallback(params: NoteCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // add | none
  const conversationId = parts.slice(2).join(':');

  const { data: conv } = await params.supa
    .from('conversations')
    .select('id, note_pending, note_pending_order, telegram_chat_id, metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv) {
    await answer(params.botToken, params.callbackQueryId, guestText('cb_conv_missing', 'tr'));
    return;
  }

  // IS 10 — KALICI DIL (bkz. handle-order-callback.ts): callback'te mesaj metni YOK.
  // Eski `const lang = 'tr'` HARDCODE kalkti; en/de dallari zaten olu koddu.
  // Fallback 'tr': kalici dil henuz yazilmamis ESKI konusmalarda eski davranis TR idi.
  const lang = resolvePreferredLang({ stored: readPreferredLang(conv.metadata), interfaceLang: 'tr' });

  // Idempotency: not asamasi zaten kapandiysa
  if (!conv.note_pending) {
    await answer(params.botToken, params.callbackQueryId, guestText('note_already_done', lang));
    await clearButtons(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('cb_lbl_processed', lang));
    return;
  }

  const guestChatId = conv.telegram_chat_id as string;

  if (action === 'add') {
    // "Not var" — bayragi ACIK birak, misafirden notu yazmasini iste.
    // Route.ts NOT YAKALAMA blogu bir sonraki mesaji not olarak alir.
    const askText = guestText('note_ask_write', lang);
    await clearButtons(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('note_lbl_waiting', lang));
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: askText }),
    }).catch(() => {});
    await answer(params.botToken, params.callbackQueryId, guestText('note_toast_write', lang));
    return;
  }

  if (action === 'none') {
    // "Notum yok" — note_pending_order'daki siparisi order_pending'e devret,
    // onay kartini gonder.
    const order = parseStoredOrder(conv.note_pending_order as string | null);

    // Not asamasini kapat
    await params.supa
      .from('conversations')
      .update({ note_pending: false, note_pending_order: null })
      .eq('id', conversationId);

    if (!order) {
      await answer(params.botToken, params.callbackQueryId, guestText('note_order_missing', lang));
      await clearButtons(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('note_lbl_cancel', lang));
      return;
    }

    // order_pending akisina devret (damgali zarf — notsuz, raw oldugu gibi).
    // ASAGIDAKI butonlar bu orderStamp'i tasir (bayat buton reddi icin).
    const orderStamp = await bumpPendingOrder(params.supa, conversationId, order.raw, {
      raw: order.raw,
      lines: order.lines,
      total: order.total,
      currency: order.currency,
    });

    const itemsBlock = order.lines.map((l) => `• ${l.name} × ${l.qty}`).join('\n');
    // Onay karti + butonlari route.ts'teki kod-yakalama yolunun AYNI anahtarlarini
    // kullanir (order_confirm_prompt / btn_confirm_yes / btn_cancel) — iki yerde iki
    // ayri metin YASAK; misafir hangi yoldan gelirse gelsin ayni karti gorur.
    const confirmText = guestText('order_confirm_prompt', lang, { liste: itemsBlock });

    await clearButtons(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('note_lbl_continue', lang));
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: guestChatId,
        text: confirmText,
        reply_markup: {
          inline_keyboard: [
            [{ text: guestText('btn_confirm_yes', lang), callback_data: `order:confirm:${conversationId}:${orderStamp}` }],
            [{ text: guestText('btn_cancel', lang), callback_data: `order:cancel:${conversationId}:${orderStamp}` }],
          ],
        },
      }),
    }).catch(() => {});
    await answer(params.botToken, params.callbackQueryId, guestText('note_toast_awaiting', lang));
    return;
  }

  await answer(params.botToken, params.callbackQueryId, guestText('cb_unknown_action', lang));
}
