/**
 * Modül 11 — Telegram callback_query handler.
 * Format: sla:respond:{slaEventId}:immediate|delayed
 *
 * Akış:
 *   1. sla_events kaydını çek, durum kontrolü
 *   2. responded_at + response_type set et
 *   3. Misafire önceden tanımlı sıcak cevap gönder
 *   4. Departman mesajının inline butonlarını "✅ Cevaplandı" yazısıyla değiştir
 *   5. Modül 11.1: Resepsiyona "Bilgi — Talep Yanıtlandı" mesajı gönder
 *   6. answerCallbackQuery ile popup göster
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface CallbackParams {
  hotelSupabase: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string;
  fromTelegramId: string;
  fromUsername?: string;
  fromFirstName?: string;
}

export async function handleSlaCallback(params: CallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  // Format: sla:respond:{uuid}:immediate|delayed
  // UUID içinde tire var, bu yüzden: parts[0]=sla, parts[1]=respond, parts[parts.length-1]=type, ortası=uuid
  if (parts.length < 4 || parts[0] !== 'sla' || parts[1] !== 'respond') {
    await answerCallback(params.botToken, params.callbackQueryId, 'Geçersiz işlem');
    return;
  }

  const responseType = parts[parts.length - 1]; // 'immediate' | 'delayed'
  const slaEventId = parts.slice(2, parts.length - 1).join(':'); // UUID (tire içerebilir)

  if (!['immediate', 'delayed', 'contacted'].includes(responseType)) {
    await answerCallback(params.botToken, params.callbackQueryId, 'Geçersiz tip');
    return;
  }

  // 1) sla_events çek
  const { data: slaEvent, error } = await params.hotelSupabase
    .from('sla_events')
    .select('*')
    .eq('id', slaEventId)
    .maybeSingle();

  if (error || !slaEvent) {
    console.error('[sla-callback] event bulunamadı:', slaEventId, error);
    await answerCallback(params.botToken, params.callbackQueryId, 'Talep bulunamadı');
    return;
  }

  // Çift cevap koruması
  if (slaEvent.responded_at) {
    await answerCallback(
      params.botToken,
      params.callbackQueryId,
      `Bu talebe zaten cevap verildi (${slaEvent.response_type as string})`,
      true
    );
    return;
  }

  // 2) DB güncelle
  const now = new Date();
  const responderName = params.fromUsername
    ? `@${params.fromUsername}`
    : params.fromFirstName || params.fromTelegramId;

  await params.hotelSupabase
    .from('sla_events')
    .update({
      responded_at: now.toISOString(),
      response_type: responseType,
      responder_telegram_id: params.fromTelegramId,
      responder_username: responderName,
      final_status: responseType === 'immediate' ? 'completed_immediate' : responseType === 'contacted' ? 'completed_contacted' : 'completed_delayed',
      closed_at: (responseType === 'immediate' || responseType === 'contacted') ? now.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq('id', slaEventId);

  // 3) Misafire cevap gönder (conversation'ın telegram_chat_id'sinden)
  //    AUDIT D6: conversations'ta 'language' kolonu YOK (o guests'te) → kaldırıldı;
  //    .single() 0 satırda hata verir → .maybeSingle()
  const { data: conversation } = await params.hotelSupabase
    .from('conversations')
    .select('telegram_chat_id')
    .eq('id', slaEvent.conversation_id as string)
    .maybeSingle();

  if (conversation?.telegram_chat_id && responseType !== 'contacted') {
    const guestFirstName =
      (slaEvent.guest_full_name as string | null)?.split(' ')[0] ?? 'Sayın Misafirimiz';
    const guestNameDisplay = guestFirstName
      ? guestFirstName.charAt(0).toLocaleUpperCase('tr-TR') + guestFirstName.slice(1).toLocaleLowerCase('tr-TR')
      : 'Misafirimiz';

    const guestReply =
      responseType === 'immediate'
        ? `Sayın ${guestNameDisplay}, talebinizi aldık. Hemen ilgileniyoruz ve ilgili personeli yönlendiriyoruz.`
        : `Talebinizi aldık, biraz sonra ilgileneceğiz. Anlayışınız için teşekkür ederiz.`;

    await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: conversation.telegram_chat_id,
        text: guestReply,
      }),
    });
  }

  // 4) Departman mesajının butonlarını kaldır + durum notu ekle
  if (slaEvent.department_message_id) {
    const statusLabel =
      responseType === 'immediate'
        ? `✅ Hemen ilgileniliyor — ${responderName} (${formatTime(now)})`
        : responseType === 'contacted'
        ? `Misafire donuldu - ${responderName} (${formatTime(now)})`
        : `⏳ Biraz sonra ilgilenilecek — ${responderName} (${formatTime(now)})`;

    await fetch(
      `https://api.telegram.org/bot${params.botToken}/editMessageReplyMarkup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: slaEvent.department_chat_id,
          message_id: slaEvent.department_message_id,
          reply_markup: {
            inline_keyboard: [[{ text: statusLabel, callback_data: 'sla:noop' }]],
          },
        }),
      }
    );
  }

  // 5) Modül 11.1: Resepsiyona bilgi mesajı gönder (buton yanıtlandıktan sonra)
  await sendReceptionInfoMessage({
    hotelSupabase: params.hotelSupabase,
    botToken: params.botToken,
    slaEvent,
    responseType,
    responderName,
    respondedAt: now,
  });

  // 6) Popup feedback
  await answerCallback(
    params.botToken,
    params.callbackQueryId,
    responseType === 'immediate'
      ? '✅ Hemen ilgileniyoruz — misafire iletildi'
      : '⏳ Biraz sonra — misafire iletildi'
  );

  console.log('[sla-callback] handled:', {
    slaEventId,
    responseType,
    responder: responderName,
  });
}

// ─── Modül 11.1: Resepsiyon bilgi mesajı ────────────────────────────────────

interface ReceptionInfoParams {
  hotelSupabase: SupabaseClient;
  botToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slaEvent: Record<string, any>;
  responseType: string;
  responderName: string;
  respondedAt: Date;
}

async function sendReceptionInfoMessage(p: ReceptionInfoParams): Promise<void> {
  try {
    // front_office chat_id'sini DB'den çek
    const { data: foRow } = await p.hotelSupabase
      .from('departments')
      .select('telegram_chat_id, display_name')
      .eq('code', 'front_office')
      .eq('is_enabled', true)
      .maybeSingle();

    if (!foRow?.telegram_chat_id) {
      console.log('[sla-callback] front_office chat_id yok — resepsiyon bildirimi atlandı');
      return;
    }

    const frontOfficeChatId = foRow.telegram_chat_id as number;

    // Yanıt bilgilerini hazırla
    const responseEmoji = p.responseType === 'contacted' ? '' : p.responseType === 'immediate' ? '🟢' : '🟡';
    const responseLabel =
      p.responseType === 'contacted'
        ? 'Standart disi talep - misafire donuldu'
        : p.responseType === 'immediate' ? 'Hemen ilgileniyoruz' : 'Biraz sonra ilgileniyoruz';

    // Departman adını bul (sla_event'teki department_code'dan)
    const deptCode = (p.slaEvent.department_code as string) ?? '';
    const { data: deptRow } = await p.hotelSupabase
      .from('departments')
      .select('display_name')
      .eq('code', deptCode)
      .maybeSingle();
    const deptDisplayName = (deptRow?.display_name as string | null) ?? deptCode;

    const roomNumber = (p.slaEvent.room_number as string | null) ?? '—';
    const guestFullName = (p.slaEvent.guest_full_name as string | null) ?? '—';
    const requestText = (p.slaEvent.request_text as string | null) ?? '—';
    const timeStr = formatTime(p.respondedAt);

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const infoHtml =
      `ℹ️ <b>Bilgi — Talep Yanıtlandı</b>\n\n` +
      `🚪 Oda: ${esc(roomNumber)}\n` +
      `👤 Misafir: ${esc(guestFullName)}\n` +
      `📝 Talep: "${esc(requestText)}"\n` +
      `🏢 Departman: ${esc(deptDisplayName)}\n` +
      `✅ Yanıt: ${responseEmoji} ${esc(responseLabel)}\n` +
      `👤 Yanıtlayan: ${esc(p.responderName)}\n` +
      `🕐 Saat: ${esc(timeStr)}`;

    await fetch(`https://api.telegram.org/bot${p.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: frontOfficeChatId,
        text: infoHtml,
        parse_mode: 'HTML',
      }),
    });

    console.log(`[sla-callback] reception info message sent → chatId=${frontOfficeChatId}`);
  } catch (err) {
    console.error('[sla-callback] sendReceptionInfoMessage error:', err instanceof Error ? err.message : err);
  }
}

async function answerCallback(
  botToken: string,
  callbackQueryId: string,
  text: string,
  showAlert = false
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
}
