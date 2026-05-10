/**
 * DELETE /api/hotel-admin/documents/[id]  → soft delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import { getDocument, deactivateDocumentAndSections } from '@/lib/documents/document-client';
import { invalidateSummary } from '@/lib/knowledge/cache';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id } = await params;

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug);
    const doc = await getDocument(tenant.hotelSupabase, id);

    if (!doc) return NextResponse.json({ error: 'Belge bulunamadı.' }, { status: 404 });

    // Yetki kontrolü
    const allowed = getAllowedDepartments(admin.role);
    if (!allowed.includes(doc.department_key)) {
      return NextResponse.json({ error: 'Bu belgeyi silme yetkiniz yok.' }, { status: 403 });
    }

    await deactivateDocumentAndSections(tenant.hotelSupabase, id);

    // KB cache'ini sıfırla
    invalidateSummary(tenant.hotelId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sunucu hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
