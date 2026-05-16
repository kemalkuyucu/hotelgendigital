import { NextResponse } from 'next/server';
import { getSessionManager } from '@/lib/auth/manager-session';
import { getDemoHotelSupabase } from '@/lib/supabase-client';

const BUCKET = 'hotel_documents';

// DELETE — belgeyi sil (DB + Storage)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getDemoHotelSupabase();

  // Önce file_url al
  const { data: doc, error: fetchError } = await supabase
    .from('hotel_documents')
    .select('file_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

  // Storage'dan sil (varsa)
  if (doc.file_url) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.file_url]);
    // Storage hatasını yutma, log'la ama DB silmeye devam et
    if (storageError) console.error('Storage delete error:', storageError);
  }

  // DB'den sil
  const { error: deleteError } = await supabase
    .from('hotel_documents')
    .delete()
    .eq('id', id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH — belgenin metadata'sını güncelle (delivery_policy, display_text, is_active)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const supabase = getDemoHotelSupabase();

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.delivery_policy === 'string') {
    if (!['manual_only', 'auto_file', 'auto_text'].includes(body.delivery_policy)) {
      return NextResponse.json({ error: 'Geçersiz iletim politikası' }, { status: 400 });
    }
    updates.delivery_policy = body.delivery_policy;
  }
  if (typeof body.display_text === 'string') updates.display_text = body.display_text;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('hotel_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
