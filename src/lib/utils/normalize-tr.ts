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
    // TR büyük harfler ÖNCE replace edilmeli — toLowerCase() sonrası:
    //   İ → "i̇" (i + U+0307 combining dot above) ≠ "i"  → HATALI
    //   Ğ → "ğ", Ş → "ş", Ö → "ö", Ü → "ü", Ç → "ç"  → sonra replace ile yakalanır
    // Bu nedenle İ/I önce, sonra geri kalanlar, en son .toLowerCase()
    .replace(/İ/g, 'i')    // büyük İ (noktalı) → i (ÖNCE!)
    .replace(/I/g, 'i')    // büyük I (Türkçe) → i
    .replace(/Ş/g, 's')    // büyük Ş
    .replace(/Ğ/g, 'g')    // büyük Ğ
    .replace(/Ü/g, 'u')    // büyük Ü
    .replace(/Ö/g, 'o')    // büyük Ö
    .replace(/Ç/g, 'c')    // büyük Ç
    .toLowerCase()          // geri kalan Latin büyük harfler + ş ğ ü ö ç ı
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i');   // noktalı-sız i
}
