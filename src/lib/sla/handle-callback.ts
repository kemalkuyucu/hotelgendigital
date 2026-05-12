/**
 * Modül 11 — Telegram callback_query handler.
 * Format: sla:respond:{slaEventId}:immediate|delayed
 *
 * Akış:
 *   1. sla_events kaydını çek, durum kontrolü
 *   2. responded_at + response_type set et
 *   3. Misafire önceden tanımlı sıcak cevap gönder
 *   4. Departman mesajının inline butonlarını "✅ Cevaplandı" yazısıyla değiştir
 *   5. answerCallbackQuery ile popup göster
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

  if (!['immediate', 'delayed'].includes(responseType)) {
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
      final_status: responseType === 'immediate' ? 'completed_immediate' : 'completed_delayed',
      closed_at: responseType === 'immediate' ? now.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq('id', slaEventId);

  // 3) Misafire cevap gönder (conversation'ın telegram_chat_id'sinden)
  const { data: conversation } = await params.hotelSupabase
    .from('conversations')
    .select('telegram_chat_id, language')
    .eq('id', slaEvent.conversation_id as string)
    .single();

  if (conversation?.telegram_chat_id) {
    const guestFirstName =
      (slaEvent.guest_full_name as string | null)?.split(' ')[0] ?? 'Sayın Misafirimiz';

    const guestReply =
      responseType === 'immediate'
        ? `Talebinizi aldık, hemen ilgileniyoruz. ${guestFirstName}, en kısa sürede odanıza geleceğiz.`
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

  // 5) Popup feedback
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
