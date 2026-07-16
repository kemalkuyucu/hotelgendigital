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
