// =============================================================================
// src/app/api/admin/central-migrations/run/route.ts
// POST /api/admin/central-migrations/run
// Body: { dryRun?: boolean }
// Central DB migration'larını çalıştırır.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { runCentralMigrations } from '@/lib/migrations/central';

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
    body = {};
  }

  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const dryRun = b.dryRun === true;

  try {
    const result = await runCentralMigrations({
      dryRun,
      appliedBy: `admin:${admin.username}`,
    });

    return NextResponse.json({
      success: !result.failed,
      result,
    });
  } catch (err) {
    console.error('[central-migrations/run] Hata:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
