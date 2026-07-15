import { SupabaseClient } from '@supabase/supabase-js';
import { labelForHousekeepingCode } from '@/lib/ai/department-brains';
import { forwardHousekeepingItems } from './housekeeping-forward';

// Housekeeping COKLU esya buton callback'i. State conversations.hk_pending (bool) +
// hk_pending_text (JSON): { items: [{ c, q, a }], i }
//   c=code, q=qty|null, a=ambiguous, i=su an sorulan esyanin index'i.
//
// callback_data:
//   hk:s:<code>:<convId>   -> aktif esyanin TIPI secildi
//   hk:q:<qty>:<convId>    -> aktif esyanin ADEDI secildi
//   hk:noop                -> route.ts'te ele aliniyor (buraya gelmez)

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

interface HkStateItem {
  c: number;
  q: number | null;
  a: boolean;
}
interface HkState {
  items: HkStateItem[];
  i: number;
}

interface HkCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string;
  callbackChatId: number | string; // butonun basildigi chat (misafir DM)
  callbackMessageId: number;
}

async function answer(token: string, id: string, text: string) {
  await fetch(TG(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  }).catch(() => {});
}

// Butonu tek 'noop'a cevir (order-callback deseni) — cift basim korumasi.
async function editCard(token: string, chatId: number | string, msgId: number, label: string) {
  await fetch(TG(token, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'hk:noop' }]] },
    }),
  }).catch(() => {});
}

async function sendGuest(token: string, chatId: string, text: string) {
  await fetch(TG(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

// State'i i'den bagimsiz olarak tarar: once cozulmemis ilk TIP (a===true), sonra
// ilk ADET (q===null) icin butonla sorar; hepsi tamsa forwardHousekeepingItems.
// route.ts (ilk soru — language TR/EN/DE) ve callback (sonraki sorular — TR) cagirir.
export async function advanceHousekeeping(p: {
  supa: SupabaseClient;
  botToken: string;
  convId: string;
  guestChatId: string | number;
  state: HkState;
  language?: string;
}): Promise<void> {
  const { supa, botToken, convId, guestChatId, state } = p;
  const lang = p.language ?? 'tr';
  const multi = state.items.length > 1;
  const prefixFor = (idx: number) => (multi ? `(${idx + 1}/${state.items.length}) ` : '');

  // 1) tip gerektiren ilk esya -> TIP butonlari (havlu tipleri)
  const typeIdx = state.items.findIndex((it) => it.a === true);
  if (typeIdx !== -1) {
    state.i = typeIdx;
    await supa.from('conversations').update({ hk_pending_text: JSON.stringify(state) }).eq('id', convId);
    const askText =
      prefixFor(typeIdx) +
      (lang === 'en'
        ? 'Which towel would you like?'
        : lang === 'de'
          ? 'Welches Handtuch möchten Sie?'
          : 'Hangi havlu istersiniz?');
    const lbl = (en: string, de: string, tr: string) => (lang === 'en' ? en : lang === 'de' ? de : tr);
    await fetch(TG(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: guestChatId,
        text: askText,
        reply_markup: {
          inline_keyboard: [
            [{ text: lbl('Bath towel', 'Badetuch', 'Banyo havlusu'), callback_data: `hk:s:1:${convId}` }],
            [{ text: lbl('Face towel', 'Gesichtstuch', 'Yuz havlusu'), callback_data: `hk:s:2:${convId}` }],
            [{ text: lbl('Foot towel', 'Fußtuch', 'Ayak havlusu'), callback_data: `hk:s:3:${convId}` }],
          ],
        },
      }),
    }).catch(() => {});
    await supa.from('bot_messages').insert({
      conversation_id: convId, direction: 'outbound', text: askText, message_type: 'text',
    });
    console.log('[hk-cb] tip soruldu', { convId, i: typeIdx });
    return;
  }

  // 2) adet gerektiren ilk esya -> ADET butonlari [1][2][3]
  const qtyIdx = state.items.findIndex((it) => it.q === null);
  if (qtyIdx !== -1) {
    state.i = qtyIdx;
    await supa.from('conversations').update({ hk_pending_text: JSON.stringify(state) }).eq('id', convId);
    const label = labelForHousekeepingCode(state.items[qtyIdx].c) ?? '';
    const askText =
      prefixFor(qtyIdx) +
      (lang === 'en'
        ? 'How many would you like?'
        : lang === 'de'
          ? 'Wie viele möchten Sie?'
          : `Kac adet ${label} istersiniz?`);
    await fetch(TG(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: guestChatId,
        text: askText,
        reply_markup: {
          inline_keyboard: [[
            { text: '1', callback_data: `hk:q:1:${convId}` },
            { text: '2', callback_data: `hk:q:2:${convId}` },
            { text: '3', callback_data: `hk:q:3:${convId}` },
          ]],
        },
      }),
    }).catch(() => {});
    await supa.from('bot_messages').insert({
      conversation_id: convId, direction: 'outbound', text: askText, message_type: 'text',
    });
    console.log('[hk-cb] adet soruldu', { convId, i: qtyIdx });
    return;
  }

  // 3) hepsi tamam -> forward
  await supa.from('conversations').update({ hk_pending: false, hk_pending_text: null }).eq('id', convId);
  const items = state.items.map((it) => ({ code: it.c, qty: it.q, ambiguous: it.a }));
  const res = await forwardHousekeepingItems({ supa, botToken, convId, items });
  const msg = res.duplicate
    ? 'Talebiniz zaten ilgili ekibe iletildi, en kisa surede ilgileniyoruz.'
    : res.ok
      ? 'Talebiniz ilgili ekibe iletildi. En kisa surede ilgileniyoruz.'
      : 'Bir sorun olustu, lutfen tekrar deneyin.';
  await sendGuest(botToken, String(guestChatId), msg);
  console.log('[hk-cb] forward sonucu', { convId, ok: res.ok, duplicate: res.duplicate });
}

export async function handleHousekeepingCallback(params: HkCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // 's' | 'q'
  const value = parseInt(parts[2], 10);
  const convId = parts.slice(3).join(':');
  console.log('[hk-cb] START', { action, data: params.callbackData });

  if ((action !== 's' && action !== 'q') || Number.isNaN(value) || !convId) {
    await answer(params.botToken, params.callbackQueryId, 'Gecersiz secim.');
    return;
  }

  // conv + state oku
  const { data: conv, error: convErr } = await params.supa
    .from('conversations')
    .select('id, telegram_chat_id, hk_pending, hk_pending_text')
    .eq('id', convId)
    .maybeSingle();
  if (convErr) console.error('[hk-cb] conv lookup hatasi:', convErr.message);
  if (!conv || conv.hk_pending !== true || !conv.hk_pending_text) {
    await answer(params.botToken, params.callbackQueryId, 'Bu adim zaten islendi.');
    return;
  }
  const guestChatId = conv.telegram_chat_id as string;

  let state: HkState;
  try {
    state = JSON.parse(conv.hk_pending_text as string) as HkState;
  } catch {
    await answer(params.botToken, params.callbackQueryId, 'Bu adim zaten islendi.');
    return;
  }
  if (!state?.items?.length || typeof state.i !== 'number' || !state.items[state.i]) {
    await answer(params.botToken, params.callbackQueryId, 'Bu adim zaten islendi.');
    return;
  }

  // aktif esyayi guncelle
  if (action === 's') {
    state.items[state.i].c = value;
    state.items[state.i].a = false;
  } else {
    state.items[state.i].q = value;
  }
  await params.supa
    .from('conversations')
    .update({ hk_pending_text: JSON.stringify(state) })
    .eq('id', convId);

  // basilan butonu isaretle + answer
  await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, '✅ Secildi');
  await answer(params.botToken, params.callbackQueryId, 'Secildi.');

  // sonraki adim / forward
  await advanceHousekeeping({
    supa: params.supa,
    botToken: params.botToken,
    convId,
    guestChatId,
    state,
  });
}
