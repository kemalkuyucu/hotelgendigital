/**
 * Module 17.c - ManyChat (WhatsApp/Instagram) Webhook
 * POST /api/webhooks/manychat/[hotelSlug]
 *
 * Payload: { subscriber_id, phone, first_name, last_name, ... }
 * Flow:
 *   1. Check conversations table for existing whatsapp_id link
 *   2. If linked → continue normal flow (future AI integration)
 *   3. If not linked → ask for room number
 *   4. On room number reply → lookup inhouse_guests_v2, link or log pending_guest_match
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { timingSafeEqualStr } from '@/lib/telegram/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Supabase client for demo hotel ───────────────────────────────────────────

function getDemoHotelClient() {
  const url = process.env.DEMO_HOTEL_SUPABASE_URL;
  const key = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── ManyChat response helper ──────────────────────────────────────────────────

function manychatTextResponse(text: string) {
  return NextResponse.json({
    version: 'v2',
    content: {
      messages: [{ type: 'text', text }],
    },
  });
}

// ── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hotelSlug: string }> },
): Promise<NextResponse> {
  const { hotelSlug } = await params;

  // Verify ManyChat webhook secret (AUDIT S4: fail-closed in prod + S8: constant-time)
  const webhookSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Prod'da secret zorunlu → fail-closed. Dev'de uyar ve devam et.
    if (process.env.NODE_ENV === 'production') {
      console.error(`[manychat] MANYCHAT_WEBHOOK_SECRET tanımlı değil — fail-closed 401 (slug: ${hotelSlug})`);
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.warn(`[manychat] MANYCHAT_WEBHOOK_SECRET yok — dev modunda auth atlanıyor (slug: ${hotelSlug})`);
  } else {
    const sig = req.headers.get('x-manychat-signature');
    if (!timingSafeEqualStr(sig, webhookSecret)) {
      console.warn(`[manychat] Invalid webhook secret for slug: ${hotelSlug}`);
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    return NextResponse.json({ ok: false, error: 'Hotel not found' }, { status: 404 });
  }

  const supa = hotelSlug === 'demo-hotel' ? getDemoHotelClient() : null;
  if (!supa) {
    console.error(`[manychat] No DB client for: ${hotelSlug}`);
    return NextResponse.json({ ok: false, error: 'No DB client' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const subscriberId: string | null = payload?.subscriber_id ?? payload?.id ?? null;
  const incomingText: string = payload?.text ?? payload?.message ?? '';
  const firstName: string = payload?.first_name ?? '';
  const lastName: string = payload?.last_name ?? '';
  const guestDisplayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Misafir';

  if (!subscriberId) {
    console.warn('[manychat] Missing subscriber_id in payload');
    return manychatTextResponse('Üzgünüz, bir hata oluştu. Lütfen tekrar deneyin.');
  }

  console.log(`[manychat] Incoming: subscriberId=${subscriberId} text="${incomingText.slice(0, 60)}"`);

  // ── Check if whatsapp_id already linked in inhouse_guests_v2 ────────────────
  const { data: linkedGuest } = await supa
    .from('inhouse_guests_v2')
    .select('id, guest_name, room_number, status')
    .eq('whatsapp_id', subscriberId)
    .eq('status', 'active')
    .maybeSingle();

  if (linkedGuest) {
    // Already linked → acknowledge (AI integration future expansion)
    console.log(`[manychat] Already linked → guest_id=${linkedGuest.id} room=${linkedGuest.room_number}`);
    return manychatTextResponse(
      `Merhaba ${linkedGuest.guest_name}! Size nasıl yardımcı olabilirim? Talebinizi yazabilirsiniz, resepsiyonumuza iletilecektir.`,
    );
  }

  // ── Check if this looks like a room number entry ─────────────────────────────
  const roomAttempt = incomingText.trim().replace(/[^0-9a-zA-Z]/g, '');
  const looksLikeRoom = /^\d{1,4}[a-zA-Z]?$/.test(roomAttempt);

  if (looksLikeRoom && roomAttempt.length > 0) {
    // Try to find matching room
    const { data: roomMatches } = await supa
      .from('inhouse_guests_v2')
      .select('id, guest_name, room_number')
      .eq('room_number', roomAttempt)
      .eq('status', 'active');

    if (!roomMatches || roomMatches.length === 0) {
      // No match → log pending_guest_match, notify reception
      await supa.from('pending_guest_matches').insert({
        whatsapp_id: subscriberId,
        platform: 'whatsapp',
        attempted_room_number: roomAttempt,
        message_excerpt: incomingText.slice(0, 200),
      });

      console.log(`[manychat] No room match for room=${roomAttempt}, logged pending_guest_match`);

      return manychatTextResponse(
        'Belirtilen oda numarasında kayıt bulunamadı. Ondan emin olmak için resepsiyonu bilgilendiriyorum, lütfen bekleyin.',
      );
    }

    if (roomMatches.length === 1) {
      const matched = roomMatches[0];

      // Link whatsapp_id
      await supa
        .from('inhouse_guests_v2')
        .update({ whatsapp_id: subscriberId })
        .eq('id', matched.id);

      console.log(`[manychat] Linked whatsapp_id=${subscriberId} → guest_id=${matched.id} room=${matched.room_number}`);

      return manychatTextResponse(
        `Tesekkurler ${matched.guest_name}, sizin icin hazirim. Nasil yardimci olabilirim?`,
      );
    }

    // Multiple matches → ask for name
    return manychatTextResponse(
      'Birden fazla kayıt görüldü. Lütfen adınızı ve soyadınızı yazınız:',
    );
  }

  // ── Default: not linked, not a room number → greet + ask for room ────────────
  return manychatTextResponse(
    `Merhaba ${guestDisplayName}! ${hotel.name} asistanınım. Size yardımcı olabilmem için lütfen oda numaranızı yazınız.`,
  );
}
