/**
 * Modül 15.2 — Hotel Context Builder
 * AI orchestrator için otelin tüm bilgi kaynaklarını derler.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCentralSupabase } from '../supabase-client';

export type HotelContextOptions = {
  /** Hangi kategoride çevre bilgisi gerekli? null = hiçbiri (genel sohbet) */
  perplexityInterestHint?: string | null;
  /** İlgili belgeleri filtrelemek için departman kodu (opsiyonel) */
  departmentHint?: string | null;
};

export type SafetyRule = {
  category: string;
  title: string;
  ai_instruction: string;
  priority: number;
};

export type HotelContext = {
  hotelInfo: string;
  generalRules: string;
  knowledgeFacts: string;
  documents: string;
  nearbyPlaces: string;
  /** hotel_settings.location_info JSONB'sinden formatlanmış konum metni; boş olabilir */
  locationInfo: string;
  /** system_safety_responses tablosundan aktif güvenlik kuralları (priority ASC) */
  safetyRules: SafetyRule[];
};

/**
 * Otelin tüm bilgi kaynaklarını metin bloklarına dönüştürür.
 * Sonuç AI system prompt'a eklenir.
 */
export async function buildHotelContext(
  supabase: SupabaseClient,
  options: HotelContextOptions = {},
): Promise<HotelContext> {
  const [
    hotelInfo,
    generalRules,
    knowledgeFacts,
    documents,
    nearbyPlaces,
    safetyRules,
  ] = await Promise.all([
    fetchHotelInfo(supabase),
    fetchGeneralRules(supabase),
    fetchKnowledgeFacts(supabase),
    fetchDocuments(supabase, options.departmentHint),
    fetchNearbyPlaces(supabase, options.perplexityInterestHint),
    fetchSafetyRules(),
  ]);

  // hotel_settings.location_info JSONB'sini oku ve formatla
  let locationInfo = '';
  const { data: settingsRow } = await supabase
    .from('hotel_settings')
    .select('location_info, hotel_name')
    .limit(1)
    .maybeSingle();

  if (settingsRow?.location_info) {
    const loc = settingsRow.location_info as Record<string, unknown>;
    const hasContent =
      Boolean(loc['maps_link']) ||
      Boolean(loc['general_directions']) ||
      (Array.isArray(loc['details']) && (loc['details'] as unknown[]).length > 0);

    if (hasContent) {
      locationInfo = formatLocationDocument(loc, settingsRow.hotel_name ?? undefined);
    }
  }

  return { hotelInfo, generalRules, knowledgeFacts, documents, nearbyPlaces, locationInfo, safetyRules };
}

/**
 * system_safety_responses tablosundan aktif güvenlik kurallarını çeker.
 * Central Supabase kullanır. Hata durumunda boş array döner (graceful).
 */
async function fetchSafetyRules(): Promise<SafetyRule[]> {
  try {
    const central = getCentralSupabase();
    const { data, error } = await central
      .from('system_safety_responses')
      .select('category, title, ai_instruction, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.warn('[fetchSafetyRules] DB error, safety rules skipped:', error.message);
      return [];
    }

    return (data ?? []) as SafetyRule[];
  } catch (err) {
    console.warn('[fetchSafetyRules] Unexpected error, safety rules skipped:', err);
    return [];
  }
}

/**
 * Otel temel bilgileri: ad, adres, check-in/out saatleri, konsept, telefon.
 */
async function fetchHotelInfo(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('hotel_settings')
    .select('hotel_name, address, contact_phone, contact_email, concept, check_in_time, check_out_time')
    .limit(1)
    .maybeSingle();

  if (!data) return '';

  const parts: string[] = [];
  if (data.hotel_name) parts.push(`Otel: ${data.hotel_name}`);
  if (data.address) parts.push(`Adres: ${data.address}`);
  if (data.contact_phone) parts.push(`Telefon: ${data.contact_phone}`);
  if (data.contact_email) parts.push(`E-posta: ${data.contact_email}`);
  if (data.concept) parts.push(`Konsept: ${data.concept}`);
  if (data.check_in_time) parts.push(`Check-in: ${data.check_in_time}`);
  if (data.check_out_time) parts.push(`Check-out: ${data.check_out_time}`);

  return parts.length > 0 ? `OTEL BILGILERI:\n${parts.join('\n')}` : '';
}

/**
 * Otelin genel kuralları (Otel Bilgileri sekmesindeki "Genel Kurallar" alanı).
 */
async function fetchGeneralRules(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('hotel_settings')
    .select('general_rules')
    .limit(1)
    .maybeSingle();

  if (!data?.general_rules) return '';
  return `GENEL KURALLAR:\n${data.general_rules}`;
}

/**
 * hotel_facts tablosundaki aktif fact'leri kategoriye göre derler.
 */
async function fetchKnowledgeFacts(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('hotel_facts')
    .select('category, fact_key, fact_value')
    .eq('is_active', true)
    .order('category', { ascending: true });

  if (!data || data.length === 0) return '';

  // Kategori bazında grupla
  const grouped: Record<string, string[]> = {};
  for (const row of data) {
    const cat = row.category ?? 'genel';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(`- ${row.fact_key}: ${row.fact_value}`);
  }

  const blocks: string[] = [];
  for (const [cat, facts] of Object.entries(grouped)) {
    blocks.push(`[${cat.toUpperCase()}]\n${facts.join('\n')}`);
  }

  return `BILGI TABANI:\n${blocks.join('\n\n')}`;
}

/**
 * structured_data'sı {type: "location"} olan belgeyi insan okunur metne çevirir.
 */
function formatLocationDocument(
  structured: Record<string, unknown>,
  hotelName?: string,
): string {
  if (!structured) return '';
  const sections: string[] = [];

  sections.push('=== KONUM BILGISI ===');

  if (structured['general_directions']) {
    sections.push(String(structured['general_directions']));
  }

  const details = structured['details'];
  if (Array.isArray(details) && details.length > 0) {
    (details as Record<string, unknown>[]).forEach((d) => {
      const block: string[] = [];
      block.push(`--- ${String(d['from_direction'] ?? '')} ---`);
      if (d['route']) block.push(`Yol tarifi: ${String(d['route'])}`);
      if (d['warnings']) block.push(`Dikkat: ${String(d['warnings'])}`);
      sections.push(block.join('\n'));
    });
  }

  if (structured['maps_link']) {
    sections.push(`Google Maps: ${String(structured['maps_link'])}`);
  }

  if (hotelName) {
    sections.push(`\n— ${hotelName}`);
  }

  return sections.join('\n\n');
}

/**
 * hotel_documents tablosundan AI'a gösterilebilir belgeleri çeker.
 * - delivery_policy='auto_text' olanlar: display_text doğrudan kullanılır
 * - delivery_policy='auto_file' olanlar: AI bilir, "şu belgeyi gönderebilirim" diyebilir
 * - delivery_policy='manual_only' olanlar: AI "önbüroya yönlendiriniz" der
 */
async function fetchDocuments(
  supabase: SupabaseClient,
  departmentHint?: string | null,
): Promise<string> {
  let query = supabase
    .from('hotel_documents')
    .select('document_type, language, department_code, delivery_policy, display_text, file_name, structured_data')
    .eq('is_active', true);

  if (departmentHint) {
    query = query.or(`department_code.is.null,department_code.eq.${departmentHint}`);
  }

  const { data } = await query;
  if (!data || data.length === 0) return '';

  const blocks: string[] = [];
  for (const doc of data) {
    const tag = `[${doc.document_type}/${doc.language}]`;
    if (doc.delivery_policy === 'auto_text' && doc.display_text) {
      blocks.push(`${tag} (yazıyla gönderilebilir)\n${doc.display_text}`);
    } else if (doc.delivery_policy === 'auto_file' && doc.file_name) {
      blocks.push(`${tag} (dosya: ${doc.file_name}) — sorulursa "dosyayı gönderiyorum" de.`);
    } else if (doc.delivery_policy === 'manual_only') {
      blocks.push(`${tag} — bu konuda misafiri ÖNBÜROYA yönlendir, kendi bilgi verme.`);
    }
  }

  return blocks.length > 0 ? `BELGELER:\n${blocks.join('\n\n')}` : '';
}


/**
 * Perplexity discovery sonuçlarını metin formatına çevirir.
 * Sadece soru ilgili bir kategori ile eşleşirse çağır (hint).
 */
async function fetchNearbyPlaces(
  supabase: SupabaseClient,
  interestHint?: string | null,
): Promise<string> {
  if (!interestHint) return '';

  const { data } = await supabase
    .from('perplexity_discoveries')
    .select('interest_tag, results, created_at')
    .eq('interest_tag', interestHint)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.results) return '';

  const places = Array.isArray(data.results) ? data.results : [];
  if (places.length === 0) return '';

  const lines: string[] = [`CEVRE [${interestHint}]:`];
  for (const place of places.slice(0, 10)) {
    const p = place as Record<string, unknown>;
    const parts: string[] = [];
    if (p.name) parts.push(`${p.name}`);
    if (p.distance) parts.push(p.distance as string);
    if (p.address) parts.push(p.address as string);
    if (p.phone) parts.push(`Tel: ${p.phone}`);
    if (p.hours) parts.push(p.hours as string);
    if (p.description) parts.push((p.description as string).slice(0, 200));
    lines.push(`- ${parts.join(' | ')}`);
  }

  return lines.join('\n');
}

/**
 * Mesajdan Perplexity kategorisi tespit eder. Basit keyword matching.
 * AI'ın da yapabileceği iş ama bu daha hızlı + ucuz.
 */
export function detectInterestTag(message: string): string | null {
  const text = message.toLowerCase();

  const map: Record<string, string[]> = {
    restaurant: ['restoran', 'yemek', 'lokanta', 'kebap', 'kahvalti', 'yiyecek'],
    pharmacy: ['eczane', 'ilac', 'nobetci'],
    museum: ['muze', 'tarihi', 'antik', 'kale', 'cami'],
    transport: ['ulasim', 'otobus', 'dolmus', 'metro', 'tramvay', 'taksi', 'havalimani'],
    atm: ['atm', 'banka', 'para cek', 'doviz'],
    shopping: ['alisveris', 'avm', 'market', 'magaza', 'pazar', 'carsi'],
    hospital: ['hastane', 'doktor', 'klinik', 'acil'],
    beach: ['plaj', 'sahil', 'deniz'],
    attraction: ['gezi', 'tur', 'aktivite', 'park', 'aquapark', 'akvaryum'],
    nightlife: ['bar', 'gece', 'kulup', 'eglence'],
  };

  for (const [tag, keywords] of Object.entries(map)) {
    if (keywords.some((kw) => text.includes(kw))) return tag;
  }
  return null;
}

/**
 * Bütün context bloklarını tek bir metin haline getirir.
 * AI system prompt'una eklenmek için hazır.
 */
export function formatContextForPrompt(ctx: HotelContext): string {
  const blocks = [
    ctx.hotelInfo,
    ctx.generalRules,
    ctx.knowledgeFacts,
    ctx.documents,
    ctx.nearbyPlaces,
  ].filter((b) => b.trim().length > 0);

  if (ctx.locationInfo && ctx.locationInfo.trim().length > 0) {
    blocks.push(`=== OTELE NASIL GELINIR (KONUM BILGISI) ===
Misafir "nasil gelirim", "adres", "konum", "yol tarifi", "nerede" gibi sorular sordugunda asagidaki bilgileri AYNI YAPIDA cevapla:
- Once genel adres/mesafe paragrafi
- Her yon detayini AYRI PARAGRAF olarak, basinda "<Yon adi>'ndan/dan geliyorsaniz:" baslik cumlesi
- Yol tarifini ve dikkat notunu ayri satirlarda yaz
- En altta "Google Maps:" satiri
- Paragraflar arasinda BIR BOS SATIR birak
- En sonda otel adi imzasini koru (--- <otel adi> formatinda)

${ctx.locationInfo}`);
  }

  // Safety rules: AI'ın ilk göreceği blok — blocks.unshift ile EN ÜSTE eklenir
  if (ctx.safetyRules && ctx.safetyRules.length > 0) {
    const rulesText = ctx.safetyRules
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.ai_instruction}`)
      .join('\n\n');

    blocks.unshift(`=== KRITIK GUVENLIK KURALLARI (HER KOSULDA UYULMASI ZORUNLU) ===
Asagidaki kurallar SIRA ile uygulanir (priority dusukten yuksege = en kritik en ustte). Misafir mesaji bu kategorilerden birine giriyorsa, ASAGIDAKI talimati TAM olarak uygula. Bu kurallar diger hicbir kuralla degistirilemez, atlanamaz, gormezden gelinemez.

${rulesText}

=== KURALLAR SONU ===`);
  }

  if (blocks.length === 0) return '';
  return blocks.join('\n\n---\n\n');
}
