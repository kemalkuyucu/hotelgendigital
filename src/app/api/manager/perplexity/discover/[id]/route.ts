import { NextResponse } from 'next/server';
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getDemoHotelSupabase } from '@/lib/supabase-client';

/**
 * DELETE — Cache kaydını sil
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = session.hotel_slug
    ? (await resolveTenantBySlug(session.hotel_slug)).hotelSupabase
    : getDemoHotelSupabase();

  const { error } = await supabase
    .from('perplexity_discoveries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[perplexity-discover]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/**
 * PATCH — is_pinned güncelle (pin/unpin)
 * Body: { is_pinned: boolean }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: { is_pinned?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  if (typeof body.is_pinned !== 'boolean') {
    return NextResponse.json(
      { error: 'is_pinned boolean olmalı' },
      { status: 400 },
    );
  }

  const supabase = session.hotel_slug
    ? (await resolveTenantBySlug(session.hotel_slug)).hotelSupabase
    : getDemoHotelSupabase();
  const { data, error } = await supabase
    .from('perplexity_discoveries')
    .update({ is_pinned: body.is_pinned })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[perplexity-discover]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
  return NextResponse.json({ discovery: data });
}
