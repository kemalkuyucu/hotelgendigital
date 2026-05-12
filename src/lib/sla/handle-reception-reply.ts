/**
 * Modül 11 — Resepsiyon, SLA escalation mesajına REPLY yazınca handler.
 * Açıklama sla_events tablosuna kaydedilir, bot onay mesajı gönderir.
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface ReplyParams {
  hotelSupabase: SupabaseClient;
  botToken: string;
  chatId: string;
  replyToMessageId: number;
  replyText: string;
  responderTelegramId: string;
}

export async function handleReceptionReply(
  params: ReplyParams
): Promise<{ handled: boolean }> {
  // escalation_message_id ile eşleşen sla_event'i bul
  const { data: slaEvent } = await params.hotelSupabase
    .from('sla_events')
    .select('id, reception_responded_at, escalation_message_id, escalated_at')
    .eq('escalation_message_id', params.replyToMessageId)
    .maybeSingle();

  if (!slaEvent) {
    return { handled: false };
  }

  // Zaten cevaplanmış → normal sohbet mesajı olabilir
  if (slaEvent.reception_responded_at) {
    return { handled: false };
  }

  // DB'ye kaydet
  const now = new Date();
  await params.hotelSupabase
    .from('sla_events')
    .update({
      reception_responded_at: now.toISOString(),
      reception_response_text: params.replyText,
      reception_responder_telegram_id: params.responderTelegramId,
      final_status: 'escalated_resolved',
      closed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', slaEvent.id as string);

  // Onay mesajı gönder (resepsiyon grubuna, orijinal mesaja reply olarak)
  await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: `✅ Açıklamanız kaydedildi. Yönetici raporunda görüntülenecektir.`,
      reply_to_message_id: params.replyToMessageId,
    }),
  });

  console.log('[sla-reception-reply] handled:', {
    slaEventId: slaEvent.id,
    responder: params.responderTelegramId,
    replyPreview: params.replyText.slice(0, 80),
  });

  return { handled: true };
}
