import type { SupabaseClient } from '@supabase/supabase-js';
import { VERIFICATION_TTL_HOURS } from '@/lib/ai/verification-intents';
import { normalizeTr } from '@/lib/utils/normalize-tr';

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

// normalizeTr → @/lib/utils/normalize-tr (ortak util — iki yerde farklı normalize YASAK)

/**
 * Modül 10.2 v2: inhouse_guests_v2 önce sorgulanır (v2 şeması: room_number TEXT,
 * guest_name TEXT tek alan, status, check_out_date).
 * v2'de kayıt bulunamazsa eski inhouse_guests'a fallback yapılır.
 *
 * v2 match kuralı:
 *  - room_number = trimmedRoom (TEXT)
 *  - status = 'active'
 *  - check_out_date >= bugün
 *  - guest_name içinde BOTH firstName AND lastName geçmeli (case-insensitive + Türkçe tolerans)
 *
 * Eski tablo match kuralı:
 *  - room_number eşit, first_name ILIKE, last_name ILIKE, is_active=true, check_out >= bugün
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
  const normFirst = normalizeTr(trimmedFirst);
  const normLast = normalizeTr(trimmedLast);

  // ── ADIM 1: inhouse_guests_v2 (öncelikli) ────────────────────────────────
  const { data: v2Rows, error: v2Error } = await supa
    .from('inhouse_guests_v2')
    .select('id, guest_name, room_number, status, check_out_date')
    .eq('room_number', trimmedRoom)
    .eq('status', 'active')
    .gte('check_out_date', today);

  if (v2Error) {
    console.error('[verify-guest] v2 Supabase error:', v2Error.message);
    // v2 hata verdi → eski tabloya düş
  } else if (v2Rows && v2Rows.length > 0) {
    // JS tarafında guest_name içinde her iki token'ı ara (Türkçe tolerant)
    const v2Match = v2Rows.find((row) => {
      const normName = normalizeTr((row.guest_name as string) ?? '');
      return normName.includes(normFirst) && normName.includes(normLast);
    });

    if (v2Match) {
      // guest_name'i firstName/lastName olarak parçala (son kelime = soyad)
      const guestNameRaw = (v2Match.guest_name as string).trim();
      const nameParts = guestNameRaw.split(/\s+/);
      const parsedLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : guestNameRaw;
      const parsedFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : null;

      console.log('[verify-guest] v2 eşleşme BULUNDU', {
        room: trimmedRoom,
        guest_name: guestNameRaw,
        v2RowId: v2Match.id,
      });

      return {
        matched: true,
        guestId: v2Match.id as string,
        guestFullName: guestNameRaw,
        guestFirstName: parsedFirst ?? undefined,
        guestLastName: parsedLast ?? undefined,
        guestLanguage: undefined,
        guestGender: null,
        roomNo: v2Match.room_number as string,
      };
    } else {
      console.log('[verify-guest] v2 oda kaydı var ama isim eşleşmedi', {
        room: trimmedRoom,
        normFirst,
        normLast,
        v2Rows: v2Rows.map((r) => r.guest_name),
      });
      return { matched: false, reason: 'no_match' };
    }
  } else {
    // v2'de bu oda için aktif kayıt yok → eski tabloya düş
    console.log('[verify-guest] v2 kayıt yok, eski tabloya fallback', { room: trimmedRoom });
  }

  // ── ADIM 2: inhouse_guests (eski — geri uyumluluk fallback) ──────────────
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
    console.error('[verify-guest] Supabase error (legacy):', error.message);
    return { matched: false, reason: 'no_match' };
  }

  if (!data) {
    return { matched: false, reason: 'no_match' };
  }

  console.log('[verify-guest] legacy eşleşme BULUNDU', { room: trimmedRoom, guestId: data.id });

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
