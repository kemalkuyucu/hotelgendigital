// =============================================================================
// src/lib/auth/jwt-secret.ts
// AUDIT S2 — Tek kaynak JWT secret çözümleyici (hotel-admin + group-admin + middleware ortak)
//
// ⚠️  Edge-safe: yalnızca process.env + TextEncoder kullanır, başka bağımlılık YOK.
//     Bu yüzden hem Node (auth.ts) hem Edge (middleware.ts) tarafından import edilebilir.
//
// Davranış:
//   - HOTEL_ADMIN_JWT_SECRET veya NEXTAUTH_SECRET set ise onu kullan.
//   - İkisi de yoksa:
//       • production → fail-fast (throw): bilinen literal ile imza ATILMAZ.
//       • development → dev literal'a düş (yerel geliştirme rahatlığı).
// =============================================================================

const DEV_FALLBACK_SECRET = 'hotel-admin-dev-secret-change-in-production';

export function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.HOTEL_ADMIN_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT secret tanımlı değil: production ortamında HOTEL_ADMIN_JWT_SECRET ' +
          '(veya NEXTAUTH_SECRET) set edilmeli. Bilinen literal ile imza atılmasına izin verilmez.'
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  return new TextEncoder().encode(secret);
}
