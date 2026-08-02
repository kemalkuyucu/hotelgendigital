/**
 * BACKLOG #13 — MISAFIR ADI ESLESMESI: TEK KAYNAK + TAM KELIME.
 *
 * KOK SORUN: misafir adi UC AYRI yerde inline karsilastiriliyordu ve ucu de
 * SUBSTRING calisiyordu:
 *   1. route.ts [17c-rn]  -> gn.includes(fullName) || gn.includes(lastName)
 *   2. route.ts 17.7-B    -> yerel `normalise` + includes + find() (ilk-alma)
 *   3. verify-guest.ts    -> normName.includes(first) && normName.includes(last)
 * Substring, ismin BIR PARCASINI kimlik kaniti sayar: odada "Ayse Akin" kayitliyken
 * "102 Mehmet Ak" mesaji site 1'de eslesir ('akin' icinde 'ak' gecer) ve YANLIS KISIYE
 * telegram_id damgasi atilir -> misafir baskasinin odasini/taleplerini gorur
 * (CLAUDE.md §3 KIMLIK/LINK TASIMA ihlali). Karar burada TEK yerde yasar.
 *
 * KARAR — "DENGELI": ad ve soyad TAM KELIME olarak eslesir; orta isimler IKI TARAFTA
 * da yok sayilir. Yani "Mehmet Kaya" hem "Mehmet Ali Kaya" kaydiyla, hem de kayit
 * "Mehmet Kaya" iken "Mehmet Ali Kaya" yazan misafirle eslesir; ama 'ak' ile 'akin'
 * ASLA eslesmez. (Tam-dize esitligi cok kati olurdu: pasaport/PMS kayitlarinda orta
 * isim var/yok farki yaygin ve gercek misafiri kilitlerdi.)
 *
 * SAF: IO / ag / LLM YOK. Normalize paylasilan normalizeTr (IKINCI NORMALIZER YASAK —
 * 17.7-B'nin yerel `normalise`'i bu yuzden kalkti: "Sahin" yazan misafir orada
 * "Sahin" kaydiyla eslesMIYORdu, site 1/3'te eslesiyordu = iki farkli gercek).
 *
 * TEK-ANLAMLILIK BU MODULDE DEGIL: fonksiyonlar tek bir aday icin "eslesiyor mu?"
 * sorusuna cevap verir. "Kac aday eslesti?" karari (0/1/>1) CAGIRANA aittir; her uc
 * cagri yerinde de damga YALNIZCA TEK eslesmede atilir.
 */
import { normalizeTr } from '@/lib/utils/normalize-tr';

/** normalizeTr + bosluga gore parcalama. Bos token uretmez ("  a  b " -> ['a','b']). */
function tokenize(s: string | null | undefined): string[] {
  return normalizeTr(String(s ?? ''))
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * PARSE EDILMIS giris icin (ad ve soyad AYRI alanlarda gelir — parseVerificationInput
 * ya da dogrulama formu). Cok kelimeli ad/soyadda ilk ad + son soyad token'i olcut
 * alinir: "Mehmet Ali" -> 'mehmet', "Al Saleh" -> 'saleh'.
 *
 * Ad ya da soyad bos/bosluk ise FALSE (kimlik kaniti yok).
 */
export function matchesGuestName(
  dbName: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): boolean {
  const db = tokenize(dbName);
  const f = tokenize(firstName)[0];
  const l = tokenize(lastName).at(-1);
  if (!f || !l) return false;
  return db.includes(f) && db.includes(l);
}

/**
 * HAM METIN icin (misafir adini serbest yaziyor — 17.7-B coklu eslesme dali).
 * Ilk token = ad, SON token = soyad. Arasi (orta isim) yok sayilir.
 *
 * TABAN SART: en az 2 kelime. Tek kelime kimlik kaniti DEGILDIR — eski kodda tek
 * harflik bir mesaj bile adayla eslesebiliyordu ve o dal tanimi geregi odada birden
 * fazla misafir varken calisir.
 */
export function matchesGuestNameFromText(
  dbName: string | null | undefined,
  typedText: string | null | undefined,
): boolean {
  const t = tokenize(typedText);
  if (t.length < 2) return false;
  const db = tokenize(dbName);
  return db.includes(t[0]) && db.includes(t[t.length - 1]);
}

/**
 * Iki TAM ISIM AYNI misafiri mi? (reception-approval GUARD B = site 5).
 * Ilk token=ad, son token=soyad; orta isimler iki tarafta yok sayilir.
 * Tek normalizer (tokenize->normalizeTr) -> "Sahin"~"Sahin(diakritikli)" ayni.
 * Bos taraf -> false. Tek-token tarafta ilk=son ayni token.
 */
export function sameGuestByText(
  nameA: string | null | undefined,
  nameB: string | null | undefined,
): boolean {
  const a = tokenize(nameA);
  const b = tokenize(nameB);
  if (a.length === 0 || b.length === 0) return false;
  return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
}

/**
 * Iki SOYAD ayni mi? Son token (whole-word); cok-tokenlu soyadda
 * ("Al Saleh"~"Saleh") gereksiz farkliligi onler (route.ts re-verify = site 6).
 * Tek normalizer. Bos taraf -> false.
 */
export function sameLastName(
  lastA: string | null | undefined,
  lastB: string | null | undefined,
): boolean {
  const a = tokenize(lastA).at(-1);
  const b = tokenize(lastB).at(-1);
  if (!a || !b) return false;
  return a === b;
}
