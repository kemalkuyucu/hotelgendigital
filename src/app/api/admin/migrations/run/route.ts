// =============================================================================
// src/app/api/admin/migrations/run/route.ts
// POST /api/admin/migrations/run
// Body: { hotelSlug: string, dryRun?: boolean, includeDestructive?: boolean }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { runMigrations } from '@/lib/migrations';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Yetki kontrolü — DDL tetikler, super_admin zorunlu (AUDIT S6)
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  // Body parse
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const hotelSlug = typeof b.hotelSlug === 'string' ? b.hotelSlug.trim() : '';
  const dryRun = b.dryRun === true;
  const includeDestructive = b.includeDestructive === true;

  if (!hotelSlug) {
    return NextResponse.json({ error: 'hotelSlug zorunludur.' }, { status: 400 });
  }

  try {
    const result = await runMigrations({
      hotelSlug,
      dryRun,
      includeDestructive,
      appliedBy: `admin:${admin.username}`,
    });

    return NextResponse.json({
      success: !result.failed,
      result,
    });
  } catch (err) {
    console.error('[migrations/run] Hata:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
