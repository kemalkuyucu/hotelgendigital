/**
 * Modül 10: Doğrulama gerektiren intent'ler.
 * Bu intent'lerden biri tespit edildiğinde, bot önce oda no + ad + soyad doğrulaması ister.
 * Modül 10.2: Operasyonel intent'ler de dahil edildi — misafirin kim olduğunu bilmek gerekiyor.
 * Doğrulama check_out_date'e kadar geçerli, aynı conversation içinde.
 */
export const VERIFICATION_REQUIRED_INTENTS = [
  // Kişisel işlemler
  'allergy',
  'billing',
  'lost_and_found',
  // Şikayet
  'complaint',
  // Operasyonel
  'technical',
  'housekeeping',
  'fb',
  'spa',
  'animation',
  'room_service',
] as const;

export type VerificationIntent = typeof VERIFICATION_REQUIRED_INTENTS[number];

export function requiresVerification(intent: string | null): intent is VerificationIntent {
  if (!intent) return false;
  return (VERIFICATION_REQUIRED_INTENTS as readonly string[]).includes(intent);
}

// Doğrulama state TTL (saat) — fallback için, asıl kontrol check_out_date ile yapılıyor
export const VERIFICATION_TTL_HOURS = 24;

// Lockout — kaç başarısız denemeden sonra ön büroya yönlendir
export const MAX_VERIFICATION_ATTEMPTS = 3;
