// =============================================================================
// src/lib/migrations/seedBaseline.ts
// Verilen hotel_slug için schema_migrations'a 001-006 baseline kayıtları ekler.
// ON CONFLICT DO NOTHING (idempotent).
// 000_bootstrap dâhil edilmez — manual-only (exec_sql RPC'yi yaratan dosya).
// 007 dahil edilmez.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import type { MigrationStatusReport } from './getMigrationStatus';
import { getMigrationStatus } from './getMigrationStatus';

export interface SeedBaselineOptions {
  hotelSlug: string;
  appliedBy?: string;
}

export interface SeedBaselineResult {
  hotelSlug: string;
  /** Kaç kayıt insert edildi (0 = zaten vardı) */
  insertedCount: number;
  /** Tüm versiyonların son durumu */
  finalStatus: MigrationStatusReport;
}

// 000_bootstrap dâhil edilmez — manual-only, runner skip eder (chicken-egg).
// 007 dâhil edilmez — destructive, sadece --include-destructive ile çalışır.
const BASELINE_VERSIONS = [
  { version: '001', name: 'initial_schema' },
  { version: '002', name: 'perplexity' },
  { version: '003', name: 'sla_events' },
  { version: '004', name: 'module15_iban' },
  { version: '005', name: 'module17_inhouse' },
  { version: '006', name: 'module17_notifications' },
] as const;

/**
 * Belirtilen hotel için schema_migrations tablosuna 001-006 baseline
 * kayıtlarını ekler. ON CONFLICT DO NOTHING (zaten varsa atla).
 */
export async function seedBaseline(opts: SeedBaselineOptions): Promise<SeedBaselineResult> {
  const { hotelSlug, appliedBy = 'baseline-seed' } = opts;

  // 1) Hotel kimlik bilgileri
  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) throw new Error(`Hotel bulunamadı: ${hotelSlug}`);

  const bridge = await getDecryptedBridge(hotel.id);
  if (!bridge) throw new Error(`Hotel bridge credentials bulunamadı: ${hotelSlug}`);

  const tenantClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2) schema_migrations tablosunun var olduğunu garanti et
  // (ensureMigrationsTable exec_sql RPC'ye bağlı — önce dene, yoksa raw SQL)
  const { error: tableError } = await tenantClient.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version       TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        applied_at    TIMESTAMPTZ DEFAULT NOW(),
        applied_by    TEXT,
        success       BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        duration_ms   INTEGER,
        sql_hash      TEXT
      )
    `.trim(),
  });

  if (tableError) {
    console.warn(
      `[seedBaseline] exec_sql ile tablo oluşturulamadı (devam edilecek): ${tableError.message}`
    );
    // Tablo zaten varsa sorun değil
  }

  // 3) Mevcut kayıtları kontrol et
  const { data: existing } = await tenantClient
    .from('schema_migrations')
    .select('version')
    .in('version', BASELINE_VERSIONS.map((v) => v.version));

  const existingVersions = new Set((existing ?? []).map((r) => r.version as string));

  // 4) Sadece eksik olanları insert et
  const toInsert = BASELINE_VERSIONS.filter((v) => !existingVersions.has(v.version));

  let insertedCount = 0;
  if (toInsert.length > 0) {
    const rows = toInsert.map((v) => ({
      version: v.version,
      name: v.name,
      applied_by: appliedBy,
      success: true,
      error_message: null,
      duration_ms: 0,
    }));

    const { error: insertError, count } = await tenantClient
      .from('schema_migrations')
      .insert(rows, { count: 'exact' });

    if (insertError) {
      // Conflict kontrolü (idempotent davran)
      if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
        throw new Error(`Baseline seed insert hatası: ${insertError.message}`);
      }
      // Duplicate ise atla
      console.warn(`[seedBaseline] Bazı kayıtlar zaten mevcut (duplicate): ${insertError.message}`);
    } else {
      insertedCount = count ?? toInsert.length;
    }
  }

  // 5) Final durum
  const finalStatus = await getMigrationStatus(hotelSlug);

  return {
    hotelSlug,
    insertedCount,
    finalStatus,
  };
}
