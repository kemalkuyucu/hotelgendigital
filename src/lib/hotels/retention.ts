/**
 * Otel soft-delete RETENTION karari — TEK KAYNAK.
 *
 * "Bu otel ne zaman kalici silinir?" sorusunun cevabini SADECE burasi verir:
 * cron (otomatik purge), panel rozeti (geri sayim) ve manuel purge guard'i
 * ayni fonksiyonu cagirir. Ikinci bir esik/aritmetik kopyasi YAZILMAZ
 * (CLAUDE.md §3 "tekrarlanan karar tek kaynakta").
 *
 * SAF: IO/ag/DB/LLM YOK. `now` DISARIDAN verilir -> deterministik, test edilebilir
 * ve sunucu saati tek noktadan gelir (istemci saatine ASLA guvenilmez).
 */

/** Soft-delete sonrasi kalici silmeye kadar gecen sure. Esik KODDA, LLM'de degil. */
export const PURGE_RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;

export interface PurgeInfo {
  /** deleted_at okunabildi mi? (false -> otel silinmemis YA DA veri bozuk) */
  deleted: boolean;
  /** Kalici silme ani. deleted=false ise null. */
  purgeAt: Date | null;
  /** Kalan tam gun (yukari yuvarlanir, 0'in altina DUSMEZ). deleted=false ise null. */
  daysLeft: number | null;
  /** now >= purgeAt -> kalici silme zamani GELDI. */
  due: boolean;
}

const NOT_DELETED: PurgeInfo = { deleted: false, purgeAt: null, daysLeft: null, due: false };

/**
 * Ham `deleted_at` degerini retention kararina cevirir.
 *
 * FAIL-SAFE YONU: deger yok, bos ya da parse EDILEMIYORSA sonuc "silinmemis"tir
 * (`due:false`) -> bozuk bir tarih ASLA purge tetiklemez. Ters yon (supheliyse sil)
 * geri alinamaz veri kaybi olurdu.
 *
 * ARITMETIK SAF UTC ms UZERINDEN: locale, timezone ve DST hesaba GIRMEZ; iki
 * epoch-ms arasindaki fark her zaman mutlak sureyi verir. Tarih parcalarini
 * (`setDate` vb.) kullanmak Istanbul'da DST gecisinde bir saatlik kayma uretirdi.
 */
export function purgeInfo(
  deletedAt: string | Date | null | undefined,
  now: Date,
): PurgeInfo {
  if (deletedAt === null || deletedAt === undefined) return NOT_DELETED;

  const deletedMs = deletedAt instanceof Date ? deletedAt.getTime() : Date.parse(deletedAt);
  if (!Number.isFinite(deletedMs)) return NOT_DELETED;

  const purgeMs = deletedMs + PURGE_RETENTION_DAYS * DAY_MS;
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return NOT_DELETED;

  // Alt clamp VAR (gecmis -> 0), ust clamp YOK: ileri tarihli/bozuk bir
  // deleted_at 30'dan buyuk bir sayi uretir ve panelde GORUNUR kalir.
  // Gizlemek (30'a kirpmak) veri bozuklugunu sessizce yutardi.
  const daysLeft = Math.max(0, Math.ceil((purgeMs - nowMs) / DAY_MS));

  return {
    deleted: true,
    purgeAt: new Date(purgeMs),
    daysLeft,
    due: nowMs >= purgeMs,
  };
}

/** purge_hold okunan satirin minimum sekli. */
export interface PurgeCandidateRow {
  deleted_at?: string | Date | null;
  purge_hold?: boolean | null;
}

/**
 * OTOMATIK purge kapisi: retention doldu MU ve kilit KAPALI mi?
 *
 * `purge_hold === true` -> her zaman FALSE. Kilit yalnizca otomatik yolu keser;
 * manuel purge onu asabilir ama bunu hotel_purge_log.note'a YAZMAK ZORUNDADIR
 * (sessiz asma = §3 SESSIZ YUTMA YASAGI).
 */
export function isPurgeDue(row: PurgeCandidateRow, now: Date): boolean {
  if (row.purge_hold === true) return false;
  return purgeInfo(row.deleted_at, now).due;
}
