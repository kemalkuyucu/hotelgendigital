// =============================================================================
// src/app/api/admin/central-migrations/run/route.ts
// POST /api/admin/central-migrations/run
// Body: { dryRun?: boolean }
// Central DB migration'larını çalıştırır.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { runCentralMigrations } from '@/lib/migrations/central';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Yetki kontrolü
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

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
    const message = err instanceof Error ? err.message : 'Sunucu hatası.';
    console.error('[central-migrations/run] Hata:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
