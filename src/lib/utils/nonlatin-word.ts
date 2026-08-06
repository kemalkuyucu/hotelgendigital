/**
 * NON-LATIN KELIME SINIRI — backlog #9.
 *
 * KOK SORUN: non-latin anahtar kelimeler bugun `includes` (SUBSTRING) ile taranir.
 * Bunun gerekcesi saglamdir (JS `\b` ASCII `\w` tabanlidir; `\bсвадьба` HICBIR
 * ZAMAN eslesmez -> sessiz olu kod) ve RU cekim eklerini bedava kapsar. AMA iki
 * uye bu yuzden LISTEDEN CIKARILMAK ZORUNDA KALDI:
 *   · 'зал'  (salon)  -> сказал / вокзал / показал ICINDE gecer
 *   · 'день' (gun)    -> деньги (para) ICINDE gecer
 * Ikisi de kaldirildi ve kaynakta "geri EKLEME, kelime siniri gerekir" notu birakildi.
 *
 * COZUM: `\b` yerine UNICODE lookaround. `\p{L}` (herhangi bir harf) `u` bayragiyla
 * Kiril/Arap harflerini de sayar; `(?<!\p{L})X(?!\p{L})` "X'in iki yaninda da harf
 * YOK" demektir — yani gercek bir kelime siniri. Lookbehind Node 18+'ta destekli,
 * bu kod yalnizca sunucuda kosar.
 *
 * SUBSTRING LISTELERININ YERINI ALMAZ: mevcut uyeler AYNEN `includes` ile taranmaya
 * devam eder (cekim eki kapsamini kaybetmemek icin). Bu modul yalniz "yanlis-pozitif
 * yuzunden disarida kalmis" uyeler icindir — davranis ADDITIVE'dir.
 */

/** Regex-ozel karakterleri kacir (uyeler sabit olsa da tek kaynakta kalsin). */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CACHE = new Map<string, RegExp>();

function wordRe(word: string): RegExp {
  let re = CACHE.get(word);
  if (!re) {
    re = new RegExp(`(?<!\\p{L})${escapeForRegex(word)}(?!\\p{L})`, 'u');
    CACHE.set(word, re);
  }
  return re;
}

/**
 * `word` metinde TAM KELIME olarak geciyor mu? (iki yaninda da harf YOK)
 *
 * Tire/bosluk/noktalama sinir SAYILIR: "конференц-зал" -> 'зал' ESLESIR
 * (onundeki '-' harf degil). "вокзал" -> ESLESMEZ ('к' harf).
 */
export function matchesNonLatinWord(text: string, word: string): boolean {
  if (!text || !word) return false;
  return wordRe(word).test(text);
}

/** Listedeki HERHANGI bir kelime tam-kelime olarak geciyor mu? */
export function matchesAnyNonLatinWord(text: string, words: readonly string[]): boolean {
  return words.some((w) => matchesNonLatinWord(text, w));
}
