/**
 * Modül 10: Doğrulama gerektiren intent'ler.
 * Bu intent'lerden biri tespit edildiğinde, bot önce oda no + ad + soyad doğrulaması ister.
 * Modül 10.2: Operasyonel intent'ler de dahil edildi — misafirin kim olduğunu bilmek gerekiyor.
 * Doğrulama check_out_date'e kadar geçerli, aynı conversation içinde.
 */
export const VERIFICATION_REQUIRED_INTENTS = [
  // Kişisel işlemler
  // 'allergy' — allergy artık doğrulama gerektirmiyor; bildirim akışına doğrudan gider
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

/**
 * İŞ 9 — doğrulanmamış misafirde boşa giden department brain (callAI) çağrısını keser.
 *
 * Neden: requiresVerification(department) olan bir talepte misafir doğrulanmamışsa
 * brain callAI ile çağrılıp metin üretiyor, ardından route.ts'teki doğrulama gate'i
 * o metni "oda numaranızı paylaşın" mesajıyla EZİYOR. Üretilen metin misafire HİÇ
 * ulaşmıyor → boşa LLM maliyeti. Guard yalnız çağrıyı atlar; misafire giden metin
 * (gate'in kendi mesajı) DEĞİŞMEZ.
 *
 * isVerified: "bu turda doğrulama gate'i brain metnini EZMEYECEK" birleşik kararı.
 * Çağıran taraf hesaplar (damga / kayıtlı doğrulama / mesajdaki kimlik bilgisi /
 * bilgi sorusu / alerji turu); burası saf karardır — IO yok, test edilebilir.
 * Şüpheliyse isVerified=true geçilir: yanlış kesme, boşa çağrıdan kötüdür.
 */
export function shouldSkipBrainForVerification(
  department: string | null,
  isVerified: boolean,
): boolean {
  return requiresVerification(department) && !isVerified;
}

// Doğrulama state TTL (saat) — fallback için, asıl kontrol check_out_date ile yapılıyor
export const VERIFICATION_TTL_HOURS = 24;

// Lockout — kaç başarısız denemeden sonra ön büroya yönlendir
export const MAX_VERIFICATION_ATTEMPTS = 3;
