// =============================================================================
// src/lib/migrations/central/types.ts
// Central DB migration runner için tip tanımları
// =============================================================================

export interface CentralMigrationFile {
  /** Migration dosya adı (versiyonsuz, örn: '009_soft_delete_hotels') */
  migrationName: string;
  /** Tam SQL içeriği */
  sql: string;
  /** Dosya yolu (mutlak) */
  filepath: string;
}

export interface CentralMigrationStatus {
  migrationName: string;
  /** ISO 8601 */
  appliedAt: string;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
}

export interface CentralRunResult {
  applied: CentralMigrationStatus[];
  skipped: string[];
  failed?: CentralMigrationStatus;
  total_ms: number;
}

export interface CentralMigrationStatusReport {
  total_available: number;
  applied: {
    migrationName: string;
    appliedAt: string;
  }[];
  pending: {
    migrationName: string;
  }[];
}
