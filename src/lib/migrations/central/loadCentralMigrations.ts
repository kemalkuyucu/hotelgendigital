// =============================================================================
// src/lib/migrations/central/loadCentralMigrations.ts
// migrations/central/*.sql dosyalarını okuyup sıralı döndürür.
//
// Kural:
//   - 000_central_bootstrap.sql ATLANIР (runner ona ihtiyaç duyar, tavuk-yumurta)
//   - Dosya adı formatı: NNN_name.sql (opsiyonel prefix)
//   - Sıralama: dosya adına göre artan (lexicographic)
// =============================================================================

import fs from 'fs';
import path from 'path';
import type { CentralMigrationFile } from './types';

const CENTRAL_MIGRATION_DIR = path.resolve(process.cwd(), 'migrations', 'central');
const FILENAME_REGEX = /^(\d{3}_[a-z0-9_]+)\.sql$/;

/**
 * migrations/central/ klasöründeki .sql dosyalarını okur,
 * adlarına göre sıralar ve döndürür.
 *
 * 000_central_bootstrap.sql ATLANIR — exec_sql RPC'yi yaratan dosya
 * runner tarafından çalıştırılamaz (chicken-egg).
 */
export function loadCentralMigrations(): CentralMigrationFile[] {
  if (!fs.existsSync(CENTRAL_MIGRATION_DIR)) {
    throw new Error(`Central migration dizini bulunamadı: ${CENTRAL_MIGRATION_DIR}`);
  }

  const files = fs.readdirSync(CENTRAL_MIGRATION_DIR);
  const migrations: CentralMigrationFile[] = [];

  for (const filename of files) {
    const match = FILENAME_REGEX.exec(filename);
    if (!match) continue; // .gitkeep, README.md, vb.

    const migrationName = match[1]!;

    // 000_central_bootstrap — runner tarafından çalıştırılmaz (chicken-egg)
    if (migrationName.startsWith('000_')) {
      continue;
    }

    const filepath = path.join(CENTRAL_MIGRATION_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    migrations.push({ migrationName, sql, filepath });
  }

  // Dosya adına göre artan sıralama (NNN prefix sayesinde doğal sıra)
  migrations.sort((a, b) => a.migrationName.localeCompare(b.migrationName));

  return migrations;
}
