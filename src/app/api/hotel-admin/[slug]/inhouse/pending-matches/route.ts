/**
 * Module 17.c - Pending Guest Matches API
 * GET  /api/hotel-admin/[slug]/inhouse/pending-matches  → list unresolved
 * PATCH /api/hotel-admin/[slug]/inhouse/pending-matches → resolve + trigger bot retry
 *
 * Auth: hotel_owner | front_office_manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

export const runtime = 'nodejs';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

// ── GET: list unresolved pending matches ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role))
    return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok.' }, { status: 403 });

  const { slug } = await params;
  if (slug !== admin.hotel_slug)
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 });

  try {
    const { hotelSupabase: supabase } = await resolveTenantBySlug(slug);

    const { data, error } = await supabase
      .from('pending_guest_matches')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[pending-matches] GET error:', error.message);
      return NextResponse.json({ error: 'Veriler alınamadı.' }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [], count: (data ?? []).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── PATCH: resolve a pending match + optionally trigger bot retry ─────────────

interface PatchBody {
  id: string;
  send_retry_message?: boolean;  // if true → send a Telegram/WhatsApp retry prompt
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(admin.role))
    return NextResponse.json({ error: 'Bu işlemi yapma yetkiniz yok.' }, { status: 403 });

  const { slug } = await params;
  if (slug !== admin.hotel_slug)
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id alanı zorunludur.' }, { status: 400 });
  }

  try {
    const { hotelSupabase: supabase } = await resolveTenantBySlug(slug);

    // Fetch the match record to get platform + contact info for retry
    const { data: match, error: fetchErr } = await supabase
      .from('pending_guest_matches')
      .select('*')
      .eq('id', body.id)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 });
    }

    // Mark as resolved
    const { error: updateErr } = await supabase
      .from('pending_guest_matches')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: admin.sub,
      })
      .eq('id', body.id);

    if (updateErr) {
      console.error('[pending-matches] PATCH resolve error:', updateErr.message);
      return NextResponse.json({ error: 'Kayıt güncellenemedi.' }, { status: 500 });
    }

    // Send retry message to guest if requested
    if (body.send_retry_message !== false && match.platform === 'telegram' && match.telegram_id) {
      const retryMsg =
        'Oda numaranizi tekrar yazmanizi rica ediyoruz, kaydiniz guncellendi.';

      const botToken =
        slug === 'demo-hotel'
          ? process.env.TELEGRAM_BOT_TOKEN_DEMO
          : null;

      if (botToken) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: match.telegram_id, text: retryMsg }),
          });
          console.log(`[pending-matches] Retry message sent → telegramId=${match.telegram_id}`);
        } catch (err) {
          console.error('[pending-matches] Retry send failed:', err);
        }
      }
    }

    console.log(`[pending-matches] Resolved id=${body.id} by userId=${admin.sub}`);
    return NextResponse.json({ ok: true, id: body.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
