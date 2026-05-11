import type { SupabaseClient } from '@supabase/supabase-js';
import { VERIFICATION_TTL_HOURS } from '@/lib/ai/verification-intents';

export interface VerifyResult {
  matched: boolean;
  guestId?: string;
  guestFullName?: string;
  guestFirstName?: string;
  roomNo?: string;
  reason?: 'no_match' | 'format_error' | 'multiple_match';
}

/**
 * Misafir mesajından oda no + soyad çıkarmaya çalış.
 * Örüntüler:
 *  - "215 yılmaz"
 *  - "Oda 215, Yılmaz"
 *  - "215, soyadım Yılmaz"
 *  - "room 412 smith"
 */
export function parseVerificationInput(text: string): {
  roomNo: string | null;
  lastName: string | null;
} {
  const lower = text.trim().toLowerCase();

  // Oda no: ilk 2-4 haneli sayı (tek hane kabul edilmez)
  const roomMatch = lower.match(/\b(\d{2,4})\b/);
  const roomNo = roomMatch?.[1] ?? null;

  // Soyad: sayı sonrası kalan kısmı temizle
  let rest = lower;
  if (roomMatch) {
    rest = lower.slice(roomMatch.index! + roomMatch[0].length);
  }

  // "oda", "room", "soyad", "soyadım", "no", "numara" stop-word'leri at
  const cleaned = rest
    .replace(/\b(oda|room|soyad|soyad[ıi]m|no|numara|nr|chamber|zimmer|комната|غرفة)\b/gi, '')
    .replace(/[,.;:!?'"`]/g, ' ')
    .trim();

  // Kalan tüm harf token'larından SON kelimeyi soyad kabul et ("Ad Soyad" sırası)
  const tokens = cleaned.split(/\s+/).filter((t) => /^[\p{L}]{2,}$/u.test(t));
  const lastName = tokens.length > 0 ? tokens[tokens.length - 1] : null;

  return { roomNo, lastName };
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
    .select('id, full_name, first_name, room_number, last_name, check_in_date, check_out_date')
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
