// =============================================================================
// src/lib/migrations/types.ts
// Runner core tip tanımları
// =============================================================================

export interface MigrationFile {
  /** '001', '002', ... */
  version: string;
  /** 'initial_schema', 'perplexity', ... */
  name: string;
  /** Tam SQL içeriği */
  sql: string;
  /** Dosya yolu (mutlak) */
  filepath: string;
}

export interface MigrationStatus {
  version: string;
  /** ISO 8601 */
  appliedAt: string;
  appliedBy: string;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
}

export interface RunResult {
  hotel_slug: string;
  applied: MigrationStatus[];
  skipped: string[];
  failed?: MigrationStatus;
  total_ms: number;
}
