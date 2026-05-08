import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { logAudit } from '@/lib/auth/audit';
import { listFacts, upsertFact } from '@/lib/knowledge/knowledge-client';
import { invalidateSummary } from '@/lib/knowledge/cache';
import { isFactCategory } from '@/lib/knowledge/types';
import type { HotelFactInput } from '@/lib/knowledge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/hotels/[id]/knowledge/facts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const facts = await listFacts(id);
    return NextResponse.json({ ok: true, facts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/facts GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/hotels/[id]/knowledge/facts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    typeof (body as Record<string, unknown>).fact_key !== 'string' ||
    typeof (body as Record<string, unknown>).fact_value !== 'string' ||
    typeof (body as Record<string, unknown>).fact_label !== 'string' ||
    !isFactCategory((body as Record<string, unknown>).category)
  ) {
    return NextResponse.json({ error: 'fact_key, fact_value, fact_label ve geçerli category zorunlu' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const factInput: HotelFactInput = {
    fact_key: b.fact_key as string,
    fact_value: b.fact_value as string,
    fact_label: b.fact_label as string,
    category: b.category as HotelFactInput['category'],
    display_order: typeof b.display_order === 'number' ? b.display_order : 0,
  };

  try {
    const fact = await upsertFact(id, factInput);
    invalidateSummary(id);

    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'knowledge.fact.upsert',
      resourceType: 'hotel_facts',
      resourceId: fact.id,
      hotelId: id,
      details: { fact_key: fact.fact_key, category: fact.category },
    });

    return NextResponse.json({ ok: true, fact }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[knowledge/facts POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
