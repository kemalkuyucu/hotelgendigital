import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendManagerMessage } from '@/lib/telegram/manager-bot-client';
import { handleHelp } from '@/lib/telegram/commands/handle-help';
import { handleRapor } from '@/lib/telegram/commands/handle-rapor';
import { handleDurum } from '@/lib/telegram/commands/handle-durum';
import { handleAktifKonusmalar } from '@/lib/telegram/commands/handle-aktif-konusmalar';
import { handleSonMesajlar } from '@/lib/telegram/commands/handle-son-mesajlar';
import { verifyTelegramSecret } from '@/lib/telegram/verify';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HotelManagerRow {
  id: string;
  name: string;
  slug: string;
  telegram_manager_chat_id: number | null;
}

function getCentralClient() {
  return createClient(
    process.env.CENTRAL_SUPABASE_URL!,
    process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function getDemoHotelClient() {
  return createClient(
    process.env.DEMO_HOTEL_SUPABASE_URL!,
    process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * /rapor tarih argümanı parse — "GG.AA" (gün.ay) formatı, yıl = şimdiki yıl,
 * timezone Europe/Istanbul (+03:00). start = ilk günün 00:00:00,
 * end = ikinci günün 23:59:59. Geçersizse null (eski son-24-saat davranışı).
 */
function parseRaporRange(
  arg1?: string,
  arg2?: string
): { startIso: string; endIso: string; label: string } | null {
  if (!arg1 || !arg2) return null;
  const re = /^(\d{1,2})\.(\d{1,2})$/;
  const m1 = re.exec(arg1);
  const m2 = re.exec(arg2);
  if (!m1 || !m2) return null;

  const d1 = Number(m1[1]);
  const mo1 = Number(m1[2]);
  const d2 = Number(m2[1]);
  const mo2 = Number(m2[2]);
  if (mo1 < 1 || mo1 > 12 || d1 < 1 || d1 > 31) return null;
  if (mo2 < 1 || mo2 > 12 || d2 < 1 || d2 > 31) return null;

  const year = new Date().getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = new Date(`${year}-${pad(mo1)}-${pad(d1)}T00:00:00+03:00`);
  const endDate = new Date(`${year}-${pad(mo2)}-${pad(d2)}T23:59:59+03:00`);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    label: `${arg1} - ${arg2}`,
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ hotelSlug: string }> }
) {
  // Next.js 16 — params is async
  const { hotelSlug } = await context.params;

  // 1) Signature secret doğrula (constant-time — AUDIT S8)
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (!verifyTelegramSecret(secretHeader, process.env.TELEGRAM_WEBHOOK_SECRET ?? '')) {
    return NextResponse.json({ ok: false, error: 'invalid secret' }, { status: 401 });
  }

  // 2) Body parse
  let update: Record<string, unknown>;
  try {
    update = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const message = update.message as Record<string, unknown> | undefined;
  if (!message) {
    return NextResponse.json({ ok: true }); // Telegram update tipi mesaj değil
  }

  const chatObj = message.chat as Record<string, unknown>;
  const incomingChatId = Number(chatObj.id);
  const text = (message.text as string | undefined) ?? '';

  // 3) Hotel'i Central'dan resolve et
  const central = getCentralClient();
  const { data: hotel } = await central
    .from('hotels')
    .select('id, name, slug, telegram_manager_chat_id')
    .eq('slug', hotelSlug)
    .single();

  if (!hotel) {
    return NextResponse.json({ ok: false, error: 'hotel not found' }, { status: 404 });
  }

  const hotelRow = hotel as HotelManagerRow;

  // 4) Yetki — report_recipients (telegram) VEYA eski telegram_manager_chat_id fallback
  const { data: recipients } = await central
    .from('report_recipients')
    .select('platform_id')
    .eq('hotel_id', hotelRow.id)
    .eq('platform', 'telegram');

  const authorized =
    (recipients ?? []).some((r) => String(r.platform_id) === String(incomingChatId)) ||
    Number(hotelRow.telegram_manager_chat_id) === incomingChatId;

  // yetkisiz mesajları sessizce yut
  if (!authorized) {
    // 200 OK dön — ama gönderene cevap verme
    console.warn(
      `[manager-webhook] unauthorized chat_id: ${incomingChatId} for hotel ${hotelSlug}`
    );
    return NextResponse.json({ ok: true });
  }

  // 5) Hotel client'ı al (departments, mesaj sayıları vb. için)
  // Demo hotel için direkt env var'dan, production'da bridge_credentials'tan gelecek
  const hotelClient = hotelSlug === 'demo-hotel'
    ? getDemoHotelClient()
    : await getHotelClient(hotelRow.id);

  if (!hotelClient) {
    console.error(`[manager-webhook] hotel client alınamadı: ${hotelSlug}`);
    return NextResponse.json({ ok: true, info: 'no db client' });
  }

  // 6) Komut parse + dispatch
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith('/');
  let response: string;

  try {
    if (!isCommand) {
      response = '⚠️ Sadece komutları işliyorum. Komut listesi için /help yazın.';
    } else {
      const [rawCmd, ...args] = trimmed.split(/\s+/);
      const cmd = rawCmd.toLowerCase().split('@')[0]; // /rapor@bot → /rapor

      switch (cmd) {
        case '/start':
        case '/help':
          response = await handleHelp(hotelRow.name);
          break;
        case '/rapor': {
          // "/rapor 01.06 07.06" → tarih aralığı; yoksa eski son-24-saat
          const raporRange = parseRaporRange(args[0], args[1]);
          response = raporRange
            ? await handleRapor(hotelClient, raporRange)
            : await handleRapor(hotelClient);
          await sendManagerMessage({ chatId: incomingChatId, text: response, parseMode: 'HTML' });
          return NextResponse.json({ ok: true });
        }
        case '/durum':
          response = await handleDurum(hotelClient, hotelRow.id, central);
          break;
        case '/aktif_konusmalar':
          response = await handleAktifKonusmalar(hotelClient);
          break;
        case '/son_mesajlar': {
          const n = parseInt(args[0] ?? '10', 10);
          response = await handleSonMesajlar(hotelClient, isNaN(n) ? 10 : Math.min(n, 50));
          break;
        }
        default:
          response = `❓ Bilinmeyen komut: \`${cmd}\`\nKomut listesi için /help yazın.`;
      }
    }
  } catch (err) {
    console.error('[manager-webhook] komut hatası:', err);
    response = '❌ Komut işlenirken bir hata oluştu. Lütfen tekrar deneyin.';
  }

  // 7) Cevap gönder
  try {
    await sendManagerMessage({ chatId: incomingChatId, text: response });
  } catch (err) {
    console.error('[manager-webhook] sendManagerMessage hatası:', err);
  }

  return NextResponse.json({ ok: true });
}
