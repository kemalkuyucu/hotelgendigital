// =============================================================================
// src/lib/migrations/runMigrations.ts
// Ana migration runner — tek tenant için migration'ları sırayla uygular.
// =============================================================================

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';
import { loadMigrations } from './loadMigrations';
import { ensureMigrationsTable } from './ensureMigrationsTable';
import type { MigrationStatus, RunResult } from './types';

// ---------------------------------------------------------------------------
// Yardımcı: SQL hash (değişiklik tespiti için)
// ---------------------------------------------------------------------------
function hashSql(sql: string): string {
  return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// runMigrations
// ---------------------------------------------------------------------------
export interface RunMigrationsOptions {
  /** Tenant hotel slug (Central DB'den hotel_id çekilir) */
  hotelSlug: string;
  /** true ise SQL log'lanır ama çalıştırılmaz */
  dryRun?: boolean;
  /** true ise 007_drop_deprecated.sql de dahil edilir */
  includeDestructive?: boolean;
  /** schema_migrations.applied_by alanı için etiket */
  appliedBy?: string;
}

/**
 * Belirtilen hotel için henüz uygulanmamış migration dosyalarını sırayla çalıştırır.
 * Her migration kendi BEGIN/COMMIT transaction'ı içinde gelir.
 */
export async function runMigrations(
  opts: RunMigrationsOptions
): Promise<RunResult> {
  const startMs = Date.now();
  const { hotelSlug, dryRun = false, includeDestructive = false, appliedBy = 'system' } = opts;

  // 1) Central DB'den hotel_id al
  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    throw new Error(`Hotel bulunamadı: ${hotelSlug}`);
  }

  // 2) Bridge credentials decrypt et ve admin client oluştur
  const bridge = await getDecryptedBridge(hotel.id);
  if (!bridge) {
    throw new Error(`Hotel bridge credentials bulunamadı: ${hotelSlug} (id: ${hotel.id})`);
  }

  const tenantClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) schema_migrations tablosunu garanti et
  if (!dryRun) {
    await ensureMigrationsTable(tenantClient);
  }

  // 4) Dosyaları yükle
  const files = loadMigrations({ includeDestructive });

  // 5) Mevcut uygulanmış versiyonları çek
  const appliedVersions = new Set<string>();
  if (!dryRun) {
    const { data: existingRows, error: fetchError } = await tenantClient
      .from('schema_migrations')
      .select('version');

    if (fetchError) {
      throw new Error(`schema_migrations okunamadı: ${fetchError.message}`);
    }
    for (const row of existingRows ?? []) {
      appliedVersions.add(row.version as string);
    }
  }

  const result: RunResult = {
    hotel_slug: hotelSlug,
    applied: [],
    skipped: [],
    total_ms: 0,
  };

  // 6) Sırayla çalıştır
  for (const migration of files) {
    // Zaten uygulanmışsa atla
    if (appliedVersions.has(migration.version)) {
      result.skipped.push(migration.version);
      continue;
    }

    if (dryRun) {
      console.log(`[DRY-RUN] ${migration.version}_${migration.name}.sql`);
      console.log(migration.sql.slice(0, 200) + '...\n');
      result.skipped.push(`DRY:${migration.version}`);
      continue;
    }

    const migrationStart = Date.now();

    try {
      // SQL'i exec_sql RPC ile çalıştır (dosya kendi BEGIN/COMMIT içeriyor)
      const { error: execError } = await tenantClient.rpc('exec_sql', {
        sql: migration.sql,
      });

      const durationMs = Date.now() - migrationStart;

      if (execError) {
        // Hata kaydı
        const failedStatus: MigrationStatus = {
          version: migration.version,
          appliedAt: new Date().toISOString(),
          appliedBy,
          success: false,
          errorMessage: execError.message,
          durationMs,
        };

        // schema_migrations'a hata kaydı yaz
        await tenantClient.from('schema_migrations').upsert({
          version: migration.version,
          name: migration.name,
          applied_by: appliedBy,
          success: false,
          error_message: execError.message,
          duration_ms: durationMs,
          sql_hash: hashSql(migration.sql),
        });

        result.failed = failedStatus;
        result.total_ms = Date.now() - startMs;
        return result; // Hata varsa dur
      }

      // Başarı kaydı
      const successStatus: MigrationStatus = {
        version: migration.version,
        appliedAt: new Date().toISOString(),
        appliedBy,
        success: true,
        durationMs,
      };

      await tenantClient.from('schema_migrations').upsert({
        version: migration.version,
        name: migration.name,
        applied_by: appliedBy,
        success: true,
        error_message: null,
        duration_ms: durationMs,
        sql_hash: hashSql(migration.sql),
      });

      result.applied.push(successStatus);
    } catch (err) {
      const durationMs = Date.now() - migrationStart;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const failedStatus: MigrationStatus = {
        version: migration.version,
        appliedAt: new Date().toISOString(),
        appliedBy,
        success: false,
        errorMessage,
        durationMs,
      };

      // Kritik hata — kaydı dene, mümkün olmayabilir
      try {
        await tenantClient.from('schema_migrations').upsert({
          version: migration.version,
          name: migration.name,
          applied_by: appliedBy,
          success: false,
          error_message: errorMessage,
          duration_ms: durationMs,
          sql_hash: hashSql(migration.sql),
        });
      } catch {
        // Kayıt başarısız olduysa yoksay
      }

      result.failed = failedStatus;
      result.total_ms = Date.now() - startMs;
      return result;
    }
  }

  result.total_ms = Date.now() - startMs;
  return result;
}
