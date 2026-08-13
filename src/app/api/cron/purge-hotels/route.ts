import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, cronAuthMessage } from '@/lib/cron/verify-cron-secret';
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
 * Karar ve sabit-zamanli karsilastirma TEK KAYNAKTA: lib/cron/verify-cron-secret.
 *
 * Yanit govdesinde slug / isim / gun sayisi disinda veri YOKTUR; sir asla.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: cronAuthMessage(auth.status) }, { status: auth.status });
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
