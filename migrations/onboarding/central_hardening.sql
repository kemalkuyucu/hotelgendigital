-- =============================================================================
-- migrations/onboarding/central_hardening.sql
-- CENTRAL DB HARDENING — IDEMPOTENT · TENANT-AGNOSTIK
--
-- NOT: 011'in bilincli skip'i korundu; silent skip'i verify_hardening.sql yakalar
-- (rowsecurity=false -> FAIL); REVOKE anon birincil kilit, RLS ikincil.
--
-- TURETILMISTIR — YENI KARAR ICERMEZ. Kaynak:
--   migrations/central/011_db_hardening_revoke_anon_rls.sql
-- (Numarali sira DEGISMEZ; central en yuksek numara hala 011. Bu dosya bir
--  migration DEGILDIR, runner tarafindan GORULMEZ -> schema_migrations'a kayit
--  DUSMEZ.)
--
-- TENANT ESI: migrations/onboarding/tenant_hardening.sql BOLUM 4. Grant deseni
-- BIREBIR AYNI. IKI FARK:
--   1) Burada NESNE URETIMI YOKTUR — Central'da 029/030/031 karsiligi tablo yok.
--   2) RLS dongusu: burada 011'in TABLO-BASINA skip'i (yukaridaki not), tenant
--      tarafinda 032'nin fail-loud owner-assert'i. Her dosya KENDI kaynagina
--      sadiktir; ikisi de dogrulamayi verify_hardening.sql'e birakir.
--
-- KAC KEZ: Central TEK bir DB'dir; otel basina TEKRAR GEREKMEZ. Ancak Central'a
-- yeni tablo/fonksiyon ekleyen bir migration kosarsan (or. central/012) bu
-- dosyayi TEKRAR KOS — aksi halde o yeni nesne RLS'siz ve anon-grant'li kalir.
--
-- ISLEM/QUOTE/AGNOSTIKLIK kurallari tenant_hardening.sql ile AYNI:
--   BEGIN/COMMIT YOK (tek islem) · bare `$$` YOK · literal YOK, katalog-guduculdur.
-- =============================================================================

-- --- 1) GRANT KATMANI (fonksiyon EXECUTE'u ONCE — bkz. CLAUDE.md §3-27b/c)
--     Supabase public semada anon+authenticated'e AYRI default-privilege grant'i
--     koyar; `REVOKE ... FROM PUBLIC` tek basina YETMEZ -> daima uc rol birden.
--     BIRINCIL KILIT BUDUR; RLS ikincil katmandir.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
-- NOT (s29 olculdu): FONKSIYONLAR icin default-priv exec_sql yaratma yolunda ETKISIZ; guvence = REVOKE sweep + object-migration sonrasi re-run + verify grant_anon_auth_functions. best-effort, guvenme.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT  ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- --- 2) RLS deny-by-default: HER public base tabloda ENABLE.
--     011 DESENI: tablo-basina BEGIN/EXCEPTION -> `RAISE NOTICE skip`. Sahiplik
--     ya da baska bir sebeple ALTER edilemeyen TEK tablo, kalan tablolarin
--     hardening'ini DUSURMEZ. Atlanan tablo sessiz KALMAZ: verify_hardening.sql
--     `rls_enabled_all_base_tables` satirinda rowsecurity=false olarak FAIL doner.
--     `NOT rowsecurity` filtresi sonucu DEGISTIRMEZ; re-run'da gereksiz
--     ACCESS EXCLUSIVE kilidi almamak icindir.
DO $hg_rls$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename
             FROM pg_tables
            WHERE schemaname = 'public'
              AND NOT rowsecurity
            ORDER BY tablename
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', r.tablename, SQLERRM;
    END;
  END LOOP;
END
$hg_rls$;
