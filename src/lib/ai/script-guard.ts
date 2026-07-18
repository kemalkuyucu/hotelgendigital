// Deterministik alfabe kapisi — LLM DEGIL (KALICI KURAL #3).
// Bug: "klima calismiyor" (Latin) -> cevap Telugu+Latin karisik geldi.
// Unicode property escape (\p{Script=}) KULLANMADIK — acik \uXXXX araligi (derleyici riski yok).
const SCRIPT_RANGES: ReadonlyArray<readonly [string, RegExp]> = [
  ['Latin', /[A-Za-zÀ-ɏḀ-ỿ]/],
  ['Cyrillic', /[Ѐ-ԯ]/],
  ['Greek', /[Ͱ-Ͽἀ-῿]/],
  ['Arabic', /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/],
  ['Hebrew', /[֐-׿]/],
  ['Armenian', /[԰-֏]/],
  ['Georgian', /[Ⴀ-ჿ]/],
  ['Devanagari', /[ऀ-ॿ]/],
  ['Bengali', /[ঀ-৿]/],
  ['Tamil', /[஀-௿]/],
  ['Telugu', /[ఀ-౿]/],
  ['Kannada', /[ಀ-೿]/],
  ['Malayalam', /[ഀ-ൿ]/],
  ['Thai', /[฀-๿]/],
  ['Han', /[㐀-䶿一-鿿]/],
  ['Hiragana', /[぀-ゟ]/],
  ['Katakana', /[゠-ヿ]/],
  ['Hangul', /[ᄀ-ᇿ가-힯]/],
];

export function scriptsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const ch of text) {
    const hit = SCRIPT_RANGES.find(([, re]) => re.test(ch));
    if (hit) out.add(hit[0]);
  }
  return out;
}

// Misafirin YAZMADIGI ve Latin OLMAYAN bir alfabe cevaba sizmis mi?
export function hasForeignScript(guestMessage: string, replyText: string): boolean {
  const guest = scriptsOf(guestMessage);
  if (guest.size === 0) return false;  // misafir harf yazmadi (rakam/emoji) -> yargilama
  const allowed = new Set(guest);
  allowed.add('Latin');                // otel adi / link / ozel isim Latin kalabilir
  for (const s of scriptsOf(replyText)) if (!allowed.has(s)) return true;
  return false;
}
