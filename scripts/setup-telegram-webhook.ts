/**
 * Kullanım:
 *   npx tsx --env-file=.env.local scripts/setup-telegram-webhook.ts demo-hotel
 *   npx tsx --env-file=.env.local scripts/setup-telegram-webhook.ts demo-hotel --delete
 *   npx tsx --env-file=.env.local scripts/setup-telegram-webhook.ts demo-hotel --info
 *
 * Not: tsx v4+ --env-file flag'i destekler. Yoksa:
 *   node --env-file=.env.local --import=tsx/esm scripts/setup-telegram-webhook.ts demo-hotel
 */

import { TelegramClient } from '../src/lib/telegram/client';

const VERCEL_URL = 'https://hotelgen-v2.vercel.app';

async function main() {
  const slug = process.argv[2];
  const flag = process.argv[3];

  if (!slug) {
    console.error(
      'Kullanım: npx tsx scripts/setup-telegram-webhook.ts <hotel-slug> [--delete|--info]',
    );
    process.exit(1);
  }

  // Bot token map
  const tokenMap: Record<string, string | undefined> = {
    'demo-hotel': process.env.TELEGRAM_BOT_TOKEN_DEMO,
  };
  const token = tokenMap[slug];
  if (!token) {
    console.error(`Hata: '${slug}' için bot token bulunamadı`);
    process.exit(1);
  }

  const tg = new TelegramClient(token);

  if (flag === '--info') {
    const info = await tg.getWebhookInfo();
    console.log('Webhook info:', JSON.stringify(info, null, 2));
    return;
  }

  if (flag === '--delete') {
    const ok = await tg.deleteWebhook();
    console.log('Webhook silindi:', ok);
    return;
  }

  // setWebhook
  const url = `${VERCEL_URL}/api/webhooks/telegram/${slug}`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("TELEGRAM_WEBHOOK_SECRET .env.local'de tanımlı değil");
    process.exit(1);
  }

  console.log(`setWebhook: ${url}`);
  const ok = await tg.setWebhook({
    url,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    drop_pending_updates: true,
  });
  console.log('setWebhook ok:', ok);

  const info = await tg.getWebhookInfo();
  console.log('Doğrulama:', JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
