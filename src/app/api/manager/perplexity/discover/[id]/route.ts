import { NextResponse } from 'next/server';
import { getSessionManager } from '@/lib/auth/manager-session';
import { getDemoHotelSupabase } from '@/lib/supabase-client';

/**
 * DELETE — Cache kaydını sil
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getDemoHotelSupabase();

  const { error } = await supabase
    .from('perplexity_discoveries')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const session = await getSessionManager();
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

  const supabase = getDemoHotelSupabase();
  const { data, error } = await supabase
    .from('perplexity_discoveries')
    .update({ is_pinned: body.is_pinned })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ discovery: data });
}
