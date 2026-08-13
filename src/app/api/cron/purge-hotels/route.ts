import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqualStr } from '@/lib/telegram/verify';
import { listPurgeQueue, purgeDueHotels, PURGE_BATCH_CAP } from '@/lib/hotels/purge-hotel';
import { PURGE_RETENTION_DAYS } from '@/lib/hotels/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Otel RETENTION purge cron'u.
 *
 * Cagri: GET /api/cron/purge-hotels
 * Auth : Authorization: Bearer {CRON_SECRET}   (Vercel Cron bunu gonderir)
 * Onizleme: /api/cron/purge-hotels?dryRun=1 -> SILME YOK, yalniz kuyruk raporu.
 *
 * FAIL-CLOSED: CRON_SECRET tanimli DEGILSE endpoint 500 doner ve HICBIR SEY
 * silmez. Rate-limit/dedup kapilarinin fail-OPEN olmasiyla karistirma: orada
 * en kotu ihtimal fazladan bir mesajdir, burada GERI ALINAMAZ veri kaybi.
 *
 * Karsilastirma sabit-zamanli (`timingSafeEqualStr` — webhook'larla AYNI kaynak).
 * Yanit govdesinde slug / isim / gun sayisi disinda veri YOKTUR; sir asla.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[hotel-purge] CRON_SECRET tanimsiz — purge REDDEDILDI (fail-closed).');
    return NextResponse.json({ error: 'cron secret not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!timingSafeEqualStr(bearer, cronSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  try {
    if (dryRun) {
      const queue = await listPurgeQueue(now);
      return NextResponse.json({
        dryRun: true,
        retention_days: PURGE_RETENTION_DAYS,
        batch_cap: PURGE_BATCH_CAP,
        checked: queue.length,
        due: queue.filter((q) => q.due).length,
        items: queue.map((q) => ({
          slug: q.slug,
          name: q.name,
          days_left: q.days_left,
          due: q.due,
          purge_hold: q.purge_hold,
        })),
      });
    }

    const summary = await purgeDueHotels({ now, actor: 'cron' });
    return NextResponse.json({
      ok: true,
      retention_days: PURGE_RETENTION_DAYS,
      batch_cap: PURGE_BATCH_CAP,
      checked: summary.checked,
      due: summary.due,
      purged: summary.purged,
      failed: summary.failed.map((f) => ({ slug: f.slug, reason: f.reason })),
      deferred: summary.deferred,
      held: summary.held,
    });
  } catch (err) {
    // Detay yalniz server log'una; istemciye sabit metin.
    console.error('[hotel-purge] cron hatasi:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'purge run failed' }, { status: 500 });
  }
}
