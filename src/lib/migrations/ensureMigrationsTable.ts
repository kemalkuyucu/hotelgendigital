// =============================================================================
// src/lib/migrations/ensureMigrationsTable.ts
// Tenant DB'de schema_migrations tablosunun varlığını garantiler.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version       TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ DEFAULT NOW(),
  applied_by    TEXT,
  success       BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms   INTEGER,
  sql_hash      TEXT
);
`.trim();

/**
 * Tenant Supabase client'ı alır ve schema_migrations tablosunu
 * yoksa oluşturur.
 *
 * Not: Supabase JS client doğrudan DDL çalıştıramaz.
 * exec_sql RPC'si tenant DB'de tanımlı olmalıdır veya
 * Supabase Management API kullanılmalıdır.
 * Burada rpc('exec_sql') pattern'i kullanılır — bu RPC tenant DB'de
 * aşağıdaki gibi tanımlı olmalıdır:
 *   CREATE OR REPLACE FUNCTION exec_sql(sql TEXT) RETURNS VOID AS $$
 *   BEGIN EXECUTE sql; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
 */
export async function ensureMigrationsTable(
  client: SupabaseClient
): Promise<void> {
  const { error } = await client.rpc('exec_sql', { sql: CREATE_TABLE_SQL });

  if (error) {
    // exec_sql RPC yoksa fallback: doğrudan tablo sorgusu ile kontrol
    const { error: selectError } = await client
      .from('schema_migrations')
      .select('version')
      .limit(1);

    if (selectError) {
      throw new Error(
        `schema_migrations tablosu oluşturulamadı. ` +
        `exec_sql RPC tanımlı değil ve tablo erişilemez: ${selectError.message}. ` +
        `Lütfen tenant DB'de exec_sql fonksiyonunu oluşturun.`
      );
    }
    // Tablo zaten var, devam et
  }
}
