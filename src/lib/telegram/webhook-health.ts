import { TelegramClient } from '@/lib/telegram/client';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';

const DEMO_HOTEL_ID = process.env.DEMO_HOTEL_ID ?? '';
const VERCEL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hotelgen-v2.vercel.app';

type HotelEntry = { id: string; name: string; slug: string };

async function resolveBotToken(hotel: HotelEntry): Promise<string | null> {
  if (hotel.id === DEMO_HOTEL_ID || hotel.slug === 'demo-hotel') {
    return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  }
  const bridge = await getDecryptedBridge(hotel.id);
  return bridge?.telegramBotToken ?? null;
}

function buildExpectedUrl(slug: string): string {
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const baseUrl = isPreview
    ? 'https://hotelgen-v2-git-hotelgen-v4-hotelgendigital.vercel.app'
    : VERCEL_URL;
  let url = `${baseUrl}/api/webhooks/telegram/${slug}`;
  if (isPreview && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    url += `?x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}`;
  }
  return url;
}

export async function runWebhookHealthCheck(
  hotels: HotelEntry[]
): Promise<{ checked: number; repaired: number; failed: number; details: Array<{ hotel: string; action: string; reason: string }> }> {
  const alertChatId = process.env.ALERT_CHAT_ID;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const details: Array<{ hotel: string; action: string; reason: string }> = [];
  let checked = 0;
  let repaired = 0;
  let failed = 0;

  for (const hotel of hotels) {
    try {
      const token = await resolveBotToken(hotel);
      if (!token) continue;
      if (!secret) continue;

      const tg = new TelegramClient(token);
      const expectedUrl = buildExpectedUrl(hotel.slug);
      checked++;

      let info: { url: string; last_error_message?: string } | null = null;
      try {
        info = await tg.getWebhookInfo();
      } catch {
        info = null;
      }

      const currentUrl = info?.url ?? '';
      const lastError = info?.last_error_message ?? '';
      const needsRepair = currentUrl !== expectedUrl || (lastError && lastError.length > 0);

      if (!needsRepair) continue;

      const reason = currentUrl !== expectedUrl
        ? `url mismatch (current: ${currentUrl || 'BOS'})`
        : `last_error: ${lastError}`;

      try {
        await tg.setWebhook({
          url: expectedUrl,
          secret_token: secret,
          allowed_updates: ['message', 'edited_message', 'callback_query'],
          drop_pending_updates: false,
        });
        repaired++;
        details.push({ hotel: hotel.name, action: 'repaired', reason });

        if (alertChatId) {
          try {
            await tg.sendMessage({
              chat_id: alertChatId,
              text:
                `🔧 WEBHOOK OTOMATIK ONARILDI\n` +
                `Otel: ${hotel.name}\n` +
                `Sebep: ${reason}\n` +
                `Yeni URL: ${expectedUrl}`,
            });
          } catch {
            // alert gonderilemedi - yut, sistemi bozma
          }
        }
      } catch (e) {
        failed++;
        details.push({ hotel: hotel.name, action: 'repair_failed', reason: `${reason} | setWebhook: ${(e as Error).message}` });

        if (alertChatId) {
          try {
            await tg.sendMessage({
              chat_id: alertChatId,
              text:
                `❌ WEBHOOK ONARILAMADI\n` +
                `Otel: ${hotel.name}\n` +
                `Sebep: ${reason}\n` +
                `setWebhook hatasi: ${(e as Error).message}`,
            });
          } catch {
            // yut
          }
        }
      }
    } catch {
      // otel-bazli hata digerlerini bozmasin
      continue;
    }
  }

  return { checked, repaired, failed, details };
}
