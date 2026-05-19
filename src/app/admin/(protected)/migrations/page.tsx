// =============================================================================
// src/app/admin/(protected)/migrations/page.tsx
// Server Component — Migration durum sayfası
// =============================================================================

import { getSessionAdmin } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getCentralSupabase } from '@/lib/supabase-client';
import MigrationsClient from './MigrationsClient';
import { getMigrationStatus, type MigrationStatusReport } from '@/lib/migrations';

export default async function MigrationsPage() {
  const admin = await getSessionAdmin();
  if (!admin) redirect('/admin/login');

  // Central DB'den otel listesi
  const supabase = getCentralSupabase();
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, slug, name, status')
    .order('name', { ascending: true });

  // Tüm oteller için paralel durum sorgusu
  const statusPromises = (hotels ?? []).map(async (hotel) => {
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
    const hotel = (hotels ?? []).find((h) => h.slug === s.hotel_slug);
    return {
      ...s,
      hotel_name: (hotel?.name as string) ?? s.hotel_slug,
    };
  });

  return (
    <MigrationsClient
      initialStatuses={statusesWithNames}
      adminUsername={admin.username}
    />
  );
}
