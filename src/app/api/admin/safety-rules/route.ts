// GET  /api/admin/safety-rules  → tüm kuralları listele
// POST /api/admin/safety-rules  → yeni kural ekle

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getCentralSupabase } from '@/lib/supabase-client';

export async function GET(): Promise<NextResponse> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const supabase = getCentralSupabase();
  const { data, error } = await supabase
    .from('system_safety_responses')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // Zorunlu alanlar
    if (typeof b.title !== 'string' || !b.title.trim()) {
      return NextResponse.json({ error: 'title zorunludur.' }, { status: 400 });
    }
    if (typeof b.ai_instruction !== 'string' || !b.ai_instruction.trim()) {
      return NextResponse.json({ error: 'ai_instruction zorunludur.' }, { status: 400 });
    }

    // Priority 0-100 arası
    const priority = typeof b.priority === 'number' ? b.priority : 50;
    if (priority < 0 || priority > 100) {
      return NextResponse.json({ error: 'priority 0-100 arasında olmalıdır.' }, { status: 400 });
    }

    const supabase = getCentralSupabase();

    // Category unique kontrolü
    if (typeof b.category === 'string' && b.category.trim()) {
      const { data: existing } = await supabase
        .from('system_safety_responses')
        .select('id')
        .eq('category', b.category.trim())
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: 'Bu kategori zaten mevcut. Lütfen farklı bir kategori kullanın.' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('system_safety_responses')
      .insert({
        category: typeof b.category === 'string' ? b.category.trim() || null : null,
        title: b.title.trim(),
        description: typeof b.description === 'string' ? b.description.trim() || null : null,
        ai_instruction: b.ai_instruction.trim(),
        priority,
        is_active: typeof b.is_active === 'boolean' ? b.is_active : true,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Bu kategori zaten mevcut.' },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
