/**
 * Modül 10: Doğrulama gerektiren intent'ler.
 * Bu intent'lerden biri tespit edildiğinde, bot önce oda no + soyad doğrulaması ister.
 * Doğrulama 24 saat geçerli, aynı conversation içinde.
 */
export const VERIFICATION_REQUIRED_INTENTS = [
  'allergy',           // Modül 11'de detaylı işlenecek
  'room_service',
  'complaint',
  'billing',
  'lost_and_found',
] as const;

export type VerificationIntent = typeof VERIFICATION_REQUIRED_INTENTS[number];

export function requiresVerification(intent: string | null): intent is VerificationIntent {
  if (!intent) return false;
  return (VERIFICATION_REQUIRED_INTENTS as readonly string[]).includes(intent);
}

// Doğrulama state TTL (saat)
export const VERIFICATION_TTL_HOURS = 24;

// Lockout — kaç başarısız denemeden sonra ön büroya yönlendir
export const MAX_VERIFICATION_ATTEMPTS = 3;
