/**
 * POST /api/hotel-admin/documents/upload
 * GET  /api/hotel-admin/documents?department=X
 *
 * Upload: multipart/form-data
 *   - file: File (required)
 *   - title: string (required)
 *   - document_type: DocumentType (required)
 *   - notes: string (optional)
 *
 * Yetki: hotel_owner → hepsi, {dept}_manager → sadece kendi departmanı
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getAllowedDepartments } from '@/lib/hotel-admin/types';
import type { DepartmentKey } from '@/lib/hotel-admin/types';
import { createDocument, listDocuments } from '@/lib/documents/document-client';
import type { DocumentType } from '@/lib/documents/document-client';
import { invalidateSummary } from '@/lib/knowledge/cache';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'fact_sheet', 'concept', 'price_list', 'menu',
  'reservation', 'allergen', 'schedule', 'custom',
];

// ---------------------------------------------------------------------------
// GET — Belge listesi
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const department = searchParams.get('department') as DepartmentKey | null;

  const allowed = getAllowedDepartments(admin.role);
  if (department && !allowed.includes(department)) {
    return NextResponse.json({ error: 'Bu departmana erişim yetkiniz yok.' }, { status: 403 });
  }

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug);
    const docs = await listDocuments(tenant.hotelSupabase, department ?? undefined);
    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error('[hotel-admin-documents]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Dosya yükle
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Form verisi okunamadı.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string | null)?.trim();
  const documentType = formData.get('document_type') as DocumentType | null;
  const department = formData.get('department') as DepartmentKey | null;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;

  // --- Validation ---
  if (!file) return NextResponse.json({ error: 'Dosya zorunlu.' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Başlık zorunlu.' }, { status: 400 });
  if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
    return NextResponse.json({ error: 'Geçersiz belge tipi.' }, { status: 400 });
  }
  if (!department) return NextResponse.json({ error: 'Departman zorunlu.' }, { status: 400 });

  // Yetki kontrolü
  const allowed = getAllowedDepartments(admin.role);
  if (!allowed.includes(department)) {
    return NextResponse.json({ error: 'Bu departmana belge ekleme yetkiniz yok.' }, { status: 403 });
  }

  // MIME tip kontrolü
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Desteklenmeyen dosya tipi: ${file.type}. PDF, Excel veya Word yükleyin.` },
      { status: 400 }
    );
  }

  // Boyut kontrolü
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Dosya 25 MB limiti aşıyor.' }, { status: 400 });
  }

  try {
    const tenant = await resolveTenantBySlug(admin.hotel_slug);

    // Supabase Storage'a yükle
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${tenant.hotelId}/${department}/${timestamp}_${safeName}`;

    const { error: storageError } = await tenant.hotelSupabase.storage
      .from('hotel-documents')
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        { error: `Dosya yükleme hatası: ${storageError.message}` },
        { status: 500 }
      );
    }

    // DB kaydı oluştur
    const doc = await createDocument(tenant.hotelSupabase, {
      department_key: department,
      document_type: documentType,
      title,
      file_name: file.name,
      file_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type,
      uploaded_by_user_id: admin.sub,
      notes,
    });

    // Cache'i geçersiz kıl — bot bir sonraki mesajda taze KB çeker
    invalidateSummary(tenant.hotelId);

    return NextResponse.json({ document_id: doc.id, status: 'pending' }, { status: 201 });
  } catch (err) {
    console.error('[hotel-admin-documents]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
