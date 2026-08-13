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
 * ── OTOMATIK SILME VARSAYILAN OLARAK KAPALIDIR (31. otu karari) ────────────
 * IKI BAGIMSIZ KILIT var; biri acilirsa digeri hala tutar:
 *   1. `vercel.json`de bu route icin cron girdisi YOKTUR -> kimse cagirmaz.
 *   2. `PURGE_AUTO_ENABLED === 'true'` DEGILSE bu route silme YAPMAZ; kuyrugu
 *      raporlar ve `mode:'disabled'` doner.
 * GEREKCE: purge tenant'in Supabase PROJESINI silmiyor (Management API isi) ->
 * otomasyonun faydasi dusuk, hatasi GERI ALINAMAZ. Silme bilincli bir insan
 * eylemi olarak kalir.
 *
 * ELLE silme (`POST /api/admin/hotels/[id]/purge`) BU KAPIDAN ETKILENMEZ —
 * super_admin + confirmSlug ile aynen calisir. Buradaki kapi YALNIZ otomatik
 * yolu kapatir.
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
  // FAIL-SAFE: env yok, bos ya da 'true' disinda HERHANGI bir deger -> KAPALI.
  const autoEnabled = process.env.PURGE_AUTO_ENABLED === 'true';

  try {
    // Kapaliyken `dryRun` degerine BAKILMAZ: her iki halde de yalniz kuyruk
    // raporlanir, `purgeDueHotels` HIC CAGRILMAZ.
    if (!autoEnabled || dryRun) {
      const queue = await listPurgeQueue(now);
      return NextResponse.json({
        mode: autoEnabled ? 'dry_run' : 'disabled',
        dryRun,
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
      mode: 'auto',
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
