import { NextResponse } from 'next/server';
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth';
import { getDemoHotelSupabase } from '@/lib/supabase-client';

// presign endpoint'inden dönen path formatı: uploads/<uuid>-<filename>
const FILE_URL_REGEX = /^uploads\/[a-f0-9\-]+-[^/]+$/i;

const VALID_DOCUMENT_TYPES = [
  'concept', 'fact_sheet', 'price_list', 'day_use', 'map', 'iban',
  'bar_menu', 'room_service_menu', 'spa_services', 'a_la_carte',
  'wifi_info', 'dnd_list', 'agency_list', 'general_rules',
  'taxi_info', 'parking_info', 'other'
];
const VALID_LANGUAGES = ['tr', 'en', 'ru', 'de', 'fr', 'ar', 'ja'];
const VALID_DEPARTMENTS = [
  'front_office', 'housekeeping', 'technical', 'fb',
  'guest_relation', 'spa', 'animation'
];
const VALID_POLICIES = ['manual', 'auto_file', 'auto_text'];

// ──────────────────────────────────────────────────────────
// GET — tüm belgeleri listele (uploaded_at DESC)
// ──────────────────────────────────────────────────────────
export async function GET() {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getDemoHotelSupabase();
  const { data, error } = await supabase
    .from('hotel_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

// ──────────────────────────────────────────────────────────
// POST — belge kaydı oluştur (JSON body; dosya yükleme YOK,
//        dosya önceden presign endpoint'i üzerinden Storage'a
//        yüklenmiş olmalı, buraya sadece metadata gelir)
// ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── JSON parse ──
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON gövdesi' }, { status: 400 });
  }

  const document_type    = body.document_type    as string | null | undefined;
  const language         = (body.language         as string | null | undefined) ?? 'tr';
  const department       = body.department        as string | null | undefined;
  const delivery_policy  = (body.delivery_policy  as string | null | undefined) ?? 'manual';
  const display_text     = body.display_text      as string | null | undefined;
  const structured_data  = body.structured_data   as object | null | undefined;
  const file_url         = body.file_url          as string | null | undefined;
  const file_name        = body.file_name         as string | null | undefined;
  const file_size_bytes  = body.file_size_bytes   as number | null | undefined;
  const file_mime        = body.file_mime         as string | null | undefined;

  // ── Enum validasyonları ──
  if (!document_type || !VALID_DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json({ error: 'Geçersiz belge türü' }, { status: 400 });
  }
  if (!VALID_LANGUAGES.includes(language)) {
    return NextResponse.json({ error: 'Geçersiz dil' }, { status: 400 });
  }
  if (department && !VALID_DEPARTMENTS.includes(department)) {
    return NextResponse.json({ error: 'Geçersiz departman' }, { status: 400 });
  }
  if (!VALID_POLICIES.includes(delivery_policy)) {
    return NextResponse.json({ error: 'Geçersiz iletim politikası' }, { status: 400 });
  }

  // ── delivery_policy'e göre alan validasyonları ──
  const isIbanStructured = document_type === 'iban' && structured_data != null;

  if (delivery_policy === 'auto_file') {
    // Dosya metadata alanları zorunlu
    if (!file_url || !file_name || file_size_bytes == null || !file_mime) {
      return NextResponse.json(
        { error: 'auto_file modunda file_url, file_name, file_size_bytes ve file_mime zorunludur' },
        { status: 400 }
      );
    }
  } else if (delivery_policy === 'auto_text') {
    // IBAN yapısal modunda structured_data zorunlu; diğerlerinde display_text zorunlu
    if (isIbanStructured) {
      // structured_data mevcut, display_text gerekmez — OK
    } else if (!display_text || display_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Yazılı cevap modu için metin girilmelidir' },
        { status: 400 }
      );
    }
    // file_url auto_text modunda opsiyonel (dosya + yazılı cevap senaryosu)
  }
  // delivery_policy === 'manual' → dosya/text tamamen opsiyonel

  // ── file_url format validasyonu (presign path kontrolü) ──
  if (file_url != null && file_url !== '') {
    if (!FILE_URL_REGEX.test(file_url)) {
      return NextResponse.json(
        { error: 'file_url geçersiz format. Beklenen: uploads/<uuid>-<dosyaadı>' },
        { status: 400 }
      );
    }
  }

  // ── DB INSERT ──
  const supabase = getDemoHotelSupabase();
  const { data, error } = await supabase
    .from('hotel_documents')
    .insert({
      document_type,
      language,
      department_code: department ?? null,
      delivery_policy,
      display_text: delivery_policy === 'auto_text' ? (display_text ?? null) : null,
      structured_data: structured_data ?? null,
      file_url:        file_url        ?? null,
      file_name:       file_name       ?? null,
      file_size_bytes: file_size_bytes ?? null,
      mime_type:       file_mime       ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
