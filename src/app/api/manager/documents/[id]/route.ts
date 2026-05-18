import { NextResponse } from 'next/server';
import { getSessionManager } from '@/lib/auth/manager-session';
import { getDemoHotelSupabase } from '@/lib/supabase-client';

const BUCKET = 'hotel_documents';

// presign endpoint'inden dönen path formatı: uploads/<uuid>-<filename>
const FILE_URL_REGEX = /^uploads\/[a-f0-9\-]+-[^/]+$/i;

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
const VALID_POLICIES = ['manual', 'auto_file', 'auto_text'];

// ──────────────────────────────────────────────────────────
// DELETE — belgeyi sil (DB + Storage)
// ──────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────
// PATCH — kısmi güncelleme (JSON body; tüm alanlar opsiyonel)
//         Yeni dosya geldiyse (file_url farklıysa) eskiyi Storage'dan sil.
//         Dosya yükleme YOK — dosya önceden presign üzerinden yüklenmiş olmalı.
// ──────────────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth ──
    const session = await getSessionManager();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = getDemoHotelSupabase();

    // ── Mevcut kaydı oku ──
    const { data: existing, error: fetchError } = await supabase
      .from('hotel_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

    // ── JSON parse ──
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Geçersiz JSON gövdesi' }, { status: 400 });
    }

    // ── Body'den gelen alanları çıkar (hepsi opsiyonel) ──
    const document_type   = body.document_type   as string | undefined;
    const language        = body.language        as string | undefined;
    const department      = body.department      as string | undefined;
    const delivery_policy = body.delivery_policy as string | undefined;
    const display_text    = body.display_text    as string | null | undefined;
    const structured_data = body.structured_data as object | null | undefined;
    const file_url        = body.file_url        as string | null | undefined;
    const file_name       = body.file_name       as string | null | undefined;
    const file_size_bytes = body.file_size_bytes as number | null | undefined;
    const file_mime       = body.file_mime       as string | null | undefined;

    // Efektif değerler — body yoksa mevcut kayıt korunur
    const eff_document_type   = document_type   ?? existing.document_type;
    const eff_language        = language        ?? existing.language;
    const eff_delivery_policy = delivery_policy ?? existing.delivery_policy;
    const eff_display_text    = display_text    !== undefined ? display_text    : existing.display_text;
    const eff_structured_data = structured_data !== undefined ? structured_data : existing.structured_data;

    // department: undefined → değiştirme; null/string → güncelle
    const eff_department_code =
      department !== undefined ? (department || null) : existing.department_code;

    // ── Enum validasyonları ──
    if (!VALID_DOCUMENT_TYPES.includes(eff_document_type)) {
      return NextResponse.json({ error: 'Geçersiz belge türü' }, { status: 400 });
    }
    if (!VALID_LANGUAGES.includes(eff_language)) {
      return NextResponse.json({ error: 'Geçersiz dil' }, { status: 400 });
    }
    if (eff_department_code && !VALID_DEPARTMENTS.includes(eff_department_code)) {
      return NextResponse.json({ error: 'Geçersiz departman' }, { status: 400 });
    }
    if (!VALID_POLICIES.includes(eff_delivery_policy)) {
      return NextResponse.json({ error: 'Geçersiz iletim politikası' }, { status: 400 });
    }

    // ── delivery_policy'e göre alan validasyonları ──
    const isIbanStructured = eff_document_type === 'iban' && eff_structured_data != null;

    if (eff_delivery_policy === 'auto_text') {
      if (!isIbanStructured && (!eff_display_text || String(eff_display_text).trim().length === 0)) {
        return NextResponse.json(
          { error: 'Yazılı cevap modu için metin girilmelidir' },
          { status: 400 }
        );
      }
    }

    // ── file_url format validasyonu (presign path kontrolü) ──
    if (file_url != null && file_url !== '') {
      if (!FILE_URL_REGEX.test(file_url)) {
        return NextResponse.json(
          { error: 'file_url geçersiz format. Beklenen: uploads/<uuid>-<dosyaadı>' },
          { status: 400 }
        );
      }
    }

    // ── Yeni file_url geldiyse ve eskiden farklıysa → eski dosyayı Storage'dan sil ──
    //    (satır 151-158 — eski multipart upload yerine geçen mantık)
    const incomingFileUrl = file_url !== undefined ? file_url : undefined;
    const isNewFile =
      incomingFileUrl !== undefined &&
      incomingFileUrl !== null &&
      incomingFileUrl !== '' &&
      incomingFileUrl !== existing.file_url;

    if (isNewFile && existing.file_url) {
      // ← Eski dosya silme: satır 153-158 (eski multipart mantığının karşılığı)
      const { error: storageDelErr } = await supabase.storage
        .from(BUCKET)
        .remove([existing.file_url]);
      if (storageDelErr) console.error('Eski dosya silinemedi:', storageDelErr);
    }

    // ── Efektif dosya alanları ──
    // Yeni file_url geldiyse → yeni değerleri kullan; gelmemişse mevcut korunur
    const eff_file_url        = incomingFileUrl !== undefined ? (incomingFileUrl || null) : existing.file_url;
    const eff_file_name       = file_name       !== undefined ? (file_name       ?? null) : existing.file_name;
    const eff_file_size_bytes = file_size_bytes !== undefined ? (file_size_bytes ?? null) : existing.file_size_bytes;
    const eff_mime_type       = file_mime       !== undefined ? (file_mime       ?? null) : existing.mime_type;

    // ── DB UPDATE ──
    const { data, error: updateError } = await supabase
      .from('hotel_documents')
      .update({
        document_type:   eff_document_type,
        language:        eff_language,
        department_code: eff_department_code,
        delivery_policy: eff_delivery_policy,
        display_text:    eff_delivery_policy === 'auto_text' ? (eff_display_text ?? null) : null,
        structured_data: eff_structured_data ?? null,
        file_url:        eff_file_url,
        file_name:       eff_file_name,
        file_size_bytes: eff_file_size_bytes,
        mime_type:       eff_mime_type,
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
