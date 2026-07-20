/**
 * C1 — BAYAT INHOUSE LINK TESPITI.
 *
 * conversations.inhouse_match_guest_id'nin DOLU olmasi "misafir bagli" demek DEGIL:
 * inhouse re-import'u eski satiri arsivleyip ayni oda icin YENI active satir uretince
 * isaretci ARSIVLI satirda kalir. Kart/pax sorgulari "telegram_id = <chat> AND
 * status = 'active'" istedigi icin hicbir sey bulamaz ("Oda bilinmiyor"), ama cagiran
 * taraf isaretci dolu diye "bagli" saydigi surece 17.c yeniden-eslesme yollari da
 * ACILMAZ -> link kendini ASLA onaramaz (canli: 2026-07-19 re-import, oda 312).
 *
 * Bu yuzden karar isaretcinin DOLULUGUNA degil, isaret edilen SATIRIN durumuna bakar.
 * Olcut route.ts:850 / 2784'teki mevcut sorgularla AYNI: status='active' VE
 * check_out_date bugunden geri degil (ISO 'YYYY-MM-DD' string karsilastirmasi, .gte
 * ile birebir ayni semantik; NULL check_out_date her ikisinde de DISARIDA kalir).
 */
export interface InhouseLinkRow {
  status?: string | null;
  check_out_date?: string | null;
}

export function isInhouseRowLinkable(
  row: InhouseLinkRow | null | undefined,
  today: string,
): boolean {
  if (!row) return false;                    // satir silinmis / bulunamadi
  if (row.status !== 'active') return false; // arsivli -> BAYAT
  const checkOut = row.check_out_date;
  if (typeof checkOut !== 'string' || checkOut.length === 0) return false;
  return checkOut >= today;                  // konaklama bitmis -> BAYAT
}
