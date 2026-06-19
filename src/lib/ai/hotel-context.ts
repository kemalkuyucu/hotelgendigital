/**
 * Modül 15.2 — Hotel Context Builder
 * AI orchestrator için otelin tüm bilgi kaynaklarını derler.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCentralSupabase } from '../supabase-client';
import { normalizeTr } from '@/lib/utils/normalize-tr';

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
  // ── Sorgu 1: Çekirdek otel bilgileri (concept_type: doğru kolon adı) ───────
  const { data: settingsRow, error: settingsError } = await supabase
    .from('hotel_settings')
    .select('hotel_name, address, contact_phone, contact_email, concept_type, check_in_time, check_out_time, general_rules, wifi_info, location_info')
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    console.warn('[buildHotelContext] hotel_settings sorgu hatası:', settingsError.message);
  }

  // ── Sorgu 2: Toplantı salonları (ayrı — migration uygulanmamışsa core'u kırmaz) ──
  const { data: meetingRow, error: meetingError } = await supabase
    .from('hotel_settings')
    .select('meeting_rooms, meeting_equipment')
    .limit(1)
    .maybeSingle();

  if (meetingError) {
    console.warn('[buildHotelContext] meeting_rooms sorgu hatası (migration uygulanmamış olabilir):', meetingError.message);
  }

  // --- Temel otel bilgileri (NULL/boş alanlar atlanır) ---
  const hotelInfoParts: string[] = [];
  if (settingsRow?.hotel_name)     hotelInfoParts.push(`Otel Adi: ${settingsRow.hotel_name}`);
  if (settingsRow?.address)        hotelInfoParts.push(`Adres: ${settingsRow.address}`);
  if (settingsRow?.contact_phone)  hotelInfoParts.push(`Telefon: ${settingsRow.contact_phone}`);
  if (settingsRow?.contact_email)  hotelInfoParts.push(`E-posta: ${settingsRow.contact_email}`);
  if (settingsRow?.concept_type)   hotelInfoParts.push(`Konsept: ${settingsRow.concept_type}`);
  if (settingsRow?.check_in_time)  hotelInfoParts.push(`Check-in: ${settingsRow.check_in_time}`);
  if (settingsRow?.check_out_time) hotelInfoParts.push(`Check-out: ${settingsRow.check_out_time}`);
  if (settingsRow?.wifi_info)      hotelInfoParts.push(`Wi-Fi: ${settingsRow.wifi_info}`);

  // --- Toplantı / etkinlik salonları (yapısal) ---
  const mrList = meetingRow?.meeting_rooms;
  if (Array.isArray(mrList) && mrList.length > 0) {
    const mrBlock = formatMeetingRoomsBlock(
      mrList as MeetingRoomRecord[],
      settingsRow?.contact_phone as string | null | undefined,
    );
    if (mrBlock) hotelInfoParts.push('\n' + mrBlock);
  }

  // --- Teknik ekipmanlar (dolu ise) ---
  const eqList = meetingRow?.meeting_equipment;
  if (Array.isArray(eqList) && eqList.length > 0) {
    const eqFiltered = (eqList as unknown[]).filter((e): e is string => typeof e === 'string' && e.trim().length > 0);
    if (eqFiltered.length > 0) {
      hotelInfoParts.push(`Toplanti Teknik Ekipmanlari: ${eqFiltered.join(', ')}`);
    }
  }

  const hotelInfo = hotelInfoParts.length > 0
    ? `=== OTEL TEMEL BILGILERI ===\n${hotelInfoParts.join('\n')}`
    : '';

  // --- Genel kurallar ---
  const generalRules = settingsRow?.general_rules
    ? `GENEL KURALLAR:\n${settingsRow.general_rules}`
    : '';

  // --- Konum bilgisi (location_info JSONB) ---
  let locationInfo = '';
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

  // --- Paralel: KB facts, belgeler, yakın çevre, güvenlik kuralları ---
  const [
    knowledgeFactsRaw,
    documents,
    nearbyPlaces,
    safetyRules,
    menuItems,
    spaServices,
    roomRates,
  ] = await Promise.all([
    fetchKnowledgeFacts(supabase),
    fetchDocuments(supabase, options.departmentHint),
    fetchNearbyPlaces(supabase, options.perplexityInterestHint),
    fetchSafetyRules(),
    fetchMenuItems(supabase),
    fetchSpaServices(supabase),
    fetchRoomRates(supabase),
  ]);

  const withMenu = menuItems
    ? (knowledgeFactsRaw ? `${knowledgeFactsRaw}\n\n${menuItems}` : menuItems)
    : knowledgeFactsRaw;
  const withSpa = spaServices
    ? (withMenu ? `${withMenu}\n\n${spaServices}` : spaServices)
    : withMenu;
  const knowledgeFacts = roomRates
    ? (withSpa ? `${withSpa}\n\n${roomRates}` : roomRates)
    : withSpa;

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

// fetchHotelInfo ve fetchGeneralRules kaldırıldı:
// buildHotelContext() artık tek sorguda hotel_settings'in TÜM alanlarını çekiyor.

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

async function fetchMenuItems(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('menu_items')
    .select('item_name, category, price, currency, is_paid')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (!data || data.length === 0) return '';

  const lines = data.map((row) => {
    const ucret = row.is_paid
      ? `${row.price ?? 0} ${row.currency ?? 'TRY'} (UCRETLI)`
      : 'UCRETSIZ';
    const kat = row.category ? ` [${row.category}]` : '';
    return `- ${row.item_name}${kat}: ${ucret}`;
  });

  return `ROOM-SERVICE MENUSU (oda servisi siparis edilebilir kalemler ve fiyatlari):\n${lines.join('\n')}`;
}

async function fetchSpaServices(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('spa_services')
    .select('service_name, category, duration_min, price, currency, is_paid, description')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (!data || data.length === 0) return '';

  const lines = data.map((row) => {
    const ucret = !row.is_paid
      ? 'UCRETSIZ'
      : (row.price && Number(row.price) > 0)
        ? `${row.price} ${row.currency ?? 'TRY'} (UCRETLI)`
        : 'Fiyat icin SPA resepsiyonuna danisabilirsiniz (UCRETLI)';
    const sure = row.duration_min ? `, ${row.duration_min} dk` : '';
    const kat = row.category ? ` [${row.category}]` : '';
    const aciklama = row.description ? ` - ${row.description}` : '';
    return `- ${row.service_name}${kat}${sure}: ${ucret}${aciklama}`;
  });

  return `SPA & WELLNESS HIZMETLERI (mevcut hizmetler, sure ve fiyatlar):\n${lines.join('\n')}`;
}

async function fetchRoomRates(supabase: any): Promise<string> {
  const { data: rates } = await supabase
    .from('room_rates')
    .select('room_type, capacity, period_start, period_end, price, currency, board_type')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (!rates || rates.length === 0) return '';

  const lines = rates.map((r: any) => {
    const cap = r.capacity ? ' (' + r.capacity + ')' : '';
    const board = r.board_type ? ', ' + r.board_type : '';
    return '- ' + r.room_type + cap + ' | ' + r.period_start + ' -> ' + r.period_end + ': ' + r.price + ' ' + r.currency + board;
  }).join('\n');

  const { data: links } = await supabase
    .from('reservation_links')
    .select('label, url')
    .eq('is_official', true)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1);

  const link = links && links.length > 0 ? links[0].url : null;
  const linkLine = link
    ? '\n\nRezervasyon yaptirmak isteyen misafire su rezervasyon linkini ver: ' + link
    : '';

  return '=== KONAKLAMA / REZERVASYON FIYATLARI ===\n' + lines + linkLine;
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

  if (!data?.results) {
    console.warn(`[perplexity] no data interest_tag=${interestHint} — veri eksikliği (panel’den Perplexity sorgular)`);
    return '';
  }

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
 * AI'in de yapabileceği iş ama bu daha hızlı + ucuz.
 *
 * FIX 2a: Hem gelen mesaj hem keyword listesi normalizeTr() ile normalize edilir.
 * Böylece "İlaç", "ilaç", "ILAC" hepsi "ilac" keyword'ü ile eşleşir.
 * normalizeTr: @/lib/utils/normalize-tr — verify-guest.ts ile AYNI fonksiyon.
 */
export function detectInterestTag(message: string): string | null {
  const text = normalizeTr(message); // FIX 2a: sadece .toLowerCase() değil, normalizeTr

  // FIX 3: TÜM kategoriler çok dilli (EN/DE/FR/AR/RU) — yabancı misafirler de eşleşir
  const map: Record<string, string[]> = {
    restaurant: [
      // TR
      'restoran', 'yemek', 'yemegi', 'yemeği', 'lokanta', 'kebap', 'kahvalti', 'yiyecek', 'ogle', 'aksam yemek', 'aksam yemegi',
      // EN
      'restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'cuisine', 'eat', 'dining',
      // DE
      'restaurant', 'essen', 'speisen', 'abendessen', 'mittagessen', 'fruhstuck',
      // FR
      'restaurant', 'manger', 'cuisine', 'repas', 'diner', 'dejeuner',
      // AR
      'مطعم', 'طعام', 'اكل', 'وجبة', 'غداء', 'عشاء',
      // RU
      'ресторан', 'еда', 'обед', 'ужин', 'завтрак', 'кафе',
    ],
    pharmacy: [
      // TR
      'eczane', 'ilac', 'ilaci', 'ilacim', 'nobetci', 'nobetci eczane',
      // EN
      'pharmacy', 'chemist', 'drugstore', 'medicine', 'drug',
      // DE
      'apotheke', 'medikament', 'arznei',
      // FR
      'pharmacie', 'medicament', 'medicaments',
      // AR
      'صيدلية', 'دواء', 'ادوية', 'صيدلي',
      // RU
      'аптека', 'лекарство', 'лекарства', 'таблетки',
    ],
    museum: [
      // TR
      'muze', 'tarihi', 'antik', 'kale', 'cami',
      // EN
      'museum', 'historical', 'history', 'castle', 'mosque', 'heritage', 'monument',
      // DE
      'museum', 'historisch', 'burg', 'moschee', 'denkmal',
      // FR
      'musee', 'historique', 'chateau', 'mosquee', 'monument',
      // AR
      'متحف', 'تاريخي', 'قلعة', 'مسجد', 'اثار',
      // RU
      'музей', 'исторический', 'замок', 'мечеть', 'памятник',
    ],
    transport: [
      // TR
      'ulasim', 'otobus', 'dolmus', 'metro', 'tramvay', 'taksi', 'havalimani',
      // EN
      'transport', 'bus', 'metro', 'tram', 'taxi', 'airport', 'shuttle', 'transit',
      // DE
      'transport', 'bus', 'metro', 'strassenbahn', 'taxi', 'flughafen', 'verkehr',
      // FR
      'transport', 'bus', 'metro', 'tramway', 'taxi', 'aeroport', 'navette',
      // AR
      'مواصلات', 'حافلة', 'مترو', 'تاكسي', 'مطار', 'ترام',
      // RU
      'транспорт', 'автобус', 'метро', 'трамвай', 'такси', 'аэропорт',
    ],
    atm: [
      // TR
      'atm', 'banka', 'para cek', 'doviz',
      // EN
      'atm', 'bank', 'cash', 'exchange', 'currency',
      // DE
      'geldautomat', 'bank', 'wechselstube', 'bargeld', 'wahrung',
      // FR
      'distributeur', 'banque', 'especes', 'change',
      // AR
      'صراف', 'بنك', 'نقود', 'صرافة', 'atm',
      // RU
      'банкомат', 'банк', 'наличные', 'обмен',
    ],
    shopping: [
      // TR
      'alisveris', 'avm', 'market', 'magaza', 'pazar', 'carsi',
      // EN
      'shopping', 'mall', 'market', 'store', 'shop', 'bazaar', 'souvenir',
      // DE
      'einkaufen', 'einkaufszentrum', 'markt', 'laden', 'geschaft',
      // FR
      'shopping', 'centre commercial', 'marche', 'magasin', 'boutique',
      // AR
      'تسوق', 'مول', 'سوق', 'متجر', 'بازار', 'هدايا',
      // RU
      'шопинг', 'торговый центр', 'рынок', 'магазин', 'базар',
    ],
    hospital: [
      // TR
      'hastane', 'doktor', 'klinik', 'acil',
      // EN
      'hospital', 'doctor', 'clinic', 'emergency', 'medical',
      // DE
      'krankenhaus', 'arzt', 'klinik', 'notaufnahme', 'medizinisch',
      // FR
      'hopital', 'medecin', 'clinique', 'urgences',
      // AR
      'مستشفى', 'طبيب', 'عيادة', 'طوارئ', 'طبي',
      // RU
      'больница', 'врач', 'клиника', 'скорая', 'медицинский',
    ],
    beach: [
      // TR
      'plaj', 'sahil', 'deniz',
      // EN
      'beach', 'sea', 'coast', 'shore', 'seaside', 'swimming',
      // DE
      'strand', 'meer', 'kuste', 'see', 'schwimmen',
      // FR
      'plage', 'mer', 'cote', 'bord de mer',
      // AR
      'شاطئ', 'بحر', 'ساحل', 'بحيرة',
      // RU
      'пляж', 'море', 'берег', 'побережье', 'купаться',
    ],
    attraction: [
      // TR
      'gezi', 'tur', 'aktivite', 'park', 'aquapark', 'akvaryum',
      // EN
      'attraction', 'tour', 'activity', 'theme park', 'aquarium', 'sightseeing', 'excursion',
      // DE
      'sehenswurdigkeit', 'tour', 'aktivitat', 'freizeitpark', 'aquarium', 'ausflug',
      // FR
      'attraction', 'tour', 'activite', 'parc', 'aquarium', 'excursion',
      // AR
      'معلم', 'جولة', 'نشاط', 'حديقة', 'ترفيه', 'رحلة',
      // RU
      'достопримечательность', 'экскурсия', 'аквариум', 'аттракцион', 'парк',
    ],
    nightlife: [
      // TR
      'bar', 'gece', 'kulup', 'eglence',
      // EN
      'bar', 'nightlife', 'club', 'nightclub', 'lounge', 'entertainment', 'disco',
      // DE
      'bar', 'nachtleben', 'club', 'diskothek', 'lounge', 'unterhaltung',
      // FR
      'bar', 'vie nocturne', 'club', 'discoteque', 'soiree',
      // AR
      'بار', 'ليلي', 'نادي', 'ترفيه ليلي', 'ملهى',
      // RU
      'бар', 'ночная жизнь', 'клуб', 'дискотека', 'развлечения',
    ],
  };

  for (const [tag, keywords] of Object.entries(map)) {
    // FIX 2a: keyword de normalize edilir (normalizedKw), karşılaştırma normalize↔normalize
    if (keywords.some((kw) => text.includes(normalizeTr(kw)))) return tag;
  }
  return null;
}

/**
 * Bütün context bloklarını tek bir metin haline getirir.
 * AI system prompt'una eklenmek için hazır.
 *
 * HOTEL CONTEXT bloğu:
 *   - Temel otel bilgileri (ad, adres, telefon, check-in/out, wifi, meeting rooms)
 *   - Genel kurallar
 *   - Bilgi Tabanı (SSS / hotel_facts)
 *   - Belgeler
 *   - Yakın çevre
 *   - Konum detayı
 */
export function formatContextForPrompt(ctx: HotelContext): string {
  const blocks: string[] = [];

  // Türkçe alfabe kuralı — EN ÖNCE
  blocks.push(
    `DIL KURALI (16.a): Cevaplarinda SADECE standart Turk alfabesi kullan ` +
    `(a b c c d e f g g h i i j k l m n o o p r s s t u u v y z). ` +
    `Kiril, Yunan veya benzer alfabelerden harf KARISTIRMA. ` +
    `Telefon numarasi, link, isim yazarken bile sadece Latin/Turkce karakter kullan.`
  );

  // Ana HOTEL CONTEXT bloğu
  const contextParts: string[] = [];
  if (ctx.hotelInfo)      contextParts.push(ctx.hotelInfo);
  if (ctx.generalRules)   contextParts.push(ctx.generalRules);
  if (ctx.knowledgeFacts) contextParts.push(ctx.knowledgeFacts);
  if (ctx.documents)      contextParts.push(ctx.documents);
  if (ctx.nearbyPlaces)   contextParts.push(ctx.nearbyPlaces);

  if (contextParts.length > 0) {
    blocks.push(
      `=== HOTEL CONTEXT — YALNIZCA BU BILGILERI KULLAN ===\n\n` +
      `KURAL 1: Asagidaki HOTEL CONTEXT disindaki bilgileri KESINLIKLE UYDURMA.\n` +
      `KURAL 2: Baglamda bilgi VARSA net ve kesin cevap ver — "resepsiyona danisin" DEME.\n` +
      `KURAL 3: Baglamda YOKSA kibarca bilmedigini soyle ve otel telefona yonlendir` +
      (ctx.hotelInfo?.includes('Telefon:') ? ` (yukardaki Telefon numarasini kullan).` : `.`) +
      `\n\n` +
      contextParts.join('\n\n')
    );
  }

  if (ctx.locationInfo && ctx.locationInfo.trim().length > 0) {
    blocks.push(
      `=== OTELE NASIL GELINIR (KONUM BILGISI) ===\n` +
      `Misafir "nasil gelirim", "adres", "konum", "yol tarifi", "nerede" gibi sorular sordugunda ` +
      `asagidaki bilgileri AYNI YAPIDA cevapla:\n` +
      `- Once genel adres/mesafe paragrafi\n` +
      `- Her yon detayini AYRI PARAGRAF olarak, basinda "<Yon adi>'ndan/dan geliyorsaniz:" baslik cumlesi\n` +
      `- Yol tarifini ve dikkat notunu ayri satirlarda yaz\n` +
      `- En altta "Google Maps:" satiri\n` +
      `- Paragraflar arasinda BIR BOS SATIR birak\n` +
      `- En sonda otel adi imzasini koru (--- <otel adi> formatinda)\n\n` +
      ctx.locationInfo
    );
  }

  if (blocks.length === 0) return '';
  return blocks.join('\n\n---\n\n');
}

// ── Modül 16.b — Toplantı Salonu Intent Tespiti ───────────────────────────────

/**
 * Ham mesaj metninde toplantı/etkinlik/salon niyeti var mı?
 * Safety pre-classifier'dan SONRA, AI'dan ÖNCE çalışır.
 * true → meeting rooms short-circuit aktif.
 * false → normal akış devam eder.
 */
export function detectMeetingRoomIntent(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[İI]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .replace(/[Aa]/g, 'a');

  const keywords = [
    'toplanti salonu', 'toplanti salonlari', 'toplanti salonu var mi',
    'toplanti', 'etkinlik', 'dugun', 'dugün', 'kongre', 'balo',
    'seminer', 'banket', 'konferans', 'organizasyon',
    'salon kapasitesi', 'salon fiyat', 'salon kirala',
    'meeting room', 'event hall', 'ballroom', 'conference',
  ];

  return keywords.some((kw) => normalized.includes(kw));
}

// ── Toplantı Salonu Blocked-Format Formatter ──────────────────────────────────

/** Dahili tip: hotel_settings.meeting_rooms JSONB'sinden bir salon kaydı */
export type MeetingRoomRecord = {
  ad?: string | null;
  m2?: number | null;
  tiyatro?: number | null;
  sinif?: number | null;
  u_duzen?: number | null;
  banket?: number | null;
  kokteyl?: number | null;
  gun_isigi?: boolean | null;
  en?: number | null;
  boy?: number | null;
  yukseklik?: number | null;
};

/**
 * Salon listesini misafire gösterilecek yapısal blocked-format metne dönüştürür.
 * Türkçe alfabe kuralı (16.a ile aynı mantık): standart Latin/Türkçe harfler kullanılır.
 *
 * Örnek çıktı:
 *   === TOPLANTI SALONLARI ===
 *   ...
 *   Detayli kapasite/fiyat icin: 📞 +90 123 ...
 */
export function formatMeetingRoomsBlock(
  rooms: MeetingRoomRecord[],
  contactPhone?: string | null,
): string {
  const activeRooms = rooms.filter((r) => r.ad && String(r.ad).trim().length > 0);
  if (activeRooms.length === 0) return '';

  const lines: string[] = ['=== TOPLANTI SALONLARI ===', ''];

  for (const room of activeRooms) {
    const name = String(room.ad ?? '').trim();
    lines.push(`🏛 ${name}`);

    if (room.m2 && Number(room.m2) > 0) {
      lines.push(`   Alan: ${room.m2} m²`);
    }

    // Kapasite düzenleri — yalnızca dolu (>0) olanlar
    const layouts: string[] = [];
    if (room.tiyatro && Number(room.tiyatro) > 0) layouts.push(`Tiyatro: ${room.tiyatro} kisi`);
    if (room.sinif && Number(room.sinif) > 0) layouts.push(`Sinif: ${room.sinif} kisi`);
    if (room.u_duzen && Number(room.u_duzen) > 0) layouts.push(`U-duzen: ${room.u_duzen} kisi`);
    if (room.banket && Number(room.banket) > 0) layouts.push(`Banket: ${room.banket} kisi`);
    if (room.kokteyl && Number(room.kokteyl) > 0) layouts.push(`Kokteyl: ${room.kokteyl} kisi`);

    if (layouts.length > 0) {
      lines.push(`   Kapasite: ${layouts.join(' | ')}`);
    }

    if (room.gun_isigi) {
      lines.push(`   Gun isigi: Evet`);
    }

    lines.push(''); // salon arası boşluk
  }

  // Yönlendirme cümlesi
  if (contactPhone && contactPhone.trim().length > 0) {
    lines.push(`Daha buyuk organizasyonlar veya detayli kapasite/fiyat icin: 📞 ${contactPhone.trim()}`);
  } else {
    lines.push(`Daha buyuk organizasyonlar veya detayli kapasite/fiyat icin resepsiyonumuzla iletisime gecebilirsiniz.`);
  }

  return lines.join('\n');
}
