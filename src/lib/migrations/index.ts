// =============================================================================
// src/lib/migrations/index.ts
// Barrel export
// =============================================================================

export type { MigrationFile, MigrationStatus, RunResult } from './types';
export { loadMigrations } from './loadMigrations';
export type { LoadMigrationsOptions } from './loadMigrations';
export { ensureMigrationsTable } from './ensureMigrationsTable';
export { runMigrations } from './runMigrations';
export type { RunMigrationsOptions } from './runMigrations';
export { getMigrationStatus } from './getMigrationStatus';
export type { MigrationStatusReport } from './getMigrationStatus';
export { seedBaseline } from './seedBaseline';
export type { SeedBaselineOptions, SeedBaselineResult } from './seedBaseline';
export { runBootstrap } from './runBootstrap';
export type { RunBootstrapOptions, BootstrapResult } from './runBootstrap';

