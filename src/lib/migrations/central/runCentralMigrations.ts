// =============================================================================
// src/lib/migrations/central/runCentralMigrations.ts
// Central DB migration runner — tenant runner'ın birebir uyarlaması.
//
// Farklar (tenant runner'a göre):
//   - Hotel slug/bridge credentials yerine CENTRAL_SUPABASE_SERVICE_ROLE_KEY kullanır.
//   - schema_migrations tablosu Central DB'de: id, migration_name UNIQUE, applied_at
//   - exec_sql RPC: tenant'takiyle aynı imza/güvenlik — Central DB'de 000_central_bootstrap.sql ile kurulur.
//   - BEGIN/COMMIT kullanılmaz (exec_sql ile uyumsuz).
// =============================================================================

import { getCentralSupabase } from '@/lib/supabase-client';
import { loadCentralMigrations } from './loadCentralMigrations';
import type { CentralMigrationStatus, CentralRunResult } from './types';

export interface RunCentralMigrationsOptions {
  /** true ise SQL log'lanır ama çalıştırılmaz */
  dryRun?: boolean;
  /** schema_migrations.applied_at için log etiketi */
  appliedBy?: string;
}

/**
 * Central DB için henüz uygulanmamış migration dosyalarını sırayla çalıştırır.
 *
 * Her migration:
 *   1. schema_migrations'da yoksa exec_sql RPC ile çalıştırılır.
 *   2. Başarılıysa schema_migrations'a INSERT edilir (migration_name UNIQUE).
 *   3. Hata varsa durulur ve sonuç döndürülür.
 *   4. Zaten uygulanmışsa (migration_name mevcut) atlanır.
 */
export async function runCentralMigrations(
  opts: RunCentralMigrationsOptions = {}
): Promise<CentralRunResult> {
  const startMs = Date.now();
  const { dryRun = false, appliedBy = 'system' } = opts;

  const centralClient = getCentralSupabase();

  // 1) Migration dosyalarını yükle (000_bootstrap hariç)
  const files = loadCentralMigrations();

  // 2) Mevcut uygulanmış migration_name'leri çek
  const appliedNames = new Set<string>();
  if (!dryRun) {
    const { data: existingRows, error: fetchError } = await centralClient
      .from('schema_migrations')
      .select('migration_name');

    if (fetchError) {
      throw new Error(
        `Central DB schema_migrations okunamadı: ${fetchError.message}. ` +
        `000_central_bootstrap.sql uygulandı mı?`
      );
    }

    for (const row of existingRows ?? []) {
      appliedNames.add(row.migration_name as string);
    }
  }

  const result: CentralRunResult = {
    applied: [],
    skipped: [],
    total_ms: 0,
  };

  // 3) Sırayla çalıştır
  for (const migration of files) {
    // Zaten uygulanmışsa atla
    if (appliedNames.has(migration.migrationName)) {
      result.skipped.push(migration.migrationName);
      continue;
    }

    if (dryRun) {
      console.log(`[CENTRAL DRY-RUN] ${migration.migrationName}.sql`);
      console.log(migration.sql.slice(0, 200) + '...\n');
      result.skipped.push(`DRY:${migration.migrationName}`);
      continue;
    }

    const migrationStart = Date.now();

    try {
      // exec_sql RPC ile çalıştır — BEGIN/COMMIT yok (exec_sql ile uyumsuz)
      const { error: execError } = await centralClient.rpc('exec_sql', {
        sql: migration.sql,
      });

      const durationMs = Date.now() - migrationStart;

      if (execError) {
        const failedStatus: CentralMigrationStatus = {
          migrationName: migration.migrationName,
          appliedAt: new Date().toISOString(),
          success: false,
          errorMessage: execError.message,
          durationMs,
        };

        // Hata kaydını schema_migrations'a yazmaya çalış (mümkünse)
        // Not: UNIQUE constraint nedeniyle INSERT ON CONFLICT DO NOTHING kullan
        await centralClient.from('schema_migrations').upsert(
          {
            migration_name: migration.migrationName,
            applied_at: new Date().toISOString(),
          },
          { onConflict: 'migration_name', ignoreDuplicates: true }
        );

        result.failed = failedStatus;
        result.total_ms = Date.now() - startMs;
        return result; // Hata varsa dur
      }

      // Başarı — schema_migrations'a kaydet
      const { error: insertError } = await centralClient
        .from('schema_migrations')
        .insert({ migration_name: migration.migrationName });

      if (insertError && !insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
        // Insert hatası kritik değil (duplicate = zaten kayıtlı, geç)
        console.warn(
          `[central-migrations] schema_migrations insert uyarısı (${migration.migrationName}): ${insertError.message}`
        );
      }

      const successStatus: CentralMigrationStatus = {
        migrationName: migration.migrationName,
        appliedAt: new Date().toISOString(),
        success: true,
        durationMs: Date.now() - migrationStart,
      };

      result.applied.push(successStatus);
    } catch (err) {
      const durationMs = Date.now() - migrationStart;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const failedStatus: CentralMigrationStatus = {
        migrationName: migration.migrationName,
        appliedAt: new Date().toISOString(),
        success: false,
        errorMessage,
        durationMs,
      };

      result.failed = failedStatus;
      result.total_ms = Date.now() - startMs;
      return result;
    }
  }

  result.total_ms = Date.now() - startMs;
  return result;
}
