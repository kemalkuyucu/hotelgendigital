/**
 * Kategori key'ini insan-okur etikete cevirir (etiket haritasinda karsiligi yoksa fallback).
 * alt tire -> bosluk, her kelimenin bas harfi buyuk. Ornek: 'pratik_bilgi' -> 'Pratik Bilgi'.
 */
export function prettify(cat: string): string {
  return cat
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Serbest-TEXT kategori key'ini etikete cevirir: etiket haritasinda varsa onu,
 * yoksa prettify fallback. labels tipi Record<string,string> (serbest key kabul eder).
 */
export function categoryLabel(cat: string, labels: Record<string, string>): string {
  return labels[cat] ?? prettify(cat);
}
