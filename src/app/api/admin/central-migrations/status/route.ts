// =============================================================================
// src/app/api/admin/central-migrations/status/route.ts
// GET /api/admin/central-migrations/status
// Central DB migration durumunu döndürür.
// =============================================================================

import { NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { getCentralMigrationStatus } from '@/lib/migrations/central';

export async function GET(): Promise<NextResponse> {
  // Yetki kontrolü
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  try {
    const status = await getCentralMigrationStatus();
    return NextResponse.json({ status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatası.';
    console.error('[central-migrations/status] Hata:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
