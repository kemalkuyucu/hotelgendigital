// ── PAYLASILAN TELEFON DEDEKTORU (TEK KAYNAK) ────────────────────────────────
//
// Neden tek kaynak: ayni tespit iki yerde yasarsa biri degisince digeri kayar
// (isInfoQuestion dersi). Telefon yakalayan HER yol bu modulu kullanir; ikinci
// bir regex kopyasi YAZILMAZ.
//
// Kalip route.ts'teki SPA iletisim kapisindan AYNEN alindi (davranis-notr):
// en az 10 hane, arada bosluk/parantez/nokta/tire serbest, basta opsiyonel '+'.
// Deterministik (KALICI KARAR #3) — LLM'e sorulmaz.

export const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/;

/**
 * Metinden ilk telefon numarasini cikarir. Bulamazsa null.
 * Kirpma disinda NORMALIZE ETMEZ — misafirin yazdigi bicim personele aynen gider.
 */
export function extractPhone(text: string): string | null {
  const m = String(text ?? '').match(PHONE_RE);
  return m ? m[0].trim() : null;
}
