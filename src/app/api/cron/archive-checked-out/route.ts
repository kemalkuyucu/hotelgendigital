import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCentralSupabase } from '@/lib/supabase-client';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
import { getTurkeyToday } from '@/lib/date/turkeyTime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Modül 10.2 — Auto-Archive Cron
 *
 * Her gece 00:00 UTC (≈ 03:00 İstanbul) çalışır.
 * Tüm aktif hotel'leri loop'lar:
 *   - check_out_date < bugün AND is_active=true olan misafirleri
 *   - is_active=false yapar
 *
 * Çağrı: GET /api/cron/archive-checked-out
 * Auth:  Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET ile yetki kontrolü
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const central = getCentralSupabase();
  const today = getTurkeyToday(); // Modül 18: Europe/Istanbul timezone

  // Demo hotel özel client (bridge dışı)
  const demoUrl = process.env.DEMO_HOTEL_SUPABASE_URL;
  const demoKey = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;

  // Tüm aktif hotel'leri çek
  const { data: hotels, error: hotelsErr } = await central
    .from('hotels')
    .select('id, slug, name')
    .eq('status', 'active');

  if (hotelsErr || !hotels) {
    return NextResponse.json(
      { error: 'hotels fetch failed', detail: hotelsErr?.message },
      { status: 500 },
    );
  }

  const results: Array<{ hotel: string; archived: number; error?: string }> = [];

  for (const hotel of hotels) {
    try {
      // Demo hotel için özel client, diğerleri için bridge
      let hotelSupabase;
      if (hotel.slug === 'demo-hotel' && demoUrl && demoKey) {
        hotelSupabase = createClient(demoUrl, demoKey, { auth: { persistSession: false } });
      } else {
        hotelSupabase = await getHotelClient(hotel.id);
      }

      if (!hotelSupabase) {
        results.push({ hotel: hotel.slug, archived: 0, error: 'no client' });
        continue;
      }

      // check_out_date < bugün AND is_active=true → is_active=false yap
      const { data: archived, error } = await hotelSupabase
        .from('inhouse_guests')
        .update({ is_active: false })
        .lt('check_out_date', today)
        .eq('is_active', true)
        .select('id');

      if (error) {
        results.push({ hotel: hotel.slug, archived: 0, error: error.message });
        continue;
      }

      const archivedCount = archived?.length || 0;
      results.push({ hotel: hotel.slug, archived: archivedCount });

      // Audit log (sadece kayıt varsa)
      if (archivedCount > 0) {
        console.log(`[archive-cron] ${hotel.slug}: ${archivedCount} misafir arşivlendi`);
        await hotelSupabase.from('audit_log').insert({
          actor_type: 'system',
          action: 'auto_archive_checked_out',
          details: { archived_count: archivedCount, run_date: today },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      results.push({ hotel: hotel.slug, archived: 0, error: msg });
      console.error(`[archive-cron] ${hotel.slug} hata:`, msg);
    }
  }

  const totalArchived = results.reduce((sum, r) => sum + r.archived, 0);
  console.log(`[archive-cron] Tamamlandı. Toplam arşivlenen: ${totalArchived}, tarih: ${today}`);

  return NextResponse.json({ ok: true, date: today, total_archived: totalArchived, results });
}
