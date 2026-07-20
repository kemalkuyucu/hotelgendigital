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
import { normalizeTr } from '@/lib/utils/normalize-tr';

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

/**
 * C2 — IMPORT'TA TELEGRAM DAMGASINI TASIMA PLANI (saf; IO YOK).
 *
 * Import anahtari "room_number::check_in_date" oldugu icin ayni misafir yeni bir
 * check_in ile yuklendiginde eski satir ARSIVLENIR ve YENI id ile satir acilir ->
 * telegram_id arsivde kalir (C1'in onardigi kirilmanin KAYNAGI). Burada damga yeni
 * satira TASINIR ki kirilma hic olusmasin.
 *
 * GIZLILIK BIRINCI KURAL: damga yanlis kisiye gecerse o misafir BASKASININ odasini/
 * talebini gorur. Bu yuzden tasima YALNIZCA ayni oda + AYNI ISIM ciftinde ve yalnizca
 * TEK-ANLAMLI eslesmede yapilir. Supheli her durumda TASIMA YOK (yeni misafir sifirdan
 * dogrular; oksuz kalan arsiv damgasi zararsizdir, hicbir sorgu arsivli satiri okumaz).
 *
 * Elenen belirsizlikler:
 *   - eslesme 0 veya >1 ise            -> o damga tasinmaz
 *   - bir hedef satiri >1 damga talep ederse -> HICBIRI tasinmaz
 *   - ayni telegram_id birden fazla hedefe giderse -> HICBIRI tasinmaz (tek-damga)
 * Isim karsilastirmasi paylasilan normalizeTr uzerinden (IKINCI NORMALIZER YOK);
 * yalnizca bosluk sadelestirmesi eklenir ("KEMAL  KUYUCU" === "Kemal Kuyucu"), bu
 * iki FARKLI ismi asla esitleyemez.
 */
export interface ArchivedStampRow {
  id: string;
  room_number: string;
  guest_name: string;
  telegram_id?: string | null;
}

export interface InsertedGuestRow {
  id: string;
  room_number: string;
  guest_name: string;
}

export interface TelegramCarry {
  fromId: string;
  toId: string;
  telegramId: string;
  roomNumber: string;
}

function carryKey(s: unknown): string {
  return normalizeTr(String(s ?? '')).trim().replace(/\s+/g, ' ');
}

export function planTelegramCarryOver(
  archived: ArchivedStampRow[],
  inserted: InsertedGuestRow[],
): TelegramCarry[] {
  const claimsByTarget = new Map<string, TelegramCarry[]>();

  for (const old of archived ?? []) {
    const stamp = String(old?.telegram_id ?? '').trim();
    if (!stamp) continue;                       // damgasiz arsiv -> no-op
    const oldRoom = carryKey(old.room_number);
    const oldName = carryKey(old.guest_name);
    if (!oldRoom || !oldName) continue;         // oda/isim eksik -> tasima yok

    const matches = (inserted ?? []).filter(
      (n) => carryKey(n?.room_number) === oldRoom && carryKey(n?.guest_name) === oldName,
    );
    if (matches.length !== 1) continue;         // 0 (yeni misafir) veya belirsiz -> tasima yok

    const target = matches[0];
    const list = claimsByTarget.get(target.id) ?? [];
    list.push({ fromId: old.id, toId: target.id, telegramId: stamp, roomNumber: oldRoom });
    claimsByTarget.set(target.id, list);
  }

  // Hedefe TEK talep sarti (iki farkli hesap ayni satiri talep ediyorsa ikisi de dusér).
  const plan: TelegramCarry[] = [];
  for (const list of claimsByTarget.values()) {
    if (list.length === 1) plan.push(list[0]);
  }

  // Tek-damga invaryanti: ayni telegram_id birden fazla hedefe gidemez.
  const stampCount = new Map<string, number>();
  for (const c of plan) stampCount.set(c.telegramId, (stampCount.get(c.telegramId) ?? 0) + 1);
  return plan.filter((c) => stampCount.get(c.telegramId) === 1);
}
