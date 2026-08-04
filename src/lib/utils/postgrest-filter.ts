/**
 * PostgREST filtre-degeri temizleyicisi — TEK KAYNAK (§3 "tekrarlanan karar").
 *
 * KOK SORUN: `.or()` bir PostgREST FILTRE DILI ifadesi alir, parametre DEGIL:
 *   or=(room_number.ilike.%x%,last_name.ilike.%x%)
 * Kullanici girdisi bu stringe interpolate edilince girdideki `,` `(` `)` `.`
 * karakterleri AYRAC olarak ayrisir ve saldirgan ifadeye YENI kosul ekleyebilir
 * (ornek: arama kutusuna `x,is_active.eq.false` yazmak). SQL injection DEGIL —
 * PostgREST degerleri parametrelestirir — ama FILTRE injection'dir: sorgunun
 * hangi satirlari dondurdugu degistirilebilir.
 *
 * COZUM: ayrac karakterlerini bosluga cevir. Normal arama girdisinde (oda no,
 * soyad) bu karakterler BULUNMAZ -> davranis-korur / pratikte no-op.
 * `'` KASITLI OLARAK KORUNUR: PostgREST ayraci degildir ve apostroflu isimler
 * ("O'Brien") aranabilir kalmalidir.
 *
 * `*` de temizlenir: PostgREST `ilike` icinde `%` ile ayni anlama gelen bir
 * joker karakterdir, kullanici girdisinden gelmesi istenmez.
 */
export function sanitizeOrFilterValue(raw: string): string {
  return raw
    .replace(/[,()."\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
