/**
 * Module 17.d - Telegram send helper
 * Used for outbound notification delivery to guests
 */

export interface SendTelegramParams {
  hotelSlug: string;
  chatId: number;   // guest telegram_id
  message: string;
}

export interface SendTelegramResult {
  success: boolean;
  error?: string;
}

function getBotTokenForSlug(hotelSlug: string): string | null {
  if (hotelSlug === 'demo-hotel') {
    return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  }
  // Future: read from a slug→token map or hotel config
  return null;
}

export async function sendTelegram(
  params: SendTelegramParams,
): Promise<SendTelegramResult> {
  const token = getBotTokenForSlug(params.hotelSlug);
  if (!token) {
    const msg = `[send-telegram] No bot token for slug: ${params.hotelSlug}`;
    console.error(msg);
    return { success: false, error: 'No bot token configured for this hotel.' };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.message,
          parse_mode: 'HTML',
        }),
      },
    );

    const json = (await res.json()) as { ok: boolean; description?: string };

    if (!json.ok) {
      const errMsg = json.description ?? 'Telegram API error';
      console.error(`[send-telegram] API error → chatId=${params.chatId}:`, errMsg);
      return { success: false, error: errMsg };
    }

    console.log(`[send-telegram] OK → chatId=${params.chatId} slug=${params.hotelSlug}`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    console.error(`[send-telegram] Exception → chatId=${params.chatId}:`, errMsg);
    return { success: false, error: errMsg };
  }
}
