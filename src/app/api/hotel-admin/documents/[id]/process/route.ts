/**
 * POST /api/hotel-admin/documents/[id]/process
 * 
 * Asenkron parse pipeline:
 *   1. parse_status = 'processing'
 *   2. Storage'dan dosyayı indir
 *   3. parseDocument() → ham metin
 *   4. summarizeForKnowledgeBase() → section listesi
 *   5. knowledge_sections'a insert (source_document_id set)
 *   6. parse_status = 'completed'
 *   7. Hata → parse_status = 'failed'
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
    const msg = err instanceof Error ? err.message : 'Tenant hatası.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const doc = await getDocument(tenant.hotelSupabase, id);
  if (!doc) return NextResponse.json({ error: 'Belge bulunamadı.' }, { status: 404 });

  // Yetki kontrolü
  const allowed = getAllowedDepartments(admin.role);
  if (!allowed.includes(doc.department_key)) {
    return NextResponse.json({ error: 'Bu belgeye erişim yetkiniz yok.' }, { status: 403 });
  }

  // Zaten işleniyor mu?
  if (doc.parse_status === 'processing') {
    return NextResponse.json({ error: 'Belge zaten işleniyor.' }, { status: 409 });
  }

  // Parse başlat
  await setParseStatus(tenant.hotelSupabase, id, 'processing');

  try {
    // 1) Storage'dan dosyayı indir
    const { data: fileData, error: downloadError } = await tenant.hotelSupabase.storage
      .from('hotel-documents')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Dosya indirme hatası: ${downloadError?.message ?? 'Bilinmeyen hata'}`);
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // 2) Parse
    const parseResult = await parseDocument(fileBuffer, doc.mime_type ?? 'application/octet-stream');
    if (!parseResult.ok) {
      throw new Error(parseResult.error);
    }

    const rawText = parseResult.text;

    // 3) AI summarize
    const sections = await summarizeForKnowledgeBase(rawText, doc.document_type, doc.department_key);
    if (sections.length === 0) {
      throw new Error('AI herhangi bir section üretemedi.');
    }

    // 4) knowledge_sections'a insert
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

    if (insertError) {
      throw new Error(`Section insert hatası: ${insertError.message}`);
    }

    // 5) Tamamlandı
    await setParseStatus(tenant.hotelSupabase, id, 'completed', {
      parsedContent: rawText.slice(0, 50_000), // debug için max 50k karakter
    });

    // KB cache'ini sıfırla
    invalidateSummary(tenant.hotelId);

    return NextResponse.json({
      ok: true,
      sections_created: sections.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[documents/process] id=${id} hata:`, msg);

    await setParseStatus(tenant.hotelSupabase, id, 'failed', {
      parseError: msg.slice(0, 1000),
    }).catch(() => {});

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
