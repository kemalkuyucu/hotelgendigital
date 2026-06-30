import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendManagerMessage, sendManagerDocument } from '@/lib/telegram/manager-bot-client';
import { handleHelp } from '@/lib/telegram/commands/handle-help';
import { handleRapor } from '@/lib/telegram/commands/handle-rapor';
import { buildRaporExcel } from '@/lib/telegram/commands/build-rapor-excel';
import { handleDurum } from '@/lib/telegram/commands/handle-durum';
import { handleAktifKonusmalar } from '@/lib/telegram/commands/handle-aktif-konusmalar';
import { handleSonMesajlar } from '@/lib/telegram/commands/handle-son-mesajlar';
import { verifyTelegramSecret } from '@/lib/telegram/verify';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
import { downloadTelegramAudio } from '@/lib/voice/download-telegram-audio';
import { whisperTranscribe } from '@/lib/voice/whisper-transcribe';
import { normalizeTr } from '@/lib/utils/normalize-tr';

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
  // let — sesli "rapor" komutu aşağıda text'i '/rapor' olarak yeniden kurabilir.
  let text = (message.text as string | undefined) ?? '';

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

  // 5.5) SESLİ KOMUT → text (Modül 10.5 ikizi, manager bot token ile)
  // message.text BOŞSA ve voice/audio VARSA: Whisper ile yazıya çevir; "rapor"
  // geçiyorsa text'i '/rapor' olarak kur ki aşağıdaki MEVCUT dispatch aynen çalışsın.
  // message.text DOLU geldiğinde bu blok HİÇ çalışmaz → mevcut text akışı birebir korunur.
  {
    const voiceObj = (message.voice || message.audio) as
      | { file_id: string; duration?: number }
      | undefined;

    if (!text && voiceObj) {
      // Süre limiti: 5 dakika (300 sn) — guest tarafıyla aynı
      if (voiceObj.duration && voiceObj.duration > 300) {
        await sendManagerMessage({
          chatId: incomingChatId,
          text: '⏳ Ses mesajınız çok uzun (5 dakikadan fazla). Lütfen daha kısa bir kayıt gönderin ya da komutu yazılı paylaşın.',
        });
        return NextResponse.json({ ok: true });
      }

      const botToken = process.env.TELEGRAM_MANAGER_BOT_TOKEN_DEMO;
      if (!botToken) {
        console.error('[manager-webhook] TELEGRAM_MANAGER_BOT_TOKEN_DEMO yok — voice atlandı');
        return NextResponse.json({ ok: true });
      }

      let transcribed = '';
      try {
        const dl = await downloadTelegramAudio({
          botToken,
          fileId: voiceObj.file_id,
          durationSeconds: voiceObj.duration,
        });
        const tr = await whisperTranscribe({
          audioBuffer: dl.buffer,
          filename: dl.filename,
          mimeType: dl.mimeType,
          promptHint: 'otel yönetici rapor komutu',
        });
        transcribed = (tr.text || '').trim();
      } catch (err) {
        console.error('[manager-webhook] voice işleme hatası:', err);
        await sendManagerMessage({
          chatId: incomingChatId,
          text: '🎤 Ses mesajınızı işlerken bir sorun oluştu. Lütfen tekrar deneyin ya da komutu yazılı gönderin.',
        });
        return NextResponse.json({ ok: true });
      }

      if (!transcribed || transcribed.length < 2) {
        await sendManagerMessage({
          chatId: incomingChatId,
          text: '🎤 Sesinizi anlayamadım. Lütfen tekrar deneyin ya da komutu yazılı gönderin.',
        });
        return NextResponse.json({ ok: true });
      }

      // Deterministik komut eşleme (şimdilik sadece "rapor").
      // Tarih çıkarımı sesle RİSKLİ (konuşma dili → GG.AA) → argümansız: son 24 saat.
      // Tarih aralığı sesle Aşama 2'ye bırakıldı (şimdilik kapsam dışı).
      if (normalizeTr(transcribed).includes('rapor')) {
        text = '/rapor';
      } else {
        await sendManagerMessage({
          chatId: incomingChatId,
          text: `Anlaşılan: "${transcribed}". Şu an sadece sesli "rapor" komutu destekleniyor.`,
        });
        return NextResponse.json({ ok: true });
      }
    }
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
          // Özet metin önce gider (mevcut davranış aynen korunur)
          await sendManagerMessage({ chatId: incomingChatId, text: response, parseMode: 'HTML' });

          // Detaylı departman Excel'i — özet mesajı ETKİLEMEZ (izole try/catch).
          // range null dalında handleRapor'un iç son-24-saat hesabını taklit et:
          //   start = now-24h, end = now (handleRapor'da end=null = üst sınırsız → şimdi).
          const excelRange = raporRange ?? {
            startIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endIso: new Date().toISOString(),
            label: 'Son 24 Saat',
          };
          try {
            const buf = await buildRaporExcel(hotelClient, excelRange);
            const fname = `rapor_${excelRange.label.replace(/[^0-9A-Za-z.]/g, '_')}.xlsx`;
            await sendManagerDocument(incomingChatId, buf, fname, 'Detayli departman raporu');
          } catch (e) {
            console.error('[rapor-excel] failed', e);
          }
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
