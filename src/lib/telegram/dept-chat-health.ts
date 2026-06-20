import { TelegramClient } from '@/lib/telegram/client';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEMO_HOTEL_ID = process.env.DEMO_HOTEL_ID ?? '';

type HotelEntry = { id: string; name: string; slug: string };

async function resolveBotToken(hotel: HotelEntry): Promise<string | null> {
  if (hotel.id === DEMO_HOTEL_ID || hotel.slug === 'demo-hotel') {
    return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? null;
  }
  const bridge = await getDecryptedBridge(hotel.id);
  return bridge?.telegramBotToken ?? null;
}

export async function runDeptChatHealthCheck(
  hotels: HotelEntry[],
  getHotelSupabase: (hotelId: string) => Promise<SupabaseClient | null>
): Promise<{ checked: number; invalid: number; details: Array<{ hotel: string; code: string; chatId: string }> }> {
  const alertChatId = process.env.ALERT_CHAT_ID;
  const invalidList: Array<{ hotel: string; code: string; chatId: string }> = [];
  let checked = 0;

  for (const hotel of hotels) {
    try {
      const token = await resolveBotToken(hotel);
      if (!token) continue;
      const db = await getHotelSupabase(hotel.id);
      if (!db) continue;

      const { data: depts } = await db
        .from('departments')
        .select('code, telegram_chat_id')
        .eq('is_enabled', true);
      if (!depts) continue;

      const tg = new TelegramClient(token);

      for (const dept of depts) {
        const chatId = dept.telegram_chat_id;
        if (!chatId) continue;
        checked++;
        try {
          await tg.getChat({ chat_id: chatId });
        } catch {
          invalidList.push({ hotel: hotel.name, code: dept.code, chatId: String(chatId) });
        }
      }

      if (invalidList.length > 0 && alertChatId) {
        const lines = invalidList
          .filter((x) => x.hotel === hotel.name)
          .map((x) => `- ${x.code}: ${x.chatId}`)
          .join('\n');
        if (lines) {
          try {
            await tg.sendMessage({
              chat_id: alertChatId,
              text:
                `⚠️ DEPT CHAT_ID SAGLIK KONTROLU\n` +
                `Otel: ${hotel.name}\n` +
                `Ulasilamayan departman gruplari:\n${lines}\n\n` +
                `Bu gruplara forward yapilamaz. Lutfen chat_id'leri kontrol edin.`,
            });
          } catch {
            // ALERT gonderilemedi (bot ALERT_CHAT_ID'ye erisemiyor olabilir) - yut, sistemi bozma
          }
        }
      }
    } catch {
      // otel-bazli hata digerlerini bozmasin
      continue;
    }
  }

  return { checked, invalid: invalidList.length, details: invalidList };
}
