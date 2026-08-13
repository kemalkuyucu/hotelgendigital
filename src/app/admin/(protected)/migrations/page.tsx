// =============================================================================
// src/app/admin/(protected)/migrations/page.tsx
// Server Component — Migration durum sayfası
// =============================================================================

import { getSessionAdmin } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getCentralSupabase } from '@/lib/supabase-client';
import { purgeInfo } from '@/lib/hotels/retention';
import MigrationsClient, { type DeletedHotelRow } from './MigrationsClient';
import { getMigrationStatus, type MigrationStatusReport } from '@/lib/migrations';

export default async function MigrationsPage() {
  const admin = await getSessionAdmin();
  if (!admin) redirect('/admin/login');

  // Central DB'den otel listesi
  const supabase = getCentralSupabase();
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, slug, name, status, deleted_at, purge_hold')
    .order('name', { ascending: true });

  // AKTIF / SILINMIS ayrimi. Silinmis otelin tenant DB'sine BAGLANILMAZ:
  // migration durumu sorulmaz (bagli kimlikleri purge ile gidebilir, ustelik
  // sayaclari kirletirdi). Onlar yalniz meta + geri sayim olarak listelenir.
  const all = hotels ?? [];
  const activeHotels = all.filter((h) => !h.deleted_at);
  const now = new Date();
  const deletedHotels: DeletedHotelRow[] = all
    .filter((h) => !!h.deleted_at)
    .map((h) => {
      const info = purgeInfo(h.deleted_at as string, now);
      return {
        slug: h.slug as string,
        name: (h.name as string) ?? (h.slug as string),
        deleted_at: h.deleted_at as string,
        days_left: info.daysLeft,
        purge_at: info.purgeAt?.toISOString() ?? null,
        purge_hold: h.purge_hold === true,
      };
    });

  // Yalnizca AKTIF oteller icin paralel durum sorgusu
  const statusPromises = activeHotels.map(async (hotel) => {
    try {
      return await getMigrationStatus(hotel.slug as string);
    } catch {
      return {
        hotel_slug: hotel.slug as string,
        total_available: 6,
        applied: [],
        pending: [],
        last_error: {
          version: 'N/A',
          message: 'Durum alınamadı.',
          at: new Date().toISOString(),
        },
      } satisfies MigrationStatusReport;
    }
  });

  const statuses = await Promise.all(statusPromises);

  // Hotel adlarını statüsle birleştir
  const statusesWithNames = statuses.map((s) => {
    const hotel = activeHotels.find((h) => h.slug === s.hotel_slug);
    return {
      ...s,
      hotel_name: (hotel?.name as string) ?? s.hotel_slug,
    };
  });

  return (
    <MigrationsClient
      initialStatuses={statusesWithNames}
      deletedHotels={deletedHotels}
      adminUsername={admin.username}
    />
  );
}
