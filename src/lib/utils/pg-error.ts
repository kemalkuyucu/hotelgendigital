/**
 * PostgreSQL/PostgREST HATA KODU KARARI — SAF: IO/ag/LLM YOK, yan etki YOK.
 *
 * supabase-js hata FIRLATMAZ, `{ data, error }` doner; `error.code` PostgreSQL'in
 * SQLSTATE'idir. Bu modul o kodun okunmasini TEK YERE baglar — cagri yerinde
 * `err.code === '23505'` YAZILMAZ (ikinci kopya = biri degisince digerinin sessizce
 * kaymasi; ayrica ham kod sabiti cagri yerlerine dagilir).
 *
 * 23505 = unique_violation. KARAR YALNIZ KODA BAKAR:
 *   - `error.message` ("duplicate key value violates unique constraint ...") OLCUT
 *     DEGILDIR — mesaj metni surum/lokalizasyon ile degisebilir, kod degismez.
 *   - Tip KATI: sayi 23505 (string degil) `false` doner. PostgREST kodu daima
 *     string tasir; gevsek karsilastirma baska bir kaynagi sessizce kabul ederdi.
 */

/** supabase-js `PostgrestError` bu sekle uyar; null/undefined de kabul edilir. */
export type MaybePgError = { code?: unknown } | null | undefined;

/** Hata bir UNIQUE constraint ihlali mi (SQLSTATE 23505)? */
export function isUniqueViolation(error: MaybePgError): boolean {
  return error?.code === '23505';
}
