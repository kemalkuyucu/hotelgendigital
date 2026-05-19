/**
 * Module 17.d - Send Checkout Notifications API
 * POST /api/hotel-admin/[slug]/inhouse/send-checkout-notifications
 *
 * Body: { guest_ids: string[], notification_date: string }
 * Response: { total, by_channel: { telegram, whatsapp, manual }, skipped_no_contact, errors }
 *
 * Auth: hotel_owner | front_office_manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { lateCheckoutMessage, formatCheckoutDate } from '@/lib/notifications/templates';
import { sendTelegram } from '@/lib/notifications/send-telegram';
import { sendManychat } from '@/lib/notifications/send-manychat';

export const runtime = 'nodejs';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

interface RequestBody {
  guest_ids: string[];
  notification_date: string;
}

interface ChannelStat {
  sent: number;
  failed: number;
}

interface SendResult {
  total: number;
  by_channel: {
    telegram: ChannelStat;
    whatsapp: ChannelStat;
    manual: number;
  };
  skipped_no_contact: number;
  errors: string[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const admin = await getHotelAdminFromCookie();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: 'Bu işlemi yapma yetkiniz yok.' }, { status: 403 });
  }

  const { slug } = await params;
  if (slug !== admin.hotel_slug) {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 });
  }

  // ── Body parse ───────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const { guest_ids, notification_date } = body;
  if (!Array.isArray(guest_ids) || guest_ids.length === 0) {
    return NextResponse.json({ error: 'En az bir misafir ID\'si gereklidir.' }, { status: 400 });
  }
  if (!notification_date || !/^\d{4}-\d{2}-\d{2}$/.test(notification_date)) {
    return NextResponse.json({ error: 'notification_date YYYY-MM-DD formatında olmalıdır.' }, { status: 400 });
  }

  try {
    const tenant = await resolveTenantBySlug(slug);
    const { hotelSupabase: supabase, hotelName } = tenant;

    // ── Fetch guests ─────────────────────────────────────────────────────────
    const { data: guests, error: guestError } = await supabase
      .from('inhouse_guests_v2')
      .select('id, room_number, guest_name, check_out_date, telegram_id, whatsapp_id')
      .in('id', guest_ids)
      .eq('status', 'active');

    if (guestError) {
      console.error('[send-checkout-notif] guest fetch error:', guestError.message);
      return NextResponse.json({ error: 'Misafir bilgileri alınamadı.' }, { status: 500 });
    }

    const result: SendResult = {
      total: guest_ids.length,
      by_channel: {
        telegram: { sent: 0, failed: 0 },
        whatsapp: { sent: 0, failed: 0 },
        manual: 0,
      },
      skipped_no_contact: 0,
      errors: [],
    };

    for (const guest of guests ?? []) {
      const checkoutDateFormatted = formatCheckoutDate(guest.check_out_date as string);
      const message = lateCheckoutMessage({
        guestName: guest.guest_name as string,
        checkoutDate: checkoutDateFormatted,
        hotelName: hotelName ?? 'Oteliniz',
        checkoutTime: '12:00',
      });

      const hasTelegram = !!guest.telegram_id;
      const hasWhatsapp = !!guest.whatsapp_id;

      if (!hasTelegram && !hasWhatsapp) {
        // No contact channel → insert failed row, mark skipped
        result.skipped_no_contact++;

        await supabase.from('late_checkout_notifications').insert({
          inhouse_guest_id: guest.id,
          notification_date,
          channel: 'manual',
          status: 'failed',
          error_message: 'no contact channel',
          sent_at: null,
        });
        continue;
      }

      // ── Telegram ─────────────────────────────────────────────────────────
      if (hasTelegram) {
        // Create pending row
        const { data: tgRow } = await supabase
          .from('late_checkout_notifications')
          .insert({
            inhouse_guest_id: guest.id,
            notification_date,
            channel: 'telegram',
            status: 'pending',
          })
          .select('id')
          .single();

        const tgResult = await sendTelegram({
          hotelSlug: slug,
          chatId: guest.telegram_id as number,
          message,
        });

        if (tgResult.success) {
          result.by_channel.telegram.sent++;
          if (tgRow?.id) {
            await supabase
              .from('late_checkout_notifications')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', tgRow.id);
          }
        } else {
          result.by_channel.telegram.failed++;
          result.errors.push(`Telegram ${guest.guest_name}: ${tgResult.error}`);
          if (tgRow?.id) {
            await supabase
              .from('late_checkout_notifications')
              .update({ status: 'failed', error_message: tgResult.error ?? 'unknown' })
              .eq('id', tgRow.id);
          }
        }
      }

      // ── WhatsApp / ManyChat ────────────────────────────────────────────────
      if (hasWhatsapp) {
        const { data: waRow } = await supabase
          .from('late_checkout_notifications')
          .insert({
            inhouse_guest_id: guest.id,
            notification_date,
            channel: 'whatsapp',
            status: 'pending',
          })
          .select('id')
          .single();

        const waResult = await sendManychat({
          subscriberId: guest.whatsapp_id as string,
          message,
        });

        if (waResult.success) {
          result.by_channel.whatsapp.sent++;
          if (waRow?.id) {
            await supabase
              .from('late_checkout_notifications')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', waRow.id);
          }
        } else {
          result.by_channel.whatsapp.failed++;
          result.errors.push(`WhatsApp ${guest.guest_name}: ${waResult.error}`);
          if (waRow?.id) {
            await supabase
              .from('late_checkout_notifications')
              .update({ status: 'failed', error_message: waResult.error ?? 'unknown' })
              .eq('id', waRow.id);
          }
        }
      }
    }

    console.log('[send-checkout-notif] completed:', JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası';
    console.error('[send-checkout-notif] fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
