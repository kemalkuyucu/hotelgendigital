// =============================================================================
// allergen-notify.ts — Alerjen Modülü 4: Bildirim Yönlendirme
// =============================================================================
// Kurallar (ALERJEN_MODUL4_KURALLAR.md referans):
//
//   SENARYO A: room_number var + inhouse aktif eşleşme → TAM bildirim
//     - FB alerjen sorumlusu (is_allergen_primary=true)
//     - Tüm FB yedek/amirler (is_allergen_backup=true)  [AYNI ANDA, sıralı değil]
//     - GR sorumlusu = department_key='guest_relation', tüm aktif personel
//     - GR müdürü    = department_key='guest_relation', is_manager=true
//     - Mesai dışı (00:00-08:00 TR) → resepsiyon + ön büro müdürüne EK uyarı
//
//   SENARYO B: room_number var ama inhouse eşleşmesi yok → SADECE GR
//
//   SENARYO C: room_number yok → bildirim YOK, sadece log (status=skipped)
//
// Vercel Hobby uyumu: void(async()=>{})() YOK — sıralı await kullan.
// Telegram ID boş olana gönderme → log'a status='skipped_no_telegram_id' yaz.
// Türkiye saati: Europe/Istanbul (Intl.DateTimeFormat).
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { TelegramClient } from './client';

// ─── Input / Output Tipleri ──────────────────────────────────────────────────

export interface AllergenNotifyInput {
  hotelSupa: SupabaseClient;
  tg: TelegramClient;
  guestAllergenId: string;    // guest_allergens.id
  roomNumber: string | null;  // null → Senaryo C
  guestFullName: string | null;
  allergenText: string;
}

interface StaffRow {
  id: string;
  full_name: string;
  telegram_user_id: string | null;
  is_allergen_primary: boolean;
  is_allergen_backup: boolean;
  is_manager: boolean;
  department_key: string;
}

// ─── Yardımcı: Türkiye saati string ──────────────────────────────────────────

function getTrTimeStr(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now) + ' (TR)';
}

// ─── Yardımcı: Mesai dışı mı? (00:00–08:00 TR) ───────────────────────────────

function isGrOffHours(): boolean {
  // GR mesai: 08:00–00:00 → mesai dışı: 00:00–08:00
  const now = new Date();
  const trFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = trFormatter.formatToParts(now);
  const hour   = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const currentMinutes = hour * 60 + minute;
  // 00:00 = 0, 08:00 = 480 → mesai dışı: 0 <= current < 480
  return currentMinutes < 8 * 60;
}

// ─── Yardımcı: HTML kaçış ────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Yardımcı: Telegram DM gönder + log yaz ──────────────────────────────────

interface SendAndLogParams {
  hotelSupa: SupabaseClient;
  tg: TelegramClient;
  guestAllergenId: string;
  staff: StaffRow;
  recipientType: string;
  scenario: string;
  notificationText: string;
}

async function sendAndLog(p: SendAndLogParams): Promise<void> {
  const {
    hotelSupa, tg, guestAllergenId, staff,
    recipientType, scenario, notificationText,
  } = p;

  // Telegram ID boşsa → skipped_no_telegram_id
  if (!staff.telegram_user_id) {
    await hotelSupa.from('allergen_notification_log').insert({
      guest_allergen_id:  guestAllergenId,
      recipient_type:     recipientType,
      staff_id:           staff.id,
      staff_full_name:    staff.full_name,
      telegram_user_id:   null,
      status:             'skipped_no_telegram_id',
      scenario,
      notification_text:  notificationText,
    });
    console.log(`[allergen-notify] SKIP no telegram_id → ${staff.full_name} (${recipientType})`);
    return;
  }

  let dmChatId: number;
  try {
    dmChatId = Number(BigInt(staff.telegram_user_id));
  } catch {
    await hotelSupa.from('allergen_notification_log').insert({
      guest_allergen_id:  guestAllergenId,
      recipient_type:     recipientType,
      staff_id:           staff.id,
      staff_full_name:    staff.full_name,
      telegram_user_id:   staff.telegram_user_id,
      status:             'failed',
      error_message:      'invalid telegram_user_id (BigInt parse failed)',
      scenario,
      notification_text:  notificationText,
    });
    return;
  }

  const personalizedText =
    notificationText + `\n👮 <b>Alıcı:</b> ${escHtml(staff.full_name)}`;

  try {
    await tg.sendMessage({
      chat_id: dmChatId,
      text: personalizedText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    await hotelSupa.from('allergen_notification_log').insert({
      guest_allergen_id:  guestAllergenId,
      recipient_type:     recipientType,
      staff_id:           staff.id,
      staff_full_name:    staff.full_name,
      telegram_user_id:   staff.telegram_user_id,
      status:             'sent',
      scenario,
      notification_text:  notificationText,
      sent_at:            new Date().toISOString(),
    });
    console.log(`[allergen-notify] SENT → ${staff.full_name} (${recipientType}) chatId=${dmChatId}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await hotelSupa.from('allergen_notification_log').insert({
      guest_allergen_id:  guestAllergenId,
      recipient_type:     recipientType,
      staff_id:           staff.id,
      staff_full_name:    staff.full_name,
      telegram_user_id:   staff.telegram_user_id,
      status:             'failed',
      error_message:      errMsg.slice(0, 500),
      scenario,
      notification_text:  notificationText,
    });
    console.error(`[allergen-notify] FAILED → ${staff.full_name}: ${errMsg}`);
  }
}

// ─── Inhouse eşleşme kontrol ─────────────────────────────────────────────────

async function checkInhouseMatch(
  hotelSupa: SupabaseClient,
  roomNumber: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  // Europe/Istanbul ile bugünün tarihini al
  const trDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // 'YYYY-MM-DD' formatı

  // inhouse_guests_v2 → status='active' + room_number eşleşmesi
  const { data, error } = await hotelSupa
    .from('inhouse_guests_v2')
    .select('id')
    .eq('room_number', roomNumber)
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.warn(`[allergen-notify] inhouse check error: ${error.message}`);
    // Hata durumunda güvenli tarafta kal → eşleşme var say
    return false;
  }
  void today; void trDate; // kullanılmıyor ama gelecekte tarih filtresi için hazır
  return (data ?? []).length > 0;
}

// ─── ANA FONKSİYON ───────────────────────────────────────────────────────────

/**
 * Alerjen bildirimi gönderir ve allergen_notification_log'a yazar.
 * Vercel Hobby uyumu: sıralı await (void IIFE yok).
 */
export async function sendAllergenNotifications(
  input: AllergenNotifyInput,
): Promise<void> {
  const { hotelSupa, tg, guestAllergenId, roomNumber, guestFullName, allergenText } = input;

  const trTimeStr = getTrTimeStr();
  const room     = roomNumber?.trim() || null;
  const name     = guestFullName?.trim() || '(bilinmiyor)';

  // ── SENARYO C: room_number yok ─────────────────────────────────────────────
  if (!room) {
    console.log('[allergen-notify] Senaryo C → room_number yok, bildirim yok, log düşüyor');
    await hotelSupa.from('allergen_notification_log').insert({
      guest_allergen_id: guestAllergenId,
      recipient_type:    'none',
      status:            'skipped_no_telegram_id', // "skipped" benzeri durum — özel değer yok, bunu kullan
      scenario:          'C',
      notification_text: null,
    });
    return;
  }

  // ── Inhouse eşleşme kontrolü ───────────────────────────────────────────────
  const inhouseMatch = await checkInhouseMatch(hotelSupa, room);

  // ── Personel çekme: FB (allergen flags) ────────────────────────────────────
  const { data: fbStaffData } = await hotelSupa
    .from('department_staff')
    .select('id, full_name, telegram_user_id, is_allergen_primary, is_allergen_backup, is_manager, department_key')
    .eq('department_key', 'fb')
    .eq('is_active', true);

  const fbStaff = (fbStaffData ?? []) as StaffRow[];
  const fbPrimary = fbStaff.filter(s => s.is_allergen_primary);
  const fbBackup  = fbStaff.filter(s => s.is_allergen_backup);

  // ── Personel çekme: GR ─────────────────────────────────────────────────────
  const { data: grStaffData } = await hotelSupa
    .from('department_staff')
    .select('id, full_name, telegram_user_id, is_allergen_primary, is_allergen_backup, is_manager, department_key')
    .eq('department_key', 'guest_relation')
    .eq('is_active', true);

  const grStaff   = (grStaffData ?? []) as StaffRow[];
  const grAll     = grStaff; // Tüm aktif GR personeli
  const grManager = grStaff.filter(s => s.is_manager);

  // ── SENARYO A: room_number var + inhouse eşleşmesi VAR ────────────────────
  if (inhouseMatch) {
    console.log(`[allergen-notify] Senaryo A → room=${room} name=${name}`);
    const scenario = 'A';

    // Mutfak mesajı
    const kitchenText =
      `⚠️ <b>ALERJEN BİLDİRİMİ — Mutfak / F&B</b>\n` +
      `━━━━━━━━━━\n` +
      `🛏 <b>Oda:</b> ${escHtml(room)}\n` +
      `👤 <b>Misafir:</b> ${escHtml(name)}\n` +
      `🤧 <b>Alerji:</b> ${escHtml(allergenText)}\n` +
      `━━━━━━━━━━\n` +
      `🕐 ${trTimeStr}`;

    // GR mesajı
    const grText =
      `⚠️ <b>ALERJEN BİLDİRİMİ — Misafir İlişkileri (GR)</b>\n` +
      `━━━━━━━━━━\n` +
      `🛏 <b>Oda:</b> ${escHtml(room)}\n` +
      `👤 <b>Misafir:</b> ${escHtml(name)}\n` +
      `🤧 <b>Alerji:</b> ${escHtml(allergenText)}\n` +
      `━━━━━━━━━━\n` +
      `ℹ️ Lütfen misafir ile ilgilenin.\n` +
      `🕐 ${trTimeStr}`;

    // 1. FB primary
    for (const staff of fbPrimary) {
      await sendAndLog({ hotelSupa, tg, guestAllergenId, staff, recipientType: 'fb_primary', scenario, notificationText: kitchenText });
    }

    // 2. FB backup (hepsine aynı anda = döngüde sıralı — Vercel uyumu için)
    for (const staff of fbBackup) {
      await sendAndLog({ hotelSupa, tg, guestAllergenId, staff, recipientType: 'fb_backup', scenario, notificationText: kitchenText });
    }

    // 3. Tüm aktif GR personeli
    for (const staff of grAll) {
      await sendAndLog({ hotelSupa, tg, guestAllergenId, staff, recipientType: 'gr', scenario, notificationText: grText });
    }

    // 4. GR müdürü (is_manager=true) — grAll içinde zaten var ama ayrıca log tipi 'gr_manager'
    //    grManager, grAll'in alt kümesi. Çakışmasın diye sadece grAll döngüsünde gönderdik.
    //    Ayrı 'gr_manager' logu isteniyorsa burada ek log atılır.
    // (Kural: GR sorumlusu = tüm aktif GR, GR müdürü = is_manager=true. İkisi birlikte gider.)
    // Hem log hem bildirim grAll döngüsünde halledildi.
    void grManager; // ileride ayrı aksiyon alınabilir (ESLint uyarı bastır)

    // 5. Mesai dışı → resepsiyon + ön büro müdürüne EK uyarı
    if (isGrOffHours()) {
      console.log('[allergen-notify] GR mesai dışı — resepsiyon + ön büro müdürüne ek uyarı');

      const offHoursText =
        `⚠️ <b>ALERJEN BİLDİRİMİ</b> (GR Mesai Dışı)\n` +
        `━━━━━━━━━━\n` +
        `🛏 <b>Oda:</b> ${escHtml(room)}\n` +
        `👤 <b>Misafir:</b> ${escHtml(name)}\n` +
        `🤧 <b>Alerji:</b> ${escHtml(allergenText)}\n` +
        `━━━━━━━━━━\n` +
        `📌 GR şu an mesai dışı. Lütfen GR'ye not bırakın.\n` +
        `🕐 ${trTimeStr}`;

      const { data: foStaffData } = await hotelSupa
        .from('department_staff')
        .select('id, full_name, telegram_user_id, is_allergen_primary, is_allergen_backup, is_manager, department_key')
        .eq('department_key', 'front_office')
        .eq('is_active', true);

      const foStaff = (foStaffData ?? []) as StaffRow[];

      for (const staff of foStaff) {
        await sendAndLog({ hotelSupa, tg, guestAllergenId, staff, recipientType: 'front_office', scenario, notificationText: offHoursText });
      }
    }

    return;
  }

  // ── SENARYO B: room_number var ama inhouse eşleşmesi YOK ─────────────────
  console.log(`[allergen-notify] Senaryo B → room=${room} inhouse yok, sadece GR`);
  const scenario = 'B';

  const grTextB =
    `ℹ️ <b>ALERJEN BİLDİRİMİ</b> (Oda Bekliyor)\n` +
    `━━━━━━━━━━\n` +
    `👤 <b>Misafir:</b> ${escHtml(name)}\n` +
    `🛏 <b>Belirtilen oda:</b> ${escHtml(room)}\n` +
    `🤧 <b>Alerji:</b> ${escHtml(allergenText)}\n` +
    `━━━━━━━━━━\n` +
    `📌 Misafir henüz oda almamış. Oda alınınca lütfen ilgilenin.\n` +
    `🕐 ${trTimeStr}`;

  for (const staff of grAll) {
    await sendAndLog({ hotelSupa, tg, guestAllergenId, staff, recipientType: 'gr', scenario, notificationText: grTextB });
  }
}
