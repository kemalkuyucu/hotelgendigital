import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { logAudit } from '@/lib/auth/audit';
import { listSections, createSection } from '@/lib/knowledge/knowledge-client';
import { invalidateSummary } from '@/lib/knowledge/cache';
import type { KnowledgeSectionInput } from '@/lib/knowledge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/hotels/[id]/knowledge/sections
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const sections = await listSections(id);
    return NextResponse.json({ ok: true, sections });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/sections GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/hotels/[id]/knowledge/sections
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).title !== 'string' ||
    typeof (body as Record<string, unknown>).content !== 'string'
  ) {
    return NextResponse.json({ error: 'title ve content zorunlu' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const sectionInput: KnowledgeSectionInput = {
    title: b.title as string,
    content: b.content as string,
    category: typeof b.category === 'string' ? b.category : null,
    display_order: typeof b.display_order === 'number' ? b.display_order : 0,
  };

  try {
    const section = await createSection(id, sectionInput);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.section.upsert',
      resourceType: 'knowledge_sections',
      resourceId: section.id,
      hotelId: id,
      details: { title: section.title },
    });

    return NextResponse.json({ ok: true, section }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/sections POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
