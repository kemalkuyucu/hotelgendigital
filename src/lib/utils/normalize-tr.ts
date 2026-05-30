/**
 * Türkçe karakter normalize: büyük/küçük + Türkçe özel harf toleransı.
 *
 * Dönüşüm tablosu:
 *   İ / I  → i
 *   Ş / ş  → s
 *   Ğ / ğ  → g
 *   Ü / ü  → u
 *   Ö / ö  → o
 *   Ç / ç  → c
 *   ı      → i
 *
 * Kullanım yerleri:
 *   - verify-guest.ts  (misafir adı eşleştirme)
 *   - hotel-context.ts (detectInterestTag keyword eşleştirme)
 *
 * Her iki yerde aynı fonksiyon kullanılır — iki farklı normalize YASAK.
 */
export function normalizeTr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[İI]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .replace(/ı/g, 'i');
}
