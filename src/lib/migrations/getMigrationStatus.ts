// =============================================================================
// src/lib/migrations/getMigrationStatus.ts
// Tek tenant için migration durum raporu döndürür.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import { loadMigrations } from './loadMigrations';

export interface MigrationStatusReport {
  hotel_slug: string;
  total_available: number;
  applied: {
    version: string;
    name: string;
    appliedAt: string;
  }[];
  pending: {
    version: string;
    name: string;
  }[];
  last_error?: {
    version: string;
    message: string;
    at: string;
  };
}

/**
 * Belirtilen hotel için migration durum raporunu döndürür.
 * UI'da tablo görünümü ve "Uygula" butonu için kullanılır.
 */
export async function getMigrationStatus(
  hotelSlug: string
): Promise<MigrationStatusReport> {
  // 1) Hotel ID al
  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    throw new Error(`Hotel bulunamadı: ${hotelSlug}`);
  }

  // 2) Bridge credentials
  const bridge = await getDecryptedBridge(hotel.id);
  if (!bridge) {
    throw new Error(`Hotel bridge credentials bulunamadı: ${hotelSlug}`);
  }

  const tenantClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Mevcut dosyaları yükle (destructive hariç)
  const files = loadMigrations({ includeDestructive: false });

  // 4) schema_migrations tablosunu sorgula
  let appliedRows: Array<{
    version: string;
    name: string;
    applied_at: string;
    success: boolean;
    error_message: string | null;
  }> = [];

  try {
    const { data, error } = await tenantClient
      .from('schema_migrations')
      .select('version, name, applied_at, success, error_message')
      .order('version', { ascending: true });

    if (!error && data) {
      appliedRows = data as typeof appliedRows;
    }
  } catch {
    // Tablo henüz yoksa boş döner
  }

  const appliedVersionMap = new Map(appliedRows.map((r) => [r.version, r]));

  // 5) Başarıyla uygulananlar
  const applied = appliedRows
    .filter((r) => r.success)
    .map((r) => ({
      version: r.version,
      name: r.name,
      appliedAt: r.applied_at,
    }));

  const appliedSuccessVersions = new Set(applied.map((a) => a.version));

  // 6) Bekleyenler
  const pending = files
    .filter((f) => !appliedSuccessVersions.has(f.version))
    .map((f) => ({ version: f.version, name: f.name }));

  // 7) Son hata
  const lastErrorRow = [...appliedRows]
    .reverse()
    .find((r) => !r.success && r.error_message);

  const report: MigrationStatusReport = {
    hotel_slug: hotelSlug,
    total_available: files.length,
    applied,
    pending,
  };

  if (lastErrorRow) {
    report.last_error = {
      version: lastErrorRow.version,
      message: lastErrorRow.error_message ?? 'Bilinmeyen hata',
      at: lastErrorRow.applied_at,
    };
  }

  return report;
}
