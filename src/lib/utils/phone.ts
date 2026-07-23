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

// ── AR/FA rakam normalizasyonu ───────────────────────────────────────────────
// `\d` yalniz ASCII eslestirir; AR/FA misafir kendi rakamlariyla yazdiginda numara
// HIC gorulmuyordu -> lead akisi "numaranizi alamadim" deyip kapaniyordu.
//
// RTL TUZAGI — cevrim codePoint DONGUSU ile yapilir, REGEX ARALIGI YOK ve bu blokta
// hicbir non-ASCII karakter GECMEZ. Gerekce: aralik uclari Arapca rakam karakteriyle
// yazilan bir karakter sinifi (/[..-..]/) kaynak dosyada gorsel/mantiksal sira
// ayrisabildigi icin ters kaydedilebilir; ters aralik "Range out of order in character
// class" ile MODUL YUKLENIRKEN patlar ve phone.ts'i import eden her sey (lead-capture,
// route, tum test:is8) coker. Sinirlar SAYISAL kod noktasi olunca bu hata sinifi
// yapisal olarak imkansizlasir.
//   Arap-Hint : U+0660..U+0669
//   Fars-Hint : U+06F0..U+06F9
const AR_DIGIT_START = 0x0660;
const FA_DIGIT_START = 0x06f0;

/** AR/FA rakamlarini ASCII'ye cevirir; diger karakterlere DOKUNMAZ. */
export function toAsciiDigits(text: string): string {
  let out = '';
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= AR_DIGIT_START && c <= AR_DIGIT_START + 9) out += String(c - AR_DIGIT_START);
    else if (c >= FA_DIGIT_START && c <= FA_DIGIT_START + 9) out += String(c - FA_DIGIT_START);
    else out += ch;
  }
  return out;
}

/**
 * Metinden ilk telefon numarasini cikarir. Bulamazsa null.
 * ASCII rakamli girdide bicim AYNEN korunur (kirpma disinda degistirilmez).
 * AR/FA rakamli girdide yalnizca RAKAMLAR ASCII'ye cevrilir — ayraclar korunur;
 * personele okunabilir numara gitmesi icin bu cevrim istenen davranistir.
 */
export function extractPhone(text: string): string | null {
  const m = toAsciiDigits(text).match(PHONE_RE);
  return m ? m[0].trim() : null;
}
