// =============================================================================
// src/lib/migrations/loadMigrations.ts
// migrations/tenant/*.sql dosyalarını okuyup sıralı döndürür.
// =============================================================================

import fs from 'fs';
import path from 'path';
import type { MigrationFile } from './types';

const MIGRATION_DIR = path.resolve(process.cwd(), 'migrations', 'tenant');
const FILENAME_REGEX = /^(\d{3})_([a-z0-9_]+)\.sql$/;
const DESTRUCTIVE_VERSION = '007';

export interface LoadMigrationsOptions {
  /** true ise 007_drop_deprecated.sql de dahil edilir. Default: false */
  includeDestructive?: boolean;
}

/**
 * migrations/tenant/ klasöründeki .sql dosyalarını okur,
 * versiyon numarasına göre sıralar ve döndürür.
 *
 * 007_drop_deprecated.sql varsayılan olarak DAHIL EDİLMEZ.
 * opts.includeDestructive = true ile dahil edilir.
 */
export function loadMigrations(opts: LoadMigrationsOptions = {}): MigrationFile[] {
  const includeDestructive = opts.includeDestructive ?? false;

  if (!fs.existsSync(MIGRATION_DIR)) {
    throw new Error(`Migration dizini bulunamadı: ${MIGRATION_DIR}`);
  }

  const files = fs.readdirSync(MIGRATION_DIR);
  const migrations: MigrationFile[] = [];

  for (const filename of files) {
    const match = FILENAME_REGEX.exec(filename);
    if (!match) continue; // .gitkeep, README.md, vb.

    const version = match[1]!;
    const name = match[2]!;

    // Destructive dosyayı filtrele
    if (version === DESTRUCTIVE_VERSION && !includeDestructive) {
      continue;
    }

    const filepath = path.join(MIGRATION_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    migrations.push({ version, name, sql, filepath });
  }

  // Versiyon numarasına göre artan sıralama
  migrations.sort((a, b) => a.version.localeCompare(b.version));

  return migrations;
}
