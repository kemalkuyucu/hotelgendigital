import { createHash } from 'node:crypto';
import { normalizeTr } from './normalize-tr';

/**
 * LOG PII MASKELEME — misafir adinin HAM haliyle loglanmasini keser.
 *
 * KOK SORUN: dogrulama ve alerjen kapilari misafirin ad/soyadini ham string olarak
 * console'a basiyordu (`[verification] Deneniyor: ... firstName=Mehmet lastName=Akin`).
 * Vercel log'lari operasyon ekibinin gordugu, saklanan ve disari aktarilabilen bir
 * yuzeydir; oraya kimlik yazmak KVKK/GDPR anlaminda gereksiz bir yayilimdir. Ustelik
 * teshis icin ADIN KENDISI gerekmez — gereken "ayni misafir mi, farkli misafir mi".
 *
 * ODA NUMARASI MASKELENMEZ (bilincli): teshisin omurgasi odur ve tek basina kimlik
 * DEGILDIR. `allergen_text` zaten ayri bir sevkte maskelenmisti (cf961d0).
 *
 * NEDEN HASH, NEDEN KISALTMA DEGIL: "M*** A***" bas harfi sizdirir ve iki farkli
 * misafiri ayirt ETMEZ. Hash, ayni ismi ayni damgaya goturur (log satirlari
 * korelasyonu KORUNUR) ama ismi tasimaz.
 *
 * IKINCI NORMALIZER YASAK (§3): girdi paylasilan `normalizeTr`den gecer — boylece
 * "Mehmet" / "MEHMET" / "Mehmét" ayni damgayi uretir ve maskeleme, kod tabaninin
 * geri kalaniyla AYNI esitlik tanimini kullanir.
 */

/** Hash'in log'a basilan uzunlugu. Carpisma teshis icin onemsiz, satir kisa kalir. */
const DIGEST_LEN = 8;

/**
 * Ham ismi log'a uygun bir damgaya cevirir: `#<8 hex>/<uzunluk>`.
 *
 * Uzunluk BILINCLI olarak tasinir: "parse ismin tamamini mi aldi?" sorusu ancak
 * onunla cevaplanir. Tek basina uzunluk kimlik DEGILDIR.
 *
 * Bos/null/dize-olmayan girdi icin SABIT etiketler doner — bunlar da teshis
 * bilgisidir ("alan hic gelmedi" ile "bos geldi" ayni sey degildir).
 */
export function maskName(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '(yok)';
  const trimmed = raw.trim();
  if (!trimmed) return '(bos)';

  const digest = createHash('sha256').update(normalizeTr(trimmed)).digest('hex').slice(0, DIGEST_LEN);
  return `#${digest}/${trimmed.length}`;
}
