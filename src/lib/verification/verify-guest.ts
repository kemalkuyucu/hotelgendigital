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
 * Misafirin gönderdiği mesajdan oda numarası ve soyad çıkarır.
 *
 * Stratejisi:
 *  1. Oda numarasını regex ile bul: "Oda 215", "room 312", "номер 408", "215" → 2-4 haneli sayı
 *  2. "soyadım X" / "soyad: X" / "lastname X" gibi keyword sonrası geleni öncelikle soyad al
 *  3. Yoksa: oda numarasından sonra kalan kelimelerden stop word'leri at, KALANLAR'ın
 *     SON harf-only kelimesini soyad olarak al
 *  4. roomNumber + lastName ikisi de varsa parse başarılı
 *
 * Ayrıca: mesajda talep cümlesi gömülü olabilir (ör. "Oda 312 Kuyucu, klimam çalışmıyor").
 * Bu durumda hasEmbeddedRequest=true döner ve embeddedRequest alanında talep metni gelir
 * (oda no + soyad + diğer kimlik kelimeleri çıkarıldıktan sonra geriye kalan).
 */

export interface ParsedVerification {
  roomNumber: string | null;
  lastName: string | null;
  hasEmbeddedRequest: boolean;
  embeddedRequest: string | null;
}

// Türkçe/İngilizce/Almanca/Rusça/Arapça sık kullanılan stop word'ler
// (talep cümlelerinde geçen kelimeler — soyad olarak alınmamalı)
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
const LASTNAME_HINT_REGEX =
  /(?:soyad(?:ım|ı|ım:|:)?|lastname:?|surname:?|familyname:?)\s+([\p{L}]{2,})/iu;

export function parseVerificationInput(text: string): ParsedVerification {
  const result: ParsedVerification = {
    roomNumber: null,
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

  // 2) "soyadım X" tipi hint öncelikli
  const hintMatch = cleaned.match(LASTNAME_HINT_REGEX);
  if (hintMatch) {
    result.lastName = hintMatch[1];
  } else {
    // 3) Oda numarasından sonraki kısma bak, stop word'leri at, son harf-only kelimeyi al
    const afterRoom = result.roomNumber
      ? cleaned.slice(cleaned.indexOf(result.roomNumber) + result.roomNumber.length)
      : cleaned;

    const tokens = afterRoom
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => /^[\p{L}]{2,}$/u.test(t)) // sadece harf-only, 2+ karakter
      .filter((t) => !STOP_WORDS.has(t.toLowerCase()));

    if (tokens.length > 0) {
      result.lastName = tokens[tokens.length - 1]; // SON kelime soyad
    }
  }

  // 4) Embedded request kontrolü
  // Eğer parse sonrası kalan kelimelerde stop word'lerden biri varsa → talep gömülü demektir
  if (result.roomNumber && result.lastName) {
    const lowerText = cleaned.toLowerCase();
    const stopWordHit = Array.from(STOP_WORDS).some((sw) => {
      // soyad/oda gibi parse keyword'leri sayma
      const skipList = new Set([
        'oda', 'room', 'zimmer', 'soyad', 'soyadım', 'no', 'numara',
        've', 'ile', 'için', 'and', 'with', 'for',
      ]);
      if (skipList.has(sw)) return false;
      // sw mesajın içinde geçiyor mu?
      return new RegExp(`\\b${sw}\\b`, 'iu').test(lowerText);
    });

    if (stopWordHit) {
      result.hasEmbeddedRequest = true;
      // Oda no ve soyadı mesajdan çıkar → kalan kısmı embeddedRequest yap
      const stripped = cleaned
        .replace(new RegExp(`\\b${result.roomNumber}\\b`, 'g'), '')
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
 * inhouse_guests'ta eşleşme ara.
 * Match kuralı:
 *  - room_number eşit (TEXT karşılaştırma)
 *  - lower(last_name) eşit
 *  - is_active = true
 *  - bugün check_in_date ile check_out_date arasında (dahil)
 */
export async function verifyGuest(
  supa: SupabaseClient,
  roomNo: string,
  lastName: string,
): Promise<VerifyResult> {
  const trimmedRoom = roomNo.trim();
  const trimmedName = lastName.trim().toLowerCase();

  if (!trimmedRoom || !trimmedName) {
    return { matched: false, reason: 'format_error' };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supa
    .from('inhouse_guests')
    .select('id, full_name, first_name, last_name, room_number, language, gender, check_in_date, check_out_date')
    .eq('room_number', trimmedRoom)
    .eq('is_active', true)
    .lte('check_in_date', today)
    .gte('check_out_date', today);

  if (error) {
    console.error('[verify-guest] Supabase error:', error.message);
    return { matched: false, reason: 'no_match' };
  }

  if (!data || data.length === 0) {
    return { matched: false, reason: 'no_match' };
  }

  // Soyad case-insensitive eşleşme
  const match = data.find(
    (g) => (g.last_name as string).trim().toLowerCase() === trimmedName,
  );

  if (!match) {
    return { matched: false, reason: 'no_match' };
  }

  return {
    matched: true,
    guestId: match.id as string,
    guestFullName: (match.full_name as string) ?? `${match.last_name}`,
    guestFirstName: (match.first_name as string | null) ?? undefined,
    guestLastName: (match.last_name as string) ?? undefined,
    guestLanguage: (match.language as string | null) ?? undefined,
    guestGender: (match.gender as 'male' | 'female' | null) ?? null,
    roomNo: match.room_number as string,
  };
}

/**
 * Conversation doğrulama state'i hâlâ geçerli mi?
 */
export function isVerificationValid(verifiedAt: string | null): boolean {
  if (!verifiedAt) return false;
  const ageMs = Date.now() - new Date(verifiedAt).getTime();
  const ttlMs = VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
  return ageMs < ttlMs;
}
