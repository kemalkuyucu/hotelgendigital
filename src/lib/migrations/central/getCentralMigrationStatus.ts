// =============================================================================
// src/lib/migrations/central/getCentralMigrationStatus.ts
// Central DB için migration durum raporu döndürür.
// =============================================================================

import { getCentralSupabase } from '@/lib/supabase-client';
import { loadCentralMigrations } from './loadCentralMigrations';
import type { CentralMigrationStatusReport } from './types';

/**
 * Central DB migration durum raporunu döndürür.
 * UI'da tablo görünümü ve "Uygula" butonu için kullanılır.
 */
export async function getCentralMigrationStatus(): Promise<CentralMigrationStatusReport> {
  const centralClient = getCentralSupabase();

  // 1) Mevcut dosyaları yükle (bootstrap hariç)
  const files = loadCentralMigrations();

  // 2) schema_migrations tablosunu sorgula
  let appliedRows: Array<{
    migration_name: string;
    applied_at: string;
  }> = [];

  try {
    const { data, error } = await centralClient
      .from('schema_migrations')
      .select('migration_name, applied_at')
      .order('applied_at', { ascending: true });

    if (!error && data) {
      appliedRows = data as typeof appliedRows;
    }
  } catch {
    // schema_migrations henüz yoksa (bootstrap uygulanmamış) boş döner
  }

  const appliedNameSet = new Set(appliedRows.map((r) => r.migration_name));

  // 3) Başarıyla uygulananlar
  const applied = appliedRows.map((r) => ({
    migrationName: r.migration_name,
    appliedAt: r.applied_at,
  }));

  // 4) Bekleyenler
  const pending = files
    .filter((f) => !appliedNameSet.has(f.migrationName))
    .map((f) => ({ migrationName: f.migrationName }));

  return {
    total_available: files.length,
    applied,
    pending,
  };
}
