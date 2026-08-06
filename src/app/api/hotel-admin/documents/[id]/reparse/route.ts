/**
 * POST /api/hotel-admin/documents/[id]/reparse
 * 
 * parse_status='failed' olan belgeleri yeniden parse eder.
 * /process endpoint'ini yeniden çağırmakla eşdeğer — ama failed guard'ı daha toleranslı.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import { getDocument, setParseStatus } from '@/lib/documents/document-client';
import { parseDocument } from '@/lib/documents/parser';
import { summarizeForKnowledgeBase } from '@/lib/documents/ai-summarizer';
import { invalidateSummary } from '@/lib/knowledge/cache';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { id } = await params;

  let tenant: Awaited<ReturnType<typeof resolveTenantBySlug>>;
  try {
    tenant = await resolveTenantBySlug(admin.hotel_slug);
  } catch (err) {
    console.error('[documents/reparse]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }

  const doc = await getDocument(tenant.hotelSupabase, id);
  if (!doc) return NextResponse.json({ error: 'Belge bulunamadı.' }, { status: 404 });

  const allowed = getAllowedDepartments(admin.role);
  if (!allowed.includes(doc.department_key)) {
    return NextResponse.json({ error: 'Bu belgeye erişim yetkiniz yok.' }, { status: 403 });
  }

  if (doc.parse_status === 'processing') {
    return NextResponse.json({ error: 'Belge zaten işleniyor.' }, { status: 409 });
  }

  // Önceki failed section'ları temizle
  await tenant.hotelSupabase
    .from('knowledge_sections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('source_document_id', id);

  await setParseStatus(tenant.hotelSupabase, id, 'processing', { parseError: undefined });

  try {
    const { data: fileData, error: downloadError } = await tenant.hotelSupabase.storage
      .from('hotel-documents')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Dosya indirme hatası: ${downloadError?.message ?? 'Bilinmeyen hata'}`);
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const parseResult = await parseDocument(fileBuffer, doc.mime_type ?? 'application/octet-stream');
    if (!parseResult.ok) throw new Error(parseResult.error);

    const sections = await summarizeForKnowledgeBase(parseResult.text, doc.document_type, doc.department_key);
    if (sections.length === 0) throw new Error('AI herhangi bir section üretemedi.');

    const sectionRows = sections.map((s) => ({
      title: s.title,
      content: s.content,
      category: doc.department_key,
      display_order: 0,
      is_active: true,
      source_document_id: id,
    }));

    const { error: insertError } = await tenant.hotelSupabase
      .from('knowledge_sections')
      .insert(sectionRows);

    if (insertError) throw new Error(`Section insert hatası: ${insertError.message}`);

    await setParseStatus(tenant.hotelSupabase, id, 'completed', {
      parsedContent: parseResult.text.slice(0, 50_000),
    });

    invalidateSummary(tenant.hotelId);

    return NextResponse.json({ ok: true, sections_created: sections.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[documents/reparse] id=${id} hata:`, msg);
    await setParseStatus(tenant.hotelSupabase, id, 'failed', { parseError: msg.slice(0, 1000) }).catch(() => {});
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
