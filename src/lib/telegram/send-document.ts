/**
 * Modül 15.4 — Telegram dosya gönderme helper'ı.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'hotel_documents';
const SIGNED_URL_EXPIRES = 3600; // 1 saat

export type DocumentToSend = {
  document_id: string;
  storage_path: string;
  file_name: string;
  caption?: string;
};

/**
 * Storage'dan signed URL alır, Telegram sendDocument API'sini çağırır.
 */
export async function sendTelegramDocument(params: {
  botToken: string;
  chatId: number | string;
  supabase: SupabaseClient;
  doc: DocumentToSend;
}): Promise<{ ok: boolean; error?: string }> {
  const { botToken, chatId, supabase, doc } = params;

  // 1) Storage'dan signed URL al
  const { data: signed, error: signedErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRES);

  if (signedErr || !signed?.signedUrl) {
    return {
      ok: false,
      error: `Signed URL alinamadi: ${signedErr?.message ?? 'unknown'}`,
    };
  }

  // 2) Telegram sendDocument
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const body = new URLSearchParams({
    chat_id: String(chatId),
    document: signed.signedUrl,
  });
  if (doc.caption) body.append('caption', doc.caption);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Telegram API ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

/**
 * AI cevabında auto_file belge ima edildi mi? Basit keyword tespiti.
 * AI'ın "dosyayı/PDF'i/belgeyi gönderiyorum" demesi tetikleyici.
 */
export function shouldSendDocument(aiResponse: string): boolean {
  const text = aiResponse.toLowerCase();
  const triggers = [
    'gonderiyorum',
    'gönderiyorum',
    'iletiyorum',
    'pdf',
    'belgeyi',
    'dosyayi',
    'dosyayı',
  ];
  return triggers.some((t) => text.includes(t));
}

/**
 * Mevcut auto_file belgeleri arasından soruyla en alakalı olanı seçer.
 * Basit kategori eşleştirme: misafirin sorusundaki keyword'leri
 * document_type ile eşleştirir.
 */
export async function findRelevantAutoFileDocument(
  supabase: SupabaseClient,
  guestMessage: string,
): Promise<DocumentToSend | null> {
  const text = guestMessage.toLowerCase();

  // Soru → document_type haritası
  const keywordMap: Record<string, string[]> = {
    iban: ['iban', 'hesap', 'banka', 'havale', 'eft', 'odeme', 'ödeme'],
    price_list: ['fiyat', 'ucret', 'tarife'],
    bar_menu: ['bar', 'icecek', 'menu'],
    room_service_menu: ['oda servisi', 'room service'],
    spa_services: ['spa', 'masaj'],
    a_la_carte: ['a la carte', 'restoran menu'],
    fact_sheet: ['fact sheet', 'tanitim'],
    map: ['harita', 'kroki'],
    wifi_info: ['wifi', 'sifre', 'internet'],
  };

  // En çok keyword eşleşen document_type'ı bul
  let bestType: string | null = null;
  let bestScore = 0;
  for (const [docType, keywords] of Object.entries(keywordMap)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = docType;
    }
  }
  if (!bestType) return null;

  // DB'den auto_file modunda aktif belgeyi çek
  const { data } = await supabase
    .from('hotel_documents')
    .select('id, file_url, file_name, document_type')
    .eq('document_type', bestType)
    .eq('delivery_policy', 'auto_file')
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.file_url) return null;

  return {
    document_id: data.id as string,
    storage_path: data.file_url as string,
    file_name: (data.file_name as string | null) ?? 'document',
  };
}
