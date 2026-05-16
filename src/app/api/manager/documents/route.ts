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
  'taxi_info', 'parking_info', 'other'
];
const VALID_LANGUAGES = ['tr', 'en', 'ru', 'de', 'fr', 'ar', 'ja'];
const VALID_DEPARTMENTS = [
  'front_office', 'housekeeping', 'technical', 'fb',
  'guest_relation', 'spa', 'animation'
];
const VALID_POLICIES = ['manual_only', 'auto_file', 'auto_text'];

// GET — tüm belgeleri listele (uploaded_at DESC)
export async function GET() {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getDemoHotelSupabase();
  const { data, error } = await supabase
    .from('hotel_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

// POST — belge yükle (multipart/form-data)
export async function POST(request: Request) {
  const session = await getSessionManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const document_type = formData.get('document_type') as string | null;
  const language = (formData.get('language') as string | null) ?? 'tr';
  const department_code = formData.get('department_code') as string | null;
  const delivery_policy = (formData.get('delivery_policy') as string | null) ?? 'manual_only';
  const display_text = formData.get('display_text') as string | null;

  // Validasyon
  if (!document_type || !VALID_DOCUMENT_TYPES.includes(document_type)) {
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
  if (delivery_policy === 'auto_text' && (!display_text || display_text.trim().length === 0)) {
    return NextResponse.json({ error: 'Yazılı cevap modu için metin girilmelidir' }, { status: 400 });
  }

  // auto_text modunda dosya zorunlu DEĞİL, diğerlerinde zorunlu
  const fileRequired = delivery_policy !== 'auto_text';
  if (fileRequired && !file) {
    return NextResponse.json({ error: 'Dosya zorunludur' }, { status: 400 });
  }

  const supabase = getDemoHotelSupabase();
  let file_url: string | null = null;
  let file_name: string | null = null;
  let file_size_bytes: number | null = null;
  let mime_type: string | null = null;

  if (file) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Dosya 10 MB sınırını aşıyor' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Geçersiz dosya türü (PDF/JPG/PNG/WEBP)' }, { status: 400 });
    }

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

  // DB insert
  const { data, error } = await supabase
    .from('hotel_documents')
    .insert({
      document_type,
      language,
      department_code: department_code || null,
      delivery_policy,
      display_text: delivery_policy === 'auto_text' ? display_text : null,
      file_url,
      file_name,
      file_size_bytes,
      mime_type,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    // DB insert hata verirse, storage'a yüklenen dosyayı temizle
    if (file_url) {
      await supabase.storage.from(BUCKET).remove([file_url]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
