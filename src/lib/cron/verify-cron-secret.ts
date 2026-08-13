/**
 * CRON istegi dogrulamasi — UC cron route'unun TEK KAYNAGI.
 *
 * Onceden her cron kendi kontrolunu yaziyordu ve UCU AYNI DEGILDI:
 *   - archive-checked-out / cron-health-check : `auth !== \`Bearer ${secret}\``
 *     (DUZ karsilastirma) + CRON_SECRET yoksa **401**
 *   - purge-hotels                            : `timingSafeEqualStr` + yoksa **500**
 * Ayni karar uc yerde yasayinca biri gunun birinde sessizce kayar
 * (CLAUDE.md §3 "tekrarlanan karar tek kaynakta").
 *
 * FAIL-CLOSED: `CRON_SECRET` TANIMSIZSA istek REDDEDILIR (**500**) ve is
 * KOSMAZ. Rate-limit/dedup kapilarinin fail-OPEN olmasiyla karistirma: orada en
 * kotu ihtimal fazladan bir mesajdir, burada yapilandirilmamis bir ortamda
 * kimlik dogrulamasiz is kosturmaktir. 401 yerine 500 donmesi bilincli: "sen
 * yetkisizsin" degil, "sunucu yapilandirilmamis" denmesi gerekir.
 *
 * NOT: bu modul `next/server` IMPORT ETMEZ — parametre yapisal olarak tiplenir
 * (`headers.get`). Boylece is8 korpusu GERCEK modulu Next runtime'i olmadan
 * import edip kosabilir (kopya fonksiyon YASAK).
 */

import { timingSafeEqualStr } from '@/lib/telegram/verify';

const BEARER_PREFIX = 'Bearer ';

/** NextRequest bu sekli KARSILAR; test sahte bir nesne verebilir. */
export interface CronRequestLike {
  headers: { get(name: string): string | null };
}

export type CronAuthResult = { ok: true } | { ok: false; status: 401 | 500 };

/** Istemciye donen sabit metin — uc route'ta AYNI kalsin diye tek yerde. */
export function cronAuthMessage(status: 401 | 500): string {
  return status === 500 ? 'cron secret not configured' : 'unauthorized';
}

/**
 * `Authorization: Bearer {CRON_SECRET}` dogrulamasi.
 *
 * Karsilastirma SABIT ZAMANLI (`timingSafeEqualStr` — webhook'larla AYNI kaynak);
 * eksik header, eksik `Bearer ` oneki ve farkli uzunluk THROW ETMEZ, 401 doner.
 */
export function verifyCronRequest(req: CronRequestLike): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Sessiz yutma YASAK: fail-closed red her zaman iz birakir.
    console.error('[cron-auth] CRON_SECRET tanimsiz — istek REDDEDILDI (fail-closed).');
    return { ok: false, status: 500 };
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith(BEARER_PREFIX) ? authHeader.slice(BEARER_PREFIX.length) : null;
  if (!timingSafeEqualStr(bearer, cronSecret)) {
    return { ok: false, status: 401 };
  }

  return { ok: true };
}
