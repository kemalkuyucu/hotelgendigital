'use server';

import { TelegramClient } from '@/lib/telegram/client';

const VERCEL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hotelgen-v2.vercel.app';

const TOKEN_MAP: Record<string, string | undefined> = {
  'demo-hotel': process.env.TELEGRAM_BOT_TOKEN_DEMO,
};

export async function refreshTelegramWebhook(
  slug: string,
): Promise<{ ok: boolean; message: string }> {
  const token = TOKEN_MAP[slug];
  if (!token) return { ok: false, message: 'Bot token bulunamadı' };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return { ok: false, message: 'Webhook secret tanımsız' };

  const tg = new TelegramClient(token);
  const url = `${VERCEL_URL}/api/webhooks/telegram/${slug}`;
  await tg.setWebhook({
    url,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    drop_pending_updates: false,
  });
  return { ok: true, message: `Webhook güncellendi: ${url}` };
}

export async function getTelegramWebhookInfo(slug: string): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
} | null> {
  const token = TOKEN_MAP[slug];
  if (!token) return null;
  const tg = new TelegramClient(token);
  return tg.getWebhookInfo();
}
