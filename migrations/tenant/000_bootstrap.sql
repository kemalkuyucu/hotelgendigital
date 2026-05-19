-- =============================================================================
-- migrations/tenant/000_bootstrap.sql
-- exec_sql RPC fonksiyonu — tenant DB'de dinamik SQL çalıştırmak için.
-- Bu dosya runner tarafından ÇALIŞTIRILMAZ (runner exec_sql'e ihtiyaç duyar).
-- Onboarding sırasında Supabase SQL Editor'de veya admin API ile çalıştırılır.
-- =============================================================================

-- exec_sql: Runner'ın dinamik DDL/DML çalıştırmasını sağlar.
-- Yalnızca service_role çağırabilir (SECURITY DEFINER + grant kaldırma).
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

-- Fonksiyon oluşturulduğunu teyit et
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'exec_sql'
  ) THEN
    RAISE EXCEPTION 'exec_sql fonksiyonu oluşturulamadı!';
  END IF;
  RAISE NOTICE 'exec_sql fonksiyonu hazır.';
END;
$$;
