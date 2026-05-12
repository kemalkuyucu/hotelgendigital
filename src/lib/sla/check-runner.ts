/**
 * Modül 11 — SLA Check Runner
 * health-check cron'u tarafından her dakika çağrılır.
 *
 * Görevler:
 *   1. Departman SLA aşımı → resepsiyona escalation mesajı
 *   2. Resepsiyon SLA aşımı → "no_response" otomatik kaydı
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface HotelEntry {
  id: string;
  slug: string;
  status: string;
}

interface SlaRunResult {
  hotelSlug: string;
  eventId: string;
  action: 'escalated' | 'no_response_auto';
}

/** Demo için env'den token al. Production'da bridge_credentials'tan decrypt edilecek. */
function getBotTokenForHotel(_hotelId: string): string {
  return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? '';
}

function formatIstanbulTime(d: Date): string {
  return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DEPT_LABEL_MAP: Record<string, string> = {
  technical: 'Teknik Servis',
  housekeeping: 'Housekeeping',
  fb: 'F&B',
  spa: 'SPA',
  animation: 'Animasyon',
  guest_relation: 'Misafir İlişkileri',
  front_office: 'Ön Büro',
};

export async function runSlaCheck(
  hotels: HotelEntry[],
  getHotelSupabase: (hotelId: string) => Promise<SupabaseClient | null>
): Promise<SlaRunResult[]> {
  const now = new Date();
  const results: SlaRunResult[] = [];

  for (const hotel of hotels) {
    const hotelSupabase = await getHotelSupabase(hotel.id);
    if (!hotelSupabase) {
      console.warn(`[sla-check] hotel DB yok: ${hotel.slug}`);
      continue;
    }

    const botToken = getBotTokenForHotel(hotel.id);
    if (!botToken) {
      console.warn(`[sla-check] bot token yok: ${hotel.slug}`);
      continue;
    }

    // ═══════════════════════════════════════════════════════
    // 1. Departman SLA aşımı → escalation
    // ═══════════════════════════════════════════════════════
    const { data: overdueDept } = await hotelSupabase
      .from('sla_events')
      .select('*')
      .lt('sla_deadline', now.toISOString())
      .is('responded_at', null)
      .is('escalated_at', null)
      .limit(50);

    for (const ev of overdueDept ?? []) {
      // front_office departmanını bul
      const { data: frontOffice } = await hotelSupabase
        .from('departments')
        .select('telegram_group_chat_id, telegram_chat_id, reception_sla_minutes')
        .eq('code', 'front_office')
        .maybeSingle();

      // telegram_group_chat_id veya telegram_chat_id'yi kullan
      const foChatId =
        (frontOffice as { telegram_group_chat_id?: string | null; telegram_chat_id?: number | null } | null)?.telegram_group_chat_id ??
        (frontOffice as { telegram_group_chat_id?: string | null; telegram_chat_id?: number | null } | null)?.telegram_chat_id?.toString() ??
        null;

      if (!foChatId) {
        console.warn('[sla-check] front_office chat_id yok, escalation atlandı:', ev.id);
        continue;
      }

      const elapsedMin = Math.round(
        (now.getTime() - new Date(ev.forwarded_at as string).getTime()) / 60000
      );

      const html =
        `🚨 <b>SLA AŞIMI — Cevapsız Talep</b>\n\n` +
        `🚪 <b>Oda:</b> ${escapeHtml((ev.room_number as string | null) ?? '-')}\n` +
        `👤 <b>Misafir:</b> ${escapeHtml((ev.guest_full_name as string | null) ?? '-')}\n` +
        `📝 <b>Talep:</b> "${escapeHtml(ev.request_text as string)}"\n` +
        `🏢 <b>Departman:</b> ${DEPT_LABEL_MAP[ev.department_code as string] ?? (ev.department_code as string)}\n` +
        `🕐 <b>Talep geliş:</b> ${formatIstanbulTime(new Date(ev.forwarded_at as string))}\n` +
        `⏱ <b>SLA aşımı:</b> ${elapsedMin} dakika (cevap verilmedi)\n\n` +
        `<b>Lütfen kontrol edip aksiyon alın:</b>\n` +
        `• Departmanı arayıp durumu sorun\n` +
        `• Bu mesaja <b>REPLY</b> ile açıklamanızı yazın\n` +
        `• Açıklama yönetici raporunda görünecektir`;

      const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: foChatId,
          text: html,
          parse_mode: 'HTML',
        }),
      });

      const sendData = (await sendRes.json()) as { ok: boolean; result?: { message_id: number } };

      const receptionSlaMinutes = (frontOffice as { reception_sla_minutes?: number | null } | null)?.reception_sla_minutes ?? 5;
      const receptionDeadline = new Date(
        now.getTime() + receptionSlaMinutes * 60 * 1000
      );

      await hotelSupabase
        .from('sla_events')
        .update({
          escalated_at: now.toISOString(),
          escalation_message_id: sendData?.result?.message_id ?? null,
          reception_sla_deadline: receptionDeadline.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', ev.id as string);

      results.push({ hotelSlug: hotel.slug, eventId: ev.id as string, action: 'escalated' });
      console.log('[sla-check] escalated:', { hotelSlug: hotel.slug, eventId: ev.id, dept: ev.department_code });
    }

    // ═══════════════════════════════════════════════════════
    // 2. Resepsiyon SLA aşımı → no_response otomatik kaydı
    // ═══════════════════════════════════════════════════════
    const { data: overdueRecep } = await hotelSupabase
      .from('sla_events')
      .select('id')
      .lt('reception_sla_deadline', now.toISOString())
      .not('escalated_at', 'is', null)
      .is('reception_responded_at', null)
      .is('final_status', null)
      .limit(50);

    for (const ev of overdueRecep ?? []) {
      await hotelSupabase
        .from('sla_events')
        .update({
          final_status: 'no_response',
          closed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', ev.id as string);

      results.push({ hotelSlug: hotel.slug, eventId: ev.id as string, action: 'no_response_auto' });
      console.log('[sla-check] no_response_auto:', { hotelSlug: hotel.slug, eventId: ev.id });
    }
  }

  return results;
}
