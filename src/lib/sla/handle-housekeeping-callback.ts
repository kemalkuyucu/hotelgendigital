import { SupabaseClient } from '@supabase/supabase-js';
import { sendForwardWithSlaButtons } from './send-forward-with-buttons';
import { labelForHousekeepingCode } from '@/lib/ai/department-brains';
import { normalizeTr } from '@/lib/utils/normalize-tr';

// Housekeeping esya talebi buton callback'i. handle-order-callback.ts sablonu:
// self-contained (kendi supa/botToken alir), departments'ten chat_id+sla_minutes,
// inhouse_guests_v2'den oda/isim, sla_events insert + rollback, sendForwardWithSlaButtons.
//
// callback_data:
//   hk:t:<code>:<convId>          -> tip secildi, adet yok  -> adet butonlari gonder
//   hk:c:<code>:<qty>:<convId>    -> TAM -> kart + SLA olustur
//   hk:noop                       -> zaten islendi (dispatch'te ele alinir)

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

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

export async function handleHousekeepingCallback(params: HkCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // 't' | 'c'
  console.log('[hk-cb] START', { action, data: params.callbackData });

  // ── hk:t:<code>:<convId> -> tip secildi, adet butonlarini gonder ──────────────
  if (action === 't') {
    const code = parseInt(parts[2], 10);
    const convId = parts.slice(3).join(':');
    if (Number.isNaN(code) || !convId) {
      await answer(params.botToken, params.callbackQueryId, 'Gecersiz secim.');
      return;
    }
    const askText = 'Kac adet istersiniz?';
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.callbackChatId,
        text: askText,
        reply_markup: {
          inline_keyboard: [[
            { text: '1', callback_data: `hk:c:${code}:1:${convId}` },
            { text: '2', callback_data: `hk:c:${code}:2:${convId}` },
            { text: '3', callback_data: `hk:c:${code}:3:${convId}` },
          ]],
        },
      }),
    }).catch(() => {});
    const lbl = labelForHousekeepingCode(code);
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, lbl ? `Secildi: ${lbl}` : 'Secildi');
    await answer(params.botToken, params.callbackQueryId, 'Adet secin.');
    console.log('[hk-cb] tip secildi, adet butonlari gonderildi', { code, convId });
    return;
  }

  // ── hk:c:<code>:<qty>:<convId> -> TAM: kart + SLA olustur ─────────────────────
  if (action === 'c') {
    const code = parseInt(parts[2], 10);
    const qty = parseInt(parts[3], 10);
    const convId = parts.slice(4).join(':');
    if (Number.isNaN(code) || Number.isNaN(qty) || !convId) {
      await answer(params.botToken, params.callbackQueryId, 'Gecersiz secim.');
      return;
    }
    console.log('[hk-cb] c START', { code, qty, convId });

    // 0) conversation -> guest chat id
    const { data: conv, error: convErr } = await params.supa
      .from('conversations')
      .select('id, telegram_chat_id')
      .eq('id', convId)
      .maybeSingle();
    if (convErr) console.error('[hk-cb] conv lookup hatasi:', convErr.message);
    if (!conv) {
      await answer(params.botToken, params.callbackQueryId, 'Kayit bulunamadi.');
      return;
    }
    const guestChatId = conv.telegram_chat_id as string;

    // 1) departments housekeeping -> chat_id + sla_minutes
    const { data: hkDept } = await params.supa
      .from('departments')
      .select('telegram_chat_id, sla_minutes')
      .eq('code', 'housekeeping')
      .maybeSingle();
    const hkChatId = (hkDept?.telegram_chat_id as string | null) ?? null;
    const hkSlaMinutes = (hkDept?.sla_minutes as number | null) ?? 15;
    if (!hkChatId) {
      console.error('[hk-cb] departments.housekeeping telegram_chat_id yok — talep iletilemedi');
      await answer(params.botToken, params.callbackQueryId, 'Bir sorun olustu, tekrar deneyin.');
      return;
    }
    console.log('[hk-cb] dept resolved', { hkChatId, hkSlaMinutes });

    // 2) inhouse_guests_v2 -> oda + isim
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

    // 3) requestText
    const label = labelForHousekeepingCode(code) ?? 'talep';
    const requestText = `${qty} ${label}`;
    console.log('[hk-cb] requestText', { requestText, roomNumber });

    // 4) DEDUP (route.ts [sla-forward] blogu ile AYNEN ayni: son 10 dk + acik event + Jaccard>=0.5)
    const dedupNorm = (s: string): string[] =>
      normalizeTr(String(s ?? ''))
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
    const dedupWindowMs = 10 * 60 * 1000;
    const dedupSince = new Date(Date.now() - dedupWindowMs).toISOString();
    const { data: openDupEvents } = await params.supa
      .from('sla_events')
      .select('id, request_text')
      .eq('conversation_id', convId)
      .eq('department_code', 'housekeeping')
      .is('responded_at', null)
      .is('closed_at', null)
      .gte('created_at', dedupSince)
      .order('created_at', { ascending: false })
      .limit(5);
    if (openDupEvents && openDupEvents.length > 0) {
      const newSet = new Set(dedupNorm(requestText));
      const isDuplicate = openDupEvents.some((ev) => {
        const oldSet = new Set(dedupNorm(String(ev.request_text ?? '')));
        if (newSet.size === 0 || oldSet.size === 0) return false;
        let inter = 0;
        for (const t of newSet) if (oldSet.has(t)) inter++;
        const uni = new Set([...newSet, ...oldSet]).size;
        return uni > 0 && inter / uni >= 0.5;
      });
      if (isDuplicate) {
        console.log('[hk-cb] dedup: acik ayni talep var, kart atlandi. Misafire onay verilir.');
        await sendGuest(params.botToken, guestChatId, 'Talebiniz zaten ilgili ekibe iletildi, en kisa surede ilgileniyoruz.');
        await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, '✅ Secildi');
        await answer(params.botToken, params.callbackQueryId, 'Talebiniz alindi.');
        return;
      }
    }

    // 5) deadline
    const now = new Date();
    const deadline = new Date(now.getTime() + hkSlaMinutes * 60 * 1000);

    // 6) sla_events INSERT
    const { data: slaEvent, error: slaErr } = await params.supa
      .from('sla_events')
      .insert({
        conversation_id: convId,
        inhouse_guest_id: null, // FK drift — order-callback ile ayni: null gec
        department_code: 'housekeeping',
        department_chat_id: hkChatId,
        request_text: requestText,
        room_number: roomNumber,
        guest_full_name: guestName,
        forwarded_at: now.toISOString(),
        sla_deadline: deadline.toISOString(),
      })
      .select('id')
      .single();
    if (slaErr || !slaEvent) {
      console.error('[hk-cb] sla_events INSERT FAILED', slaErr);
      await answer(params.botToken, params.callbackQueryId, 'Bir sorun olustu, tekrar deneyin.');
      return;
    }
    console.log('[hk-cb] sla inserted', { slaEventId: slaEvent.id });

    // 7) kart html — qty>=3 ise overlimit (brain overLimit davranisiyla ayni)
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const roomTxt = roomNumber ? `${esc(roomNumber)} numarali oda` : 'Oda bilinmiyor';
    const isOver = qty >= 3;
    const html = isOver
      ? `⚠️ <b>Standart Disi Talep</b>\n\n` +
        `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
        `📝 <b>Talep:</b> ${esc(requestText)}\n\n` +
        `Standart hak (kisi basi): 1 banyo + 1 yuz + 1 ayak havlusu.\n` +
        `Lutfen odadaki kisi sayisina gore degerlendirip misafire donus yapin.`
      : `🛎 <b>Misafir Talebi</b>\n\n` +
        `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
        `📝 <b>Talep:</b> ${esc(requestText)}`;

    const { messageId, ok } = await sendForwardWithSlaButtons({
      botToken: params.botToken,
      chatId: hkChatId,
      html,
      slaEventId: slaEvent.id as string,
      variant: isOver ? 'overlimit' : 'normal',
    });
    console.log('[hk-cb] card sent', { messageId, ok });

    // 8) ok degilse ROLLBACK (order-callback deseni)
    if (ok && messageId) {
      await params.supa
        .from('sla_events')
        .update({ department_message_id: messageId })
        .eq('id', slaEvent.id as string);
    } else {
      console.error('[hk-cb] forward FAILED, rollback', { ok, messageId });
      await params.supa.from('sla_events').delete().eq('id', slaEvent.id as string);
      await answer(params.botToken, params.callbackQueryId, 'Iletim basarisiz, tekrar deneyin.');
      return;
    }

    // 9) misafire onay + kart edit '✅ Secildi'
    await sendGuest(params.botToken, guestChatId, 'Talebiniz ilgili ekibe iletildi. En kisa surede ilgileniyoruz.');
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, '✅ Secildi');
    await answer(params.botToken, params.callbackQueryId, 'Talebiniz iletildi.');
    console.log('[hk-cb] DONE', { slaEventId: slaEvent.id, requestText });
    return;
  }

  await answer(params.botToken, params.callbackQueryId, 'Bilinmeyen islem.');
}
