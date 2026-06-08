'use server';

import { TelegramClient } from '@/lib/telegram/client';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import { getCentralSupabase } from '@/lib/supabase-client';

const VERCEL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hotelgen-v2.vercel.app';

/** Token'ı belirle: demo-hotel → env, diğerleri → bridge_credentials decrypt */
async function resolveTokenAndSlug(slugOrId: string): Promise<{
  token: string | null
  slug: string | null
}> {
  // demo-hotel → env var (geriye uyumluluk)
  if (slugOrId === 'demo-hotel') {
    return { token: process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null, slug: 'demo-hotel' }
  }

  // Önce slug olarak dene
  const central = getCentralSupabase()
  const { data: hotelBySlug } = await central
    .from('hotels')
    .select('id, slug')
    .eq('slug', slugOrId)
    .maybeSingle()

  const hotelId = hotelBySlug?.id ?? slugOrId
  const hotelSlug = hotelBySlug?.slug ?? slugOrId

  const bridge = await getDecryptedBridge(hotelId)
  return { token: bridge?.telegramBotToken ?? null, slug: hotelSlug }
}

export async function refreshTelegramWebhook(
  slug: string,
): Promise<{ ok: boolean; message: string }> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return { ok: false, message: 'Webhook secret tanımsız' };

  const { token, slug: resolvedSlug } = await resolveTokenAndSlug(slug)
  if (!token) return { ok: false, message: `Bot token bulunamadı — bridge_credentials'da telegram_bot_token_encrypted eksik mi?` };

  const tg = new TelegramClient(token);
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const baseUrl = isPreview
    ? 'https://hotelgen-v2-git-hotelgen-v4-hotelgendigital.vercel.app'
    : VERCEL_URL;
  let url = `${baseUrl}/api/webhooks/telegram/${resolvedSlug ?? slug}`;
  if (isPreview && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    url += `?x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}`;
  }
  try {
    await tg.setWebhook({
      url,
      secret_token: secret,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      drop_pending_updates: false,
    });
    return { ok: true, message: `Webhook güncellendi: ${url}` };
  } catch (e) {
    return { ok: false, message: `setWebhook hatası: ${(e as Error).message}` }
  }
}

export async function getTelegramWebhookInfo(slug: string): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
} | null> {
  const { token } = await resolveTokenAndSlug(slug)
  if (!token) return null;
  const tg = new TelegramClient(token);
  return tg.getWebhookInfo();
}
