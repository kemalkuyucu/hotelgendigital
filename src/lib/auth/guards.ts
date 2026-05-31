// =============================================================================
// src/lib/auth/guards.ts
// AUDIT S3+S6 — Ayrıcalıklı admin route'ları için ortak super_admin guard'ı.
//
// Yalnızca getSessionAdmin() ile korunan ama global/tenant yazımı yapan
// route'lar (admin-users, safety-rules, knowledge facts/sections,
// migrations/run, central-migrations/run) bu guard'ı kullanır.
//
// Kullanım:
//   const guard = await requireSuperAdmin();
//   if (!guard.ok) return guard.response;
//   const admin = guard.admin;
// =============================================================================

import { NextResponse } from 'next/server';
import { getSessionAdmin } from './session';

type SessionAdmin = NonNullable<Awaited<ReturnType<typeof getSessionAdmin>>>;

export type SuperAdminGuard =
  | { ok: true; admin: SessionAdmin }
  | { ok: false; response: NextResponse };

export async function requireSuperAdmin(): Promise<SuperAdminGuard> {
  const admin = await getSessionAdmin();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 }) };
  }
  if (admin.role !== 'super_admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Bu işlem için super_admin yetkisi gerekli.' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, admin };
}
