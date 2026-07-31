import { SupabaseClient } from '@supabase/supabase-js';
import { sendForwardWithSlaButtons } from './send-forward-with-buttons';
import { labelForHousekeepingCode, type HkItem } from '@/lib/ai/department-brains';
import { isDuplicateRequest } from './duplicate-guard';
import { notifyDuplicateRequest } from './notify-duplicate';

// Housekeeping COKLU esya forward'i. handle-housekeeping-callback.ts'in eski
// 4-9. adimlari (DEDUP + sla_events INSERT + kart + rollback) buraya tasindi ve
// coklu esya destekli hale getirildi. Kendi supa/botToken alir (self-contained).
// Misafire onay MESAJINI GONDERMEZ — cagiran (advanceHousekeeping) sonuca gore verir.

export async function forwardHousekeepingItems(p: {
  supa: SupabaseClient;
  botToken: string;
  convId: string;
  items: HkItem[];
  pax: number;
  paxKnown: boolean;
  // Kart + DEDUP metnine eklenen isaret (orn. 'sikayet/yenileme'). Personelin
  // yeni talep ile aksaklik bildirimini ayirt edebilmesi icin.
  note?: string;
}): Promise<{ ok: boolean; duplicate: boolean }> {
  const { supa, convId, items, pax, paxKnown } = p;
  console.log('[hk-fwd] START', { convId, items: items.length });

  // 1) departments housekeeping -> chat_id + sla_minutes
  const { data: hkDept } = await supa
    .from('departments')
    .select('telegram_chat_id, sla_minutes')
    .eq('code', 'housekeeping')
    .maybeSingle();
  const hkChatId = (hkDept?.telegram_chat_id as string | null) ?? null;
  const hkSlaMinutes = (hkDept?.sla_minutes as number | null) ?? 15;
  if (!hkChatId) {
    console.error('[hk-fwd] departments.housekeeping telegram_chat_id yok — talep iletilemedi');
    return { ok: false, duplicate: false };
  }
  console.log('[hk-fwd] dept resolved', { hkChatId, hkSlaMinutes });

  // 2) conversations -> guest chat id
  const { data: conv } = await supa
    .from('conversations')
    .select('id, telegram_chat_id')
    .eq('id', convId)
    .maybeSingle();
  const guestChatId = (conv?.telegram_chat_id as string | null) ?? null;

  // 3) inhouse_guests_v2 -> oda + isim
  let roomNumber: string | null = null;
  let guestName = '';
  if (guestChatId) {
    const { data: inhouse } = await supa
      .from('inhouse_guests_v2')
      .select('room_number, guest_name')
      .eq('telegram_id', String(guestChatId))
      .eq('status', 'active')
      .maybeSingle();
    if (inhouse) {
      roomNumber = (inhouse.room_number as string) ?? null;
      guestName = (inhouse.guest_name as string) ?? '';
    }
  }

  // 4) requestText
  const requestText =
    items.map((i) => `${i.qty} ${labelForHousekeepingCode(i.code) ?? 'talep'}`).join(', ') +
    (p.note ? ` (${p.note})` : '');
  console.log('[hk-fwd] requestText', { requestText, roomNumber });

  // 5) DEDUP (eski callback 149-184 blogu AYNEN: son 10 dk + acik event + Jaccard>=0.5)
  //    Benzerlik karari duplicate-guard.ts'e tasindi (SAF, is8 korpusunda kosulur);
  //    pencere + aday seti + notifyDuplicateRequest yolu BURADA kaldi. Varsayilanlar
  //    (threshold 0.5 / minTokenLength 3) housekeeping'in canli degerleridir -> opts
  //    GECILMEZ, davranis birebir korunur.
  const dedupWindowMs = 10 * 60 * 1000;
  const dedupSince = new Date(Date.now() - dedupWindowMs).toISOString();
  const { data: openDupEvents } = await supa
    .from('sla_events')
    .select('id, request_text, department_chat_id, department_message_id')
    .eq('conversation_id', convId)
    .eq('department_code', 'housekeeping')
    .is('responded_at', null)
    .is('closed_at', null)
    .gte('created_at', dedupSince)
    .order('created_at', { ascending: false })
    .limit(5);
  if (openDupEvents && openDupEvents.length > 0) {
    const dupEvent = openDupEvents.find((ev) =>
      isDuplicateRequest(requestText, [String(ev.request_text ?? '')]),
    );
    if (dupEvent) {
      await notifyDuplicateRequest({
        botToken: p.botToken,
        chatId: (dupEvent.department_chat_id as string) ?? hkChatId,
        messageId: (dupEvent.department_message_id as number | null) ?? null,
        repeatText: requestText,
      });
      console.log('[hk-fwd] dedup: kart acilmadi, tekrar bildirimi gonderildi');
      return { ok: true, duplicate: true };
    }
  }

  // 6) overlimit karari esya bazinda: kisi basi 1 adet, qty > pax -> standart disi
  const isOver = items.some((i) => (i.qty ?? 0) > pax);
  const overList = items
    .filter((i) => (i.qty ?? 0) > pax)
    .map((i) => `${i.qty} ${labelForHousekeepingCode(i.code)}`)
    .join(', ');
  const paxLine = paxKnown
    ? `Odada kayitli kisi sayisi: ${pax}.`
    : `Odada kayitli kisi sayisi bilinmiyor (${pax} varsayildi).`;
  console.log('[hk-fwd] esik', { pax, paxKnown, isOver, overList });

  // 7) deadline + sla_events INSERT
  const now = new Date();
  const deadline = new Date(now.getTime() + hkSlaMinutes * 60 * 1000);
  const { data: slaEvent, error: slaErr } = await supa
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
    console.error('[hk-fwd] sla_events INSERT FAILED', slaErr);
    return { ok: false, duplicate: false };
  }
  console.log('[hk-fwd] sla inserted', { slaEventId: slaEvent.id });

  // 8) kart html — coklu esya ise madde listesi, tek esya ise mevcut tek satir
  const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const roomTxt = roomNumber ? `${esc(roomNumber)} numarali oda` : 'Oda bilinmiyor';
  const talepBlock =
    items.length > 1
      ? `📝 <b>Talep:</b>\n` +
        items
          .map((i) => `• ${esc(`${i.qty} ${labelForHousekeepingCode(i.code) ?? 'talep'}`)}`)
          .join('\n')
      : `📝 <b>Talep:</b> ${esc(requestText)}`;
  const html = isOver
    ? `⚠️ <b>Standart Disi Talep</b>\n\n` +
      `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
      `${talepBlock}\n\n` +
      `Standart hak: kisi basi 1 adet. ${paxLine}\n` +
      `Standart disi: ${esc(overList)}\n` +
      `Lutfen degerlendirip misafire donus yapin.`
    : `🛎 <b>Misafir Talebi</b>\n\n` +
      `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
      `${talepBlock}`;

  const { messageId, ok } = await sendForwardWithSlaButtons({
    botToken: p.botToken,
    chatId: hkChatId,
    html,
    slaEventId: slaEvent.id as string,
    variant: isOver ? 'overlimit' : 'normal',
  });
  console.log('[hk-fwd] card sent', { messageId, ok });

  // 9) ok degilse ROLLBACK (order-callback deseni)
  if (ok && messageId) {
    await supa
      .from('sla_events')
      .update({ department_message_id: messageId })
      .eq('id', slaEvent.id as string);
    console.log('[hk-fwd] DONE', { slaEventId: slaEvent.id, requestText });
    return { ok: true, duplicate: false };
  }
  console.error('[hk-fwd] forward FAILED, rollback', { ok, messageId });
  await supa.from('sla_events').delete().eq('id', slaEvent.id as string);
  return { ok: false, duplicate: false };
}
