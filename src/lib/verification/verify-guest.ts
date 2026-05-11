import type { SupabaseClient } from '@supabase/supabase-js';
import { VERIFICATION_TTL_HOURS } from '@/lib/ai/verification-intents';

export interface VerifyResult {
  matched: boolean;
  guestId?: string;
  guestFullName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestLanguage?: string;
  guestGender?: 'male' | 'female' | null;
  roomNo?: string;
  reason?: 'no_match' | 'format_error' | 'multiple_match';
}

/**
 * Modül 10.2: Misafirin gönderdiği mesajdan oda numarası, AD ve SOYAD çıkarır.
 *
 * Stratejisi:
 *  1. Oda numarasını regex ile bul: "Oda 215", "room 312", "215" → 2-4 haneli sayı
 *  2. Oda numarasından sonraki kısımdan harf-only token'lar al, stop word'leri at
 *  3. En az 2 token gerekiyor: firstName + lastName
 *     - Son token: lastName
 *     - Geri kalan: firstName (çoklu ad desteklenir: "Mehmet Ali")
 *  4. Tek token varsa → firstName=null, lastName=null (yetersiz)
 *
 * hasEmbeddedRequest=true durumunda embeddedRequest alanında talep metni gelir.
 */

export interface ParsedVerification {
  roomNumber: string | null;
  firstName: string | null;  // Modül 10.2: zorunlu
  lastName: string | null;
  hasEmbeddedRequest: boolean;
  embeddedRequest: string | null;
}

// Türkçe/İngilizce/Almanca/Rusça/Arapça sık kullanılan stop word'ler
// (talep cümlelerinde geçen kelimeler — isim olarak alınmamalı)
const STOP_WORDS = new Set([
  // Mekan/keyword
  'oda', 'room', 'zimmer', 'номер', 'غرفة', 'no', 'numara', 'number',
  'soyad', 'soyadım', 'soyadı', 'lastname', 'surname', 'familyname',
  'ben', 'benim', 'ismim', 'adım', 'ad', 'name',

  // Bağlaçlar/zarflar
  've', 'ile', 'için', 'ama', 'fakat', 'lütfen', 'rica', 'ricam',
  'and', 'with', 'for', 'please', 'just', 'now', 'also',
  'und', 'mit', 'für', 'bitte',

  // Talep fiilleri/sıfatları
  'lazım', 'gerek', 'var', 'yok', 'istiyorum', 'olur',
  'çalışmıyor', 'bozuk', 'kırık', 'eksik', 'kirli', 'temiz',
  'soğuk', 'sıcak', 'aldım', 'verdim', 'kullandım', 'gördüm',

  // F&B / HK / Technical kelimeleri (talep parse'ında geçer)
  'klima', 'klimam', 'kliması', 'klimanın',
  'tv', 'televizyon', 'televizyonum',
  'duş', 'duşum', 'banyo', 'banyom', 'tuvalet',
  'su', 'suyu', 'sıcaksu', 'sıcaksuyu',
  'havlu', 'havlum', 'bornoz', 'bornozum',
  'çarşaf', 'yastık', 'yastığım', 'battaniye', 'battaniyem',
  'minibar', 'minibarda', 'minibardaki',
  'bira', 'şarap', 'kahve', 'çay',
  'kahvaltı', 'öğle', 'akşam', 'yemek', 'yemeği',
  'roomservice',
  'wifi', 'internet', 'şifre', 'şifresi',
  'lamba', 'lambam', 'priz', 'elektrik',
  'temizlik', 'temizlemiş', 'temizlenmiş',
  'şikayet', 'rahatsız', 'iade', 'fatura',
]);

const ROOM_REGEX = /(?:oda|room|zimmer|номер|غرفة|no|numara|number)?\s*#?\s*(\d{2,4})/i;

export function parseVerificationInput(text: string): ParsedVerification {
  const result: ParsedVerification = {
    roomNumber: null,
    firstName: null,
    lastName: null,
    hasEmbeddedRequest: false,
    embeddedRequest: null,
  };

  if (!text || typeof text !== 'string') return result;

  const cleaned = text.trim().replace(/[,;:]/g, ' ');

  // 1) Oda numarası
  const roomMatch = cleaned.match(ROOM_REGEX);
  if (roomMatch) {
    result.roomNumber = roomMatch[1];
  }

  // 2) Oda numarasından sonraki kısımdan harf-only token'lar al, stop word'leri at
  const afterRoom = result.roomNumber
    ? cleaned.slice(cleaned.indexOf(result.roomNumber) + result.roomNumber.length)
    : cleaned;

  const tokens = afterRoom
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => /^[\p{L}'-]{2,}$/u.test(t))   // harf, kesme, tire (O'Brien, Al-Saleh)
    .filter((t) => !STOP_WORDS.has(t.toLowerCase()));

  // 3) En az 2 token gerekiyor: firstName + lastName
  if (tokens.length >= 2) {
    result.lastName = tokens[tokens.length - 1];
    result.firstName = tokens.slice(0, -1).join(' '); // "Mehmet Ali" gibi çoklu ad desteklenir
  } else if (tokens.length === 1) {
    // Yetersiz — sadece tek isim verilmiş, parse fail
    result.firstName = null;
    result.lastName = null;
  }

  // 4) Embedded request kontrolü
  if (result.roomNumber && result.firstName && result.lastName) {
    const lowerText = cleaned.toLowerCase();
    const requestStopWords = [
      'klima', 'klimam', 'tv', 'televizyon', 'duş', 'banyo', 'havlu', 'bornoz',
      'çarşaf', 'yastık', 'battaniye', 'minibar', 'bira', 'şarap', 'kahve',
      'çay', 'yemek', 'wifi', 'lamba', 'priz', 'elektrik', 'temizlik',
      'şikayet', 'iade', 'fatura', 'çalışmıyor', 'bozuk', 'kırık', 'eksik',
      'kirli', 'soğuk', 'sıcak', 'lazım', 'istiyorum',
    ];
    const stopWordHit = requestStopWords.some((sw) =>
      new RegExp(`\\b${sw}\\b`, 'iu').test(lowerText),
    );

    if (stopWordHit) {
      result.hasEmbeddedRequest = true;
      const stripped = cleaned
        .replace(new RegExp(`\\b${result.roomNumber}\\b`, 'g'), '')
        .replace(new RegExp(`\\b${result.firstName}\\b`, 'iu'), '')
        .replace(new RegExp(`\\b${result.lastName}\\b`, 'iu'), '')
        .replace(/(?:oda|room|zimmer|номер|no|numara|number)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      result.embeddedRequest = stripped.length > 3 ? stripped : null;
    }
  }

  return result;
}

/**
 * Modül 10.2: inhouse_guests'ta 3'lü AND eşleşme ara.
 * Match kuralı:
 *  - room_number eşit (TEXT karşılaştırma)
 *  - first_name ILIKE eşit (case-insensitive)
 *  - last_name  ILIKE eşit (case-insensitive)
 *  - is_active = true
 *  - check_out_date >= bugün
 */
export async function verifyGuest(
  supa: SupabaseClient,
  roomNo: string,
  firstName: string,
  lastName: string,
): Promise<VerifyResult> {
  const trimmedRoom = roomNo.trim();
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();

  if (!trimmedRoom || !trimmedFirst || !trimmedLast) {
    return { matched: false, reason: 'format_error' };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supa
    .from('inhouse_guests')
    .select('id, full_name, first_name, last_name, room_number, language, gender, check_in_date, check_out_date')
    .eq('room_number', trimmedRoom)
    .ilike('first_name', trimmedFirst)
    .ilike('last_name', trimmedLast)
    .eq('is_active', true)
    .gte('check_out_date', today)
    .maybeSingle();

  if (error) {
    console.error('[verify-guest] Supabase error:', error.message);
    return { matched: false, reason: 'no_match' };
  }

  if (!data) {
    return { matched: false, reason: 'no_match' };
  }

  return {
    matched: true,
    guestId: data.id as string,
    guestFullName: (data.full_name as string) ?? `${data.first_name} ${data.last_name}`,
    guestFirstName: (data.first_name as string | null) ?? undefined,
    guestLastName: (data.last_name as string | null) ?? undefined,
    guestLanguage: (data.language as string | null) ?? undefined,
    guestGender: (data.gender as 'male' | 'female' | null) ?? null,
    roomNo: data.room_number as string,
  };
}

/**
 * Conversation doğrulama state'i hâlâ geçerli mi?
 * Modül 10.2: TTL kontrol artık sadece fallback için kullanılıyor.
 * Asıl kontrol webhook'ta check_out_date >= bugün kontrolüyle yapılıyor.
 */
export function isVerificationValid(verifiedAt: string | null): boolean {
  if (!verifiedAt) return false;
  const ageMs = Date.now() - new Date(verifiedAt).getTime();
  const ttlMs = VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
  return ageMs < ttlMs;
}
