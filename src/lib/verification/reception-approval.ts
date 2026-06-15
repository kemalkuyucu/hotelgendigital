import type { SupabaseClient } from '@supabase/supabase-js';

const TG_API = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function todayTR(): string {
  // Turkiye kalici UTC+3 (DST yok)
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pick(language: string, m: { tr: string; en: string; ru: string; de: string }): string {
  const l = (language || 'tr').toLowerCase();
  if (l.startsWith('en')) return m.en;
  if (l.startsWith('ru')) return m.ru;
  if (l.startsWith('de')) return m.de;
  return m.tr;
}

export function receptionNotifiedMsg(language: string): string {
  return pick(language, {
    tr: 'Sizi konaklayan misafir listesinde bulamadim, ancak resepsiyona ilettim. En kisa surede sizinle ilgilenecekler.',
    en: 'I could not find you on the in-house guest list, but I have notified reception. They will assist you shortly.',
    ru: 'Я не нашёл вас в списке проживающих, но уже сообщил на стойку регистрации. С вами свяжутся в ближайшее время.',
    de: 'Ich konnte Sie nicht in der Gasteliste finden, habe aber die Rezeption informiert. Man wird sich in Kurze um Sie kummern.',
  });
}

export function receptionWaitMsg(language: string): string {
  return pick(language, {
    tr: 'Talebinizi resepsiyona ilettim, donus bekleniyor. Onaylandiginda size haber verecegim.',
    en: 'I have already forwarded this to reception and we are awaiting their confirmation. I will let you know once it is approved.',
    ru: 'Я уже передал это на стойку регистрации, ожидаем подтверждения. Сообщу вам, как только подтвердят.',
    de: 'Ich habe dies bereits an die Rezeption weitergeleitet und warte auf Bestatigung. Ich melde mich, sobald es bestatigt ist.',
  });
}

export function approvedMsg(language: string): string {
  return pick(language, {
    tr: 'Resepsiyon kaydinizi onayladi. Artik talebinizi yazabilirsiniz.',
    en: 'Reception has confirmed your stay. You can now send your request.',
    ru: 'Стойка регистрации подтвердила ваше проживание. Теперь вы можете отправить свой запрос.',
    de: 'Die Rezeption hat Ihren Aufenthalt bestatigt. Sie konnen nun Ihre Anfrage senden.',
  });
}

export function rejectedMsg(language: string): string {
  return pick(language, {
    tr: 'Maalesef kaydinizi dogrulayamadik. Lutfen resepsiyona ugrayip yuz yuze kontrol ettirin.',
    en: 'Unfortunately we could not verify your stay. Please visit reception in person to be checked in.',
    ru: 'К сожалению, мы не смогли подтвердить ваше проживание. Пожалуйста, обратитесь на стойку регистрации лично.',
    de: 'Leider konnten wir Ihren Aufenthalt nicht bestatigen. Bitte wenden Sie sich personlich an die Rezeption.',
  });
}

export async function createReceptionApproval(args: {
  supa: SupabaseClient;
  botToken: string;
  guestTelegramId: string;
  guestTelegramUsername: string | null;
  attemptedRoomNumber: string;
  attemptedGuestName: string;
  messageExcerpt: string;
  language: string;
}): Promise<{ created: boolean }> {
  const { supa, botToken } = args;
  const tgId = Number(args.guestTelegramId);

  const { data: existing, error: exErr } = await supa
    .from('pending_guest_matches')
    .select('id')
    .eq('telegram_id', tgId)
    .eq('resolved', false)
    .limit(1);
  if (exErr) console.error('[reception-approval] open-pending check err:', exErr.message);
  if (existing && existing.length > 0) return { created: false };

  const { data: inserted, error: insErr } = await supa
    .from('pending_guest_matches')
    .insert({
      telegram_id: tgId,
      platform: 'telegram',
      attempted_room_number: args.attemptedRoomNumber,
      attempted_guest_name: args.attemptedGuestName,
      message_excerpt: args.messageExcerpt.slice(0, 500),
      language: args.language || 'tr',
      resolved: false,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    console.error('[reception-approval] pending insert err:', insErr?.message);
    return { created: false };
  }
  const pendingId = inserted.id as string;

  const { data: dept } = await supa
    .from('departments')
    .select('telegram_chat_id')
    .eq('code', 'front_office')
    .maybeSingle();
  const chatId = dept?.telegram_chat_id;
  if (!chatId) {
    console.warn('[reception-approval] front_office chat_id yok, kart gonderilemedi');
    return { created: true };
  }

  const uname = args.guestTelegramUsername
    ? `@${args.guestTelegramUsername}`
    : `ID ${args.guestTelegramId}`;
  const text =
    `🔎 <b>Inhouse Eslesmeme — Onay Gerekli</b>\n\n` +
    `Beyan edilen oda: <b>${escapeHtml(args.attemptedRoomNumber)}</b>\n` +
    `Beyan edilen ad-soyad: <b>${escapeHtml(args.attemptedGuestName)}</b>\n` +
    `Kisi: ${escapeHtml(uname)}\n\n` +
    `Ilk mesaj: ${escapeHtml(args.messageExcerpt.slice(0, 300))}\n\n` +
    `Bu kisiyi in-house listesinde bulamadim. Gercekten bu odada konakliyor mu?`;

  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Onayla', callback_data: `pgm:approve:${pendingId}` },
      { text: '❌ Reddet', callback_data: `pgm:reject:${pendingId}` },
    ]],
  };

  try {
    await fetch(TG_API(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup }),
    });
  } catch (e) {
    console.error('[reception-approval] kart gonderim hatasi:', e instanceof Error ? e.message : e);
  }
  return { created: true };
}

async function editCardClosed(
  token: string,
  chatId: number | string,
  messageId: number,
  label: string,
): Promise<void> {
  try {
    await fetch(TG_API(token, 'editMessageReplyMarkup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'pgm:noop' }]] },
      }),
    });
  } catch {
    /* yut */
  }
}

export async function handlePendingMatchCallback(args: {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string;
  callbackChatId: number | string;
  callbackMessageId: number;
  approverTelegramId: string;
  approverName: string | null;
}): Promise<void> {
  const { supa, botToken } = args;
  const parts = args.callbackData.split(':');
  const action = parts[1];
  const pendingId = parts.slice(2).join(':');

  const answer = (text: string) =>
    fetch(TG_API(botToken, 'answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: args.callbackQueryId, text }),
    }).catch(() => {});

  const { data: pending, error: pErr } = await supa
    .from('pending_guest_matches')
    .select('id, telegram_id, attempted_room_number, attempted_guest_name, language, resolved')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr || !pending) { await answer('Kayit bulunamadi.'); return; }
  if (pending.resolved) { await answer('Bu kayit zaten islendi.'); return; }

  const guestChatId = pending.telegram_id as number;
  const lang = (pending.language as string) || 'tr';
  const resolvedBy = args.approverName ? `tg:${args.approverName}` : `tg:${args.approverTelegramId}`;

  if (action === 'approve') {
    const today = todayTR();
    const checkout = addDays(today, 7); // varsayilan; resepsiyon panelden duzeltebilir
    const { error: insErr } = await supa.from('inhouse_guests_v2').insert({
      room_number: String(pending.attempted_room_number),
      guest_name: String(pending.attempted_guest_name),
      status: 'active',
      check_in_date: today,
      check_out_date: checkout,
      telegram_id: String(pending.telegram_id),
    });
    if (insErr) {
      console.error('[pgm][approve] inhouse insert err:', insErr.message);
      await answer('Kayit olusturulamadi, tekrar deneyin.');
      return;
    }
    await supa.from('pending_guest_matches')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by_user_id: resolvedBy })
      .eq('id', pendingId);
    await fetch(TG_API(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: approvedMsg(lang) }),
    }).catch(() => {});
    await editCardClosed(botToken, args.callbackChatId, args.callbackMessageId, '✅ Onaylandi');
    await answer('Onaylandi, misafir bilgilendirildi.');
    return;
  }

  if (action === 'reject') {
    await supa.from('pending_guest_matches')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by_user_id: resolvedBy })
      .eq('id', pendingId);
    await fetch(TG_API(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: rejectedMsg(lang) }),
    }).catch(() => {});
    await editCardClosed(botToken, args.callbackChatId, args.callbackMessageId, '❌ Reddedildi');
    await answer('Reddedildi, misafir bilgilendirildi.');
    return;
  }

  await answer('Bilinmeyen islem.');
}
