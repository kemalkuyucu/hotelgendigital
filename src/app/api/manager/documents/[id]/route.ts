import { NextResponse } from 'next/server';
import { getSessionManager } from '@/lib/auth/manager-session';
import { getDemoHotelSupabase } from '@/lib/supabase-client';
import { randomUUID } from 'crypto';

const BUCKET = 'hotel_documents';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const VALID_DOCUMENT_TYPES = [
  'concept', 'fact_sheet', 'price_list', 'day_use', 'map', 'iban',
  'bar_menu', 'room_service_menu', 'spa_services', 'a_la_carte',
  'wifi_info', 'dnd_list', 'agency_list', 'general_rules',
  'taxi_info', 'parking_info', 'other',
];
const VALID_LANGUAGES = ['tr', 'en', 'ru', 'de', 'fr', 'ar', 'ja'];
const VALID_DEPARTMENTS = [
  'front_office', 'housekeeping', 'technical', 'fb',
  'guest_relation', 'spa', 'animation',
];
const VALID_POLICIES = ['manual_only', 'auto_file', 'auto_text'];

// DELETE — belgeyi sil (DB + Storage)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getDemoHotelSupabase();

  // Önce file_url al
  const { data: doc, error: fetchError } = await supabase
    .from('hotel_documents')
    .select('file_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

  // Storage'dan sil (varsa)
  if (doc.file_url) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.file_url]);
    // Storage hatasını yutma, log'la ama DB silmeye devam et
    if (storageError) console.error('Storage delete error:', storageError);
  }

  // DB'den sil
  const { error: deleteError } = await supabase
    .from('hotel_documents')
    .delete()
    .eq('id', id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH — tam güncelleme (multipart/form-data; dosya opsiyonel)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionManager();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = getDemoHotelSupabase();

    // Mevcut kaydı oku
    const { data: existing, error: fetchError } = await supabase
      .from('hotel_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

    // multipart/form-data oku
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const document_type = (formData.get('document_type') as string | null) ?? existing.document_type;
    const language = (formData.get('language') as string | null) ?? existing.language;
    const department_code_raw = formData.get('department_code') as string | null;
    // Boş string = temizle, null = değiştirme
    const department_code =
      department_code_raw !== null ? (department_code_raw || null) : existing.department_code;
    const delivery_policy = (formData.get('delivery_policy') as string | null) ?? existing.delivery_policy;
    const display_text = formData.get('display_text') as string | null;

    const structured_data_raw = formData.get('structured_data') as string | null;
    let structured_data: unknown = existing.structured_data;
    if (structured_data_raw !== null) {
      if (structured_data_raw === '') {
        structured_data = null;
      } else {
        try {
          structured_data = JSON.parse(structured_data_raw);
        } catch {
          return NextResponse.json({ error: 'Geçersiz yapısal veri' }, { status: 400 });
        }
      }
    }

    // --- Validation (POST ile aynı kurallar) ---
    if (!VALID_DOCUMENT_TYPES.includes(document_type)) {
      return NextResponse.json({ error: 'Geçersiz belge türü' }, { status: 400 });
    }
    if (!VALID_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: 'Geçersiz dil' }, { status: 400 });
    }
    if (department_code && !VALID_DEPARTMENTS.includes(department_code)) {
      return NextResponse.json({ error: 'Geçersiz departman' }, { status: 400 });
    }
    if (!VALID_POLICIES.includes(delivery_policy)) {
      return NextResponse.json({ error: 'Geçersiz iletim politikası' }, { status: 400 });
    }

    const isIbanStructured = document_type === 'iban' && structured_data !== null;
    const effectiveDisplayText = display_text ?? existing.display_text;
    if (
      delivery_policy === 'auto_text' &&
      !isIbanStructured &&
      (!effectiveDisplayText || String(effectiveDisplayText).trim().length === 0)
    ) {
      return NextResponse.json({ error: 'Yazılı cevap modu için metin girilmelidir' }, { status: 400 });
    }

    // auto_text modunda dosya zorunlu DEĞİL; PATCH'te zaten opsiyonel
    if (file) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Dosya 10 MB sınırını aşıyor' }, { status: 400 });
      }
      if (!ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json({ error: 'Geçersiz dosya türü (PDF/JPG/PNG/WEBP)' }, { status: 400 });
      }
    }

    // --- Dosya işleme ---
    let file_url: string | null = existing.file_url;
    let file_name: string | null = existing.file_name;
    let file_size_bytes: number | null = existing.file_size_bytes;
    let mime_type: string | null = existing.mime_type;

    if (file) {
      // 1) Eski dosyayı Storage'dan sil
      if (existing.file_url) {
        const { error: storageDelErr } = await supabase.storage
          .from(BUCKET)
          .remove([existing.file_url]);
        if (storageDelErr) console.error('Eski dosya silinemedi:', storageDelErr);
      }

      // 2) Yeni dosyayı yükle
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${document_type}/${randomUUID()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        return NextResponse.json({ error: `Yükleme hatası: ${uploadError.message}` }, { status: 500 });
      }

      file_url = storagePath;
      file_name = file.name;
      file_size_bytes = file.size;
      mime_type = file.type;
    }

    // --- DB Update ---
    const { data, error: updateError } = await supabase
      .from('hotel_documents')
      .update({
        document_type,
        language,
        department_code,
        delivery_policy,
        display_text: delivery_policy === 'auto_text' ? (effectiveDisplayText ?? null) : null,
        structured_data,
        file_url,
        file_name,
        file_size_bytes,
        mime_type,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ document: data });

  } catch (err) {
    console.error('PATCH /documents/[id] error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
