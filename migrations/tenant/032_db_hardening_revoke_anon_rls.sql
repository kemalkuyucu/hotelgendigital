-- =============================================================================
-- migrations/tenant/032_db_hardening_revoke_anon_rls.sql
-- TENANT DB HARDENING — defense-in-depth (26.+ oturum, backlog: RLS/grant)
--
-- NIYET (canli kanitli): anon anahtari bugun public semadaki 45 tabloda tam CRUD
-- (SELECT/INSERT/UPDATE/DELETE...) yapabiliyor VE `exec_sql` (SECURITY DEFINER,
-- owner=postgres) anon/authenticated'e acik oldugu icin anon anahtariyla
-- postgres-yetkili KEYFI SQL calistirilabiliyor. Kok neden: Supabase'in public
-- semada anon+authenticated'e otomatik verdigi default grant'lar; bootstrap'in
-- `REVOKE ... FROM PUBLIC`u bu iki AYRI grant'i temizlemiyor.
--
-- COZUM: anon/authenticated/PUBLIC'i tablo+sequence+fonksiyondan kilitle,
-- service_role'e geri ver (app runtime + tsql YALNIZ service_role kullanir ->
-- app BOZULMAZ), her public tabloda RLS'i deny-by-default ac (policy yok ->
-- anon/authenticated SIFIR satir; service_role rolbypassrls=true -> etkilenmez).
--
-- IDEMPOTENT: REVOKE/GRANT/ALTER DEFAULT PRIVILEGES/ENABLE RLS hepsi tekrar
-- calistirilabilir (yoksa no-op, varsa no-op, zaten-enabled no-op).
-- exec_sql (postgres-definer) uzerinden uygulanir; BEGIN/COMMIT YOK.
-- =============================================================================

-- --- FONKSIYONLAR: anon/authenticated/PUBLIC execute KAPAT, service_role GERI VER
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- --- TABLO + SEQUENCE: anon/authenticated/PUBLIC KAPAT, service_role GERI VER
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT  ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- --- RLS deny-by-default: her public tabloda ENABLE (policy yok -> anon/auth sifir;
--     service_role bypass eder). menu_items/room_service_orders zaten acikti -> no-op.
DO $hardening$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$hardening$;
