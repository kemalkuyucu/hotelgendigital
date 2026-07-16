import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { logAudit } from '@/lib/auth/audit';
import { updateFact, deleteFact } from '@/lib/knowledge/knowledge-client';
import { invalidateSummary } from '@/lib/knowledge/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/hotels/[id]/knowledge/facts/[fid]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  const { id, fid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'geçersiz gövde' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.fact_value === 'string') patch.fact_value = b.fact_value;
  if (typeof b.fact_label === 'string') patch.fact_label = b.fact_label;
  // Kategori SERBEST TEXT: body'de varsa non-empty string sart; sessizce dusurme YOK.
  if ('category' in b) {
    if (typeof b.category === 'string' && b.category.trim() !== '') {
      patch.category = b.category.trim();
    } else {
      return NextResponse.json({ error: 'category bos olamaz' }, { status: 400 });
    }
  }
  if (typeof b.display_order === 'number') patch.display_order = b.display_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'güncellenecek alan yok' }, { status: 400 });
  }

  try {
    const fact = await updateFact(id, fid, patch);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.fact.upsert',
      resourceType: 'hotel_facts',
      resourceId: fid,
      hotelId: id,
      details: { patch },
    });

    return NextResponse.json({ ok: true, fact });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/facts/[fid] PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/hotels/[id]/knowledge/facts/[fid]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fid: string }> }
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  const { id, fid } = await params;

  try {
    await deleteFact(id, fid);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.fact.delete',
      resourceType: 'hotel_facts',
      resourceId: fid,
      hotelId: id,
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/facts/[fid] DELETE]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
