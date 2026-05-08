// Modül 6 — Departman grubuna mesaj forward
// Misafir mesajını formatlayıp ilgili Telegram grubuna gönderir ve forwarded_messages'a kaydeder.

import { SupabaseClient } from '@supabase/supabase-js';
import { TelegramClient } from './client';

export interface ForwardInput {
  hotelSupa: SupabaseClient;   // Demo Hotel DB client
  tg: TelegramClient;          // Misafir bot TelegramClient (token'a sahip)
  aiIntentId: string | null;
  targetDept: string;
  targetChatId: number;
  wasRerouted: boolean;
  guestName: string;
  guestMessage: string;
  aiResponse: string;
  confidence: number;
}

export interface ForwardResult {
  status: 'sent' | 'failed';
  telegramMessageId?: number;
  error?: string;
}

export async function forwardToDepartment(input: ForwardInput): Promise<ForwardResult> {
  const {
    hotelSupa,
    tg,
    aiIntentId,
    targetDept,
    targetChatId,
    wasRerouted,
    guestName,
    guestMessage,
    aiResponse,
    confidence,
  } = input;

  const now = new Date();
  // Türkiye saatine (UTC+3) çevir
  const trDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const dateStr = trDate.toISOString().replace('T', ' ').substring(0, 16) + ' (TR)';

  const confidencePercent = Math.round(confidence * 100);
  const reroutedNote = wasRerouted ? '\n⚠️ _Off-hours veya sınıflandırılamadı — resepsiyona yönlendirildi_' : '';

  const msgText = [
    `🆕 *Misafir Talebi*`,
    ``,
    `👤 Misafir: ${escapeMarkdown(guestName)}`,
    `📝 Mesaj: ${escapeMarkdown(guestMessage)}`,
    `🤖 AI Cevabı: ${escapeMarkdown(aiResponse)}`,
    `📊 Departman: \`${targetDept}\` | Güven: %${confidencePercent}`,
    `🕐 ${dateStr}`,
    reroutedNote,
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  // forwarded_messages tablosuna pending kaydı oluştur
  const { data: fwdRow, error: insertError } = await hotelSupa
    .from('forwarded_messages')
    .insert({
      ai_intent_id: aiIntentId ?? null,
      target_department: targetDept,
      target_chat_id: targetChatId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[forward] forwarded_messages insert error:', insertError.message);
  }

  const fwdId = fwdRow?.id as string | undefined;

  // Telegram grubuna mesajı gönder
  let telegramMessageId: number | undefined;
  let sendError: string | undefined;

  try {
    const sent = await tg.sendMessage({
      chat_id: targetChatId,
      text: msgText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    telegramMessageId = sent.message_id;
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'unknown send error';
    console.error('[forward] Telegram send error:', sendError);
  }

  // forwarded_messages kaydını güncelle
  if (fwdId) {
    await hotelSupa
      .from('forwarded_messages')
      .update({
        status: sendError ? 'failed' : 'sent',
        telegram_message_id: telegramMessageId ?? null,
        error: sendError ?? null,
      })
      .eq('id', fwdId);
  }

  if (sendError) {
    return { status: 'failed', error: sendError };
  }
  return { status: 'sent', telegramMessageId };
}

/** Markdown MarkdownV1 özel karakterleri kaçır (sadece * ve _ ) */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, (c) => `\\${c}`);
}
