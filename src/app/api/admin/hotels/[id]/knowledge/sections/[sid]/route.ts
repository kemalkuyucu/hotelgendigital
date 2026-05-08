import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { logAudit } from '@/lib/auth/audit';
import { updateSection, deleteSection } from '@/lib/knowledge/knowledge-client';
import { invalidateSummary } from '@/lib/knowledge/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/hotels/[id]/knowledge/sections/[sid]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, sid } = await params;

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
  if (typeof b.title === 'string') patch.title = b.title;
  if (typeof b.content === 'string') patch.content = b.content;
  if (typeof b.category === 'string' || b.category === null) patch.category = b.category;
  if (typeof b.display_order === 'number') patch.display_order = b.display_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'güncellenecek alan yok' }, { status: 400 });
  }

  try {
    const section = await updateSection(id, sid, patch);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.section.upsert',
      resourceType: 'knowledge_sections',
      resourceId: sid,
      hotelId: id,
      details: { patch },
    });

    return NextResponse.json({ ok: true, section });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/sections/[sid] PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/hotels/[id]/knowledge/sections/[sid]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, sid } = await params;

  try {
    await deleteSection(id, sid);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.section.delete',
      resourceType: 'knowledge_sections',
      resourceId: sid,
      hotelId: id,
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/sections/[sid] DELETE]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
