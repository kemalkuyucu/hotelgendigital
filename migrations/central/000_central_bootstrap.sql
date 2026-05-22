-- =============================================================================
-- migrations/central/000_central_bootstrap.sql
-- Central DB (hotelgen-central) bootstrap SQL
--
-- BU DOSYA RUNNER TARAFINDAN ÇALIŞTIRILMAZ (tavuk-yumurta sorunu).
-- Supabase SQL Editor'de ELLE bir kez çalıştırılır.
--
-- İçerik:
--   1) exec_sql RPC fonksiyonu (sadece service_role çağırabilir)
--   2) schema_migrations tablosu (IF NOT EXISTS, idempotent)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. exec_sql: Runner'ın DDL/DML çalıştırmasını sağlar.
--    BEGIN/COMMIT KULLANILMAZ — exec_sql ile uyumsuz.
--    SECURITY DEFINER: service_role yetkisiyle çalışır.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Tüm kullanıcılardan execute iznini geri al
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;

-- Sadece service_role çalıştırabilsin
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Fonksiyon varlığını doğrula
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'exec_sql'
  ) THEN
    RAISE EXCEPTION 'exec_sql fonksiyonu oluşturulamadı!';
  END IF;
  RAISE NOTICE 'Central DB: exec_sql fonksiyonu hazır.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. schema_migrations: Hangi migration'ların uygulandığını takip eder.
--    migration_name UNIQUE kısıtı — tekrar eklemeyi engeller (idempotent).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id             BIGSERIAL PRIMARY KEY,
  migration_name TEXT        NOT NULL UNIQUE,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tablo varlığını doğrula
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
  ) THEN
    RAISE EXCEPTION 'schema_migrations tablosu oluşturulamadı!';
  END IF;
  RAISE NOTICE 'Central DB: schema_migrations tablosu hazır.';
END;
$$;
