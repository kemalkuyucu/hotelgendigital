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
    .select('id, reception_responded_at, reception_response_text, escalation_message_id, escalated_at, final_status')
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
  // GEC YANIT: check-runner event'i 'no_response' olarak kapatmis olabilir (resepsiyon
  // taninan surede yazmadi). Bu durumda gec gelen aciklama REDDEDILMEZ (sessiz yutma
  // yasagi); sistem notu SILINMEDEN altina eklenir, durum 'escalated_resolved_late' olur.
  const isLate = slaEvent.final_status === 'no_response';
  const mevcutMetin = (slaEvent.reception_response_text as string | null) ?? '';
  const receptionText = isLate
    ? `${mevcutMetin}\n\n[GEC YANIT - resepsiyon] ${params.replyText}`
    : params.replyText;
  const finalStatus = isLate ? 'escalated_resolved_late' : 'escalated_resolved';
  await params.hotelSupabase
    .from('sla_events')
    .update({
      reception_responded_at: now.toISOString(),
      reception_response_text: receptionText,
      reception_responder_telegram_id: params.responderTelegramId,
      final_status: finalStatus,
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
