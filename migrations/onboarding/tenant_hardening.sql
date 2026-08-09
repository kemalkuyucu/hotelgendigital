-- =============================================================================
-- migrations/onboarding/tenant_hardening.sql
-- YENI TENANT KURULUM PAKETI — TEK DOSYA · IDEMPOTENT · TENANT-AGNOSTIK
--
-- NE ICIN: yeni bir otelin Supabase projesi acilirken, koruma katmaninin TEK
-- adimda ve TEKRARLANABILIR sekilde uygulanmasi.
--
-- TURETILMISTIR — YENI KARAR ICERMEZ. Kaynaklar (numarali sira DEGISMEZ; tenant
-- en yuksek numara hala 032, bu dosya bir migration DEGILDIR ve runner tarafindan
-- GORULMEZ -> schema_migrations'a kayit DUSMEZ):
--   BOLUM 1 <- migrations/tenant/029_processed_telegram_updates.sql
--   BOLUM 2 <- migrations/tenant/030_rate_limit_counters.sql
--   BOLUM 3 <- migrations/tenant/031_sla_events_open_unique.sql
--   BOLUM 4 <- migrations/tenant/032_db_hardening_revoke_anon_rls.sql
-- KOK GEREKCELER (olcum, karar, reddedilen alternatifler) o dosyalarin
-- basliklarindadir; burada YALNIZ uygulama sirasi ve idempotentlik vardir.
--
-- SIRA BAGLAYICIDIR: once NESNE URETIMI (1-3), sonra HARDENING (4).
--   Ters sirada BOLUM 1-2'nin YENI tablolari revoke+RLS kapsamina GIRMEZ
--   (Supabase public semada yeni nesneye anon/authenticated grant'ini otomatik
--   verir) -> tam da kapatmak istedigimiz delik ACIK kalir.
--   AYNI GEREKCE FONKSIYONDA DA GECERLI: BOLUM 2'deki CREATE OR REPLACE,
--   fonksiyona EXECUTE hakkini yeniden acar; BOLUM 4 onu geri kapatir.
--
-- IDEMPOTENT: IF NOT EXISTS / OR REPLACE / REVOKE / GRANT / ENABLE RLS — hepsi
--   tekrar kosulabilir, re-run zararsizdir.
--   RE-RUN GEREKLI OLAN HAL: bu dosyadan SONRA yeni tablo/fonksiyon yaratan bir
--   migration kosarsan hardening'i TEKRAR KOS — aksi halde o yeni nesne
--   RLS'siz ve anon-grant'li kalir.
--
-- ISLEM: BEGIN/COMMIT YOK. Dosya `exec_sql` (postgres-definer) ya da Supabase
--   SQL Editor uzerinden TEK islem olarak kosar; bir bolum patlarsa HICBIRI
--   uygulanmaz (all-or-nothing). Bu ISTENEN davranistir — yarim uygulanmis
--   hardening, hic uygulanmamistan kotudur.
--
-- DOLLAR-QUOTE: bare `$$` KULLANILMAZ; her blok kendi etiketini tasir
--   (`exec_sql`in govdesi `$$` — 030'daki ayni gerekce).
--
-- TENANT-AGNOSTIK: slug / hotel-id / token / bot-id / tablo-adi allowlist'i
--   YOKTUR. Hardening katalog-guduculdur (pg_tables); hangi tablolarin oldugunu
--   DB'nin kendisi soyler.
-- =============================================================================


-- =============================================================================
-- BOLUM 1 — 029: webhook-girisi update_id dedup deposu
-- =============================================================================
CREATE TABLE IF NOT EXISTS processed_telegram_updates (
  hotel_slug TEXT        NOT NULL,
  update_id  BIGINT      NOT NULL,
  seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_slug, update_id)
);

CREATE INDEX IF NOT EXISTS idx_ptu_seen_at ON processed_telegram_updates (seen_at);


-- =============================================================================
-- BOLUM 2 — 030: kalici rate-limit deposu + atomik sayac fonksiyonu
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  hotel_slug   TEXT        NOT NULL,
  scope        TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_slug, scope, subject, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rlc_window_start ON rate_limit_counters (window_start);

-- rate_limit_hit: chat ve otel sayaclarini TEK turda, ATOMIK artirir.
-- (Gerekce — okuma-sonra-yazma yarisi ve tek-RPC karari — 030'un basliginda.)
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_hotel_slug     TEXT,
  p_subject        TEXT,
  p_window_seconds INTEGER
)
RETURNS TABLE (chat_hits INTEGER, hotel_hits INTEGER)
LANGUAGE plpgsql
AS $rate_limit_hit$
DECLARE
  v_window TIMESTAMPTZ;
  v_chat   INTEGER;
  v_hotel  INTEGER;
BEGIN
  -- Sabit pencere: epoch'u pencere boyuna bolup tabana yuvarla.
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO rate_limit_counters AS r (hotel_slug, scope, subject, window_start, hits)
  VALUES (p_hotel_slug, 'chat', p_subject, v_window, 1)
  ON CONFLICT (hotel_slug, scope, subject, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_chat;

  INSERT INTO rate_limit_counters AS r (hotel_slug, scope, subject, window_start, hits)
  VALUES (p_hotel_slug, 'hotel', '*', v_window, 1)
  ON CONFLICT (hotel_slug, scope, subject, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hotel;

  RETURN QUERY SELECT v_chat, v_hotel;
END;
$rate_limit_hit$;


-- =============================================================================
-- BOLUM 3 — 031: ACIK sla_events kaydi icin partial-unique backstop
--
-- to_regclass GUARD: yeni bir projede bu dosya baz semadan (003_sla_events)
-- ONCE kosulabilir. Tablo yoksa index ATLANIR ve dosya patlamaz; 003 kosulduktan
-- sonra bu dosyayi TEKRAR KOS (idempotent).
--
-- CAKISMA = FAIL-LOUD (bilincli, CLAUDE.md §3-26d): tabloda ACIK alt kumede
-- (responded_at IS NULL AND closed_at IS NULL) ayni (conversation_id,
-- department_code, request_text) cakismasi VARSA `CREATE UNIQUE INDEX` PATLAR ve
-- tum dosya geri alinir. Bu ISTENEN davranistir — sessizce yarim uygulanmasindansa
-- dusmeli. Uygulamadan once olcum sorgusu ONBOARDING_HARDENING.md'de.
-- Bos bir onboarding DB'sinde bu risk YOKTUR (satir yok).
-- =============================================================================
DO $hg_sla_idx$
BEGIN
  IF to_regclass('public.sla_events') IS NULL THEN
    RAISE NOTICE '[031] sla_events tablosu YOK -> partial-unique ATLANDI (baz sema kosulunca bu dosyayi TEKRAR KOS)';
  ELSE
    EXECUTE
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_sla_events_open_request '
      || 'ON public.sla_events (conversation_id, department_code, md5(request_text)) '
      || 'WHERE responded_at IS NULL AND closed_at IS NULL';
  END IF;
END
$hg_sla_idx$;


-- =============================================================================
-- BOLUM 4 — 032: DB-KATMAN HARDENING (defense-in-depth)
--
-- anon/authenticated/PUBLIC'i tablo+sequence+fonksiyondan kilitle, service_role'e
-- geri ver (app runtime + tsql YALNIZ service_role kullanir -> app BOZULMAZ), her
-- public tabloda RLS'i deny-by-default ac (policy yok -> anon/authenticated SIFIR
-- satir; service_role rolbypassrls=true -> etkilenmez).
-- =============================================================================

-- --- 4a) OWNER-ASSERT — RLS ENABLE'DAN ONCE, FAIL-LOUD (CLAUDE.md §3-27d)
--     `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` yalniz tablo SAHIBINCE
--     yapilabilir. Sahibi postgres olmayan tek bir public tablo, 4c dongusunu
--     ortasinda patlatir. Onun yerine BURADA dur ve NEYIN engelledigini soyle.
DO $hg_owner_assert$
DECLARE
  v_bad  INTEGER;
  v_list TEXT;
BEGIN
  SELECT count(*),
         left(coalesce(string_agg(format('%s(owner=%s)', tablename, tableowner), ', ' ORDER BY tablename), ''), 500)
    INTO v_bad, v_list
    FROM pg_tables
   WHERE schemaname = 'public'
     AND tableowner <> 'postgres';

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'OWNER-ASSERT: % public tablo postgres-owned DEGIL -> %', v_bad, v_list
      USING HINT = 'Once sahipligi duzelt (ALTER TABLE public.<tablo> OWNER TO postgres), sonra bu dosyayi TEKRAR KOS. RLS ENABLE tablo sahipligi ister.';
  END IF;
END
$hg_owner_assert$;

-- --- 4b) GRANT KATMANI
--     Supabase public semada anon+authenticated'e AYRI default-privilege grant'i
--     koyar; `REVOKE ... FROM PUBLIC` tek basina YETMEZ -> daima uc rol birden
--     (CLAUDE.md §3-27b). ALTER DEFAULT PRIVILEGES GELECEK nesneleri de keser
--     (yalniz bu dosyayi kosan rolun yarattiklari icin — bkz. .md "Re-run").
--     SIRA: fonksiyon EXECUTE'u ONCE kesilir; `exec_sql` (SECURITY DEFINER,
--     owner=postgres) anon'a acik kaldigi surece anon RLS'i BYPASS eder
--     (CLAUDE.md §3-27c).
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

-- --- 4c) RLS deny-by-default: HER public base tabloda ENABLE.
--     `NOT rowsecurity` filtresi SONUCU DEGISTIRMEZ (zaten acik olanda ALTER
--     no-op'tur); amaci re-run'da her tablo icin gereksiz ACCESS EXCLUSIVE kilidi
--     almamaktir. Policy YAZILMAZ: policy yok = deny-by-default; service_role
--     rolbypassrls=true oldugu icin app ETKILENMEZ.
DO $hg_rls$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename
             FROM pg_tables
            WHERE schemaname = 'public'
              AND NOT rowsecurity
            ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$hg_rls$;
