// PATCH  /api/admin/safety-rules/[id]  → kısmi güncelleme
// DELETE /api/admin/safety-rules/[id]  → hard delete

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { getCentralSupabase } from '@/lib/supabase-client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id } = await params;

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // Ne gelirse onu set et — sadece mevcut alanları al
    const patch: Record<string, unknown> = {};
    if ('title' in b) patch.title = b.title;
    if ('category' in b) patch.category = b.category;
    if ('description' in b) patch.description = b.description;
    if ('ai_instruction' in b) patch.ai_instruction = b.ai_instruction;
    if ('priority' in b) patch.priority = b.priority;
    if ('is_active' in b) patch.is_active = b.is_active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 });
    }

    const supabase = getCentralSupabase();
    const { data, error } = await supabase
      .from('system_safety_responses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ rule: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id } = await params;

  const supabase = getCentralSupabase();
  const { error } = await supabase
    .from('system_safety_responses')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
