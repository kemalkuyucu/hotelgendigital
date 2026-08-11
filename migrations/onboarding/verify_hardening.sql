-- =============================================================================
-- migrations/onboarding/verify_hardening.sql
-- HARDENING DOGRULAMA — SALT-OKUMA · TEK SELECT · TENANT-AGNOSTIK
--
-- CIKTI: check_name | detail | status   (status = 'PASS' | 'FAIL')
-- YAZMA/DDL YOKTUR. Tek bir SELECT deyimidir -> tsql'in `exec_sql_json`
-- sarmalayicisi (alt-sorgu) icinde de kosar; Supabase SQL Editor'e de yapistirilir.
--
-- NEREDE KOSULUR:
--   TENANT  -> TUM satirlar baglayicidir; hepsi PASS olmali.
--   CENTRAL -> yalniz `grant_*` ve `rls_*` satirlari baglayicidir.
--              `tenant_obj_*` satirlari Central'da FAIL gorunur ve BEKLENENDIR
--              (o nesneler tenant'a aittir; Central'da karsiliklari YOKTUR).
--
-- OLCUM NOTLARI (yanlis-yesil'e karsi):
--   * `has_table_privilege` / `has_function_privilege` / `has_sequence_privilege`
--     hakki DOGRUDAN, PUBLIC uzerinden ve rol uyeligi uzerinden TOPLAM olarak
--     olcer -> unutulmus bir `GRANT ... TO PUBLIC` de bu kontrolde YAKALANIR.
--   * grant taramasi yalniz tabloyu degil, hak tasiyabilen TUM public nesneleri
--     kapsar (tablo, partition, view, matview, foreign table).
--   * SEQUENCE AYRI bir kontroldur: sequence'ler relkind 'S' oldugu icin
--     `rel_grantable` kapsaminda DEGILDIR -> tablo kontrolu onlari GORMEZ.
--     (Bulgu B'nin sequence tarafi: `ALTER DEFAULT PRIVILEGES ... ON SEQUENCES`
--      best-effort'tur, guvence ACIK REVOKE + bu kontroldur.)
--   * RLS yalniz base tabloda anlamlidir (view'da RLS yoktur) -> o kontrol
--     relkind r/p ile sinirlidir.
--   * roller katalogdan okunur; `anon`/`authenticated` yoksa taranan rol sayisi
--     detail'de GORUNUR (sifir rol = sessiz PASS degil, gorunur PASS).
-- =============================================================================

WITH rel_all AS (
  SELECT c.oid, c.relname::text AS relname, c.relkind, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
),
rel_grantable AS (
  SELECT oid, relname FROM rel_all WHERE relkind IN ('r', 'p', 'v', 'm', 'f')
),
rel_base AS (
  SELECT oid, relname, relrowsecurity FROM rel_all WHERE relkind IN ('r', 'p')
),
seq_all AS (
  SELECT oid, relname FROM rel_all WHERE relkind = 'S'
),
fn_all AS (
  SELECT p.oid, p.proname::text AS proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
),
guest_role AS (
  SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
),
svc_role AS (
  SELECT rolname FROM pg_roles WHERE rolname = 'service_role'
),
tbl_priv AS (
  SELECT priv FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS t(priv)
),
seq_priv AS (
  SELECT priv FROM unnest(ARRAY['USAGE','SELECT','UPDATE']) AS t(priv)
),
bad_tbl AS (
  SELECT DISTINCT r.relname
    FROM rel_grantable r
   CROSS JOIN guest_role g
   CROSS JOIN tbl_priv t
   WHERE has_table_privilege(g.rolname, r.oid, t.priv)
),
bad_seq AS (
  SELECT DISTINCT s.relname
    FROM seq_all s
   CROSS JOIN guest_role g
   CROSS JOIN seq_priv p
   WHERE has_sequence_privilege(g.rolname, s.oid, p.priv)
),
bad_fn AS (
  SELECT DISTINCT f.proname
    FROM fn_all f
   CROSS JOIN guest_role g
   WHERE has_function_privilege(g.rolname, f.oid, 'EXECUTE')
),
bad_rls AS (
  SELECT relname FROM rel_base WHERE NOT relrowsecurity
),
bad_svc AS (
  SELECT r.relname
    FROM rel_base r
   CROSS JOIN svc_role s
   WHERE NOT (has_table_privilege(s.rolname, r.oid, 'SELECT')
          AND has_table_privilege(s.rolname, r.oid, 'INSERT')
          AND has_table_privilege(s.rolname, r.oid, 'UPDATE')
          AND has_table_privilege(s.rolname, r.oid, 'DELETE'))
),
cnt AS (
  SELECT
    (SELECT count(*) FROM rel_grantable)                                   AS n_rel,
    (SELECT count(*) FROM rel_base)                                        AS n_base,
    (SELECT count(*) FROM fn_all)                                          AS n_fn,
    (SELECT count(*) FROM seq_all)                                         AS n_seq,
    (SELECT count(*) FROM guest_role)                                      AS n_guest,
    (SELECT count(*) FROM svc_role)                                        AS n_svc,
    (SELECT count(*) FROM bad_tbl)                                         AS n_bad_tbl,
    (SELECT left(coalesce(string_agg(relname, ', ' ORDER BY relname), ''), 160) FROM bad_tbl) AS s_bad_tbl,
    (SELECT count(*) FROM bad_fn)                                          AS n_bad_fn,
    (SELECT left(coalesce(string_agg(proname, ', ' ORDER BY proname), ''), 160) FROM bad_fn)  AS s_bad_fn,
    (SELECT count(*) FROM bad_seq)                                         AS n_bad_seq,
    (SELECT left(coalesce(string_agg(relname, ', ' ORDER BY relname), ''), 160) FROM bad_seq) AS s_bad_seq,
    (SELECT count(*) FROM bad_rls)                                         AS n_bad_rls,
    (SELECT left(coalesce(string_agg(relname, ', ' ORDER BY relname), ''), 160) FROM bad_rls) AS s_bad_rls,
    (SELECT count(*) FROM bad_svc)                                         AS n_bad_svc,
    (SELECT left(coalesce(string_agg(relname, ', ' ORDER BY relname), ''), 160) FROM bad_svc) AS s_bad_svc,
    (to_regclass('public.processed_telegram_updates') IS NOT NULL)         AS has_ptu,
    (to_regclass('public.rate_limit_counters') IS NOT NULL)                AS has_rlc,
    (to_regclass('public.sla_events') IS NOT NULL)                         AS has_sla,
    (EXISTS (SELECT 1 FROM pg_indexes
              WHERE schemaname = 'public'
                AND indexname = 'uq_sla_events_open_request'))             AS has_uq,
    (EXISTS (SELECT 1 FROM fn_all WHERE proname = 'rate_limit_hit'))       AS has_rlh
)
SELECT check_name, detail, status
  FROM (
    -- (a) anon/authenticated HICBIR public nesnede tablo hakki tasimamali
    SELECT 1 AS ord,
           'grant_anon_auth_tables'::text AS check_name,
           format('%s public nesne x %s rol (anon/authenticated) tarandi; hak tasiyan=%s%s',
                  n_rel, n_guest, n_bad_tbl,
                  CASE WHEN n_bad_tbl > 0 THEN ' -> ' || s_bad_tbl ELSE '' END)::text AS detail,
           (CASE WHEN n_bad_tbl = 0 THEN 'PASS' ELSE 'FAIL' END)::text AS status
      FROM cnt

    UNION ALL
    -- (a2) anon/authenticated HICBIR public fonksiyonda EXECUTE tasimamali
    --      (canli acigin kok vektoru: exec_sql = SECURITY DEFINER/postgres)
    SELECT 2,
           'grant_anon_auth_functions',
           format('%s public fonksiyon x %s rol tarandi; EXECUTE tasiyan=%s%s',
                  n_fn, n_guest, n_bad_fn,
                  CASE WHEN n_bad_fn > 0 THEN ' -> ' || s_bad_fn ELSE '' END),
           CASE WHEN n_bad_fn = 0 THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- (a3) anon/authenticated HICBIR public sequence'te USAGE/SELECT/UPDATE
    --      tasimamali. Sequence'ler tablo taramasinin DISINDADIR (relkind 'S'),
    --      o yuzden ayri olculur: SELECT/UPDATE nextval/setval kadar tehlikeli
    --      olmasa da sayac degerini okutur/kaydirir; USAGE dogrudan nextval'dir.
    SELECT 3,
           'grant_anon_auth_sequences',
           format('%s public sequence x %s rol tarandi; hak tasiyan=%s%s',
                  n_seq, n_guest, n_bad_seq,
                  CASE WHEN n_bad_seq > 0 THEN ' -> ' || s_bad_seq ELSE '' END),
           CASE WHEN n_bad_seq = 0 THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- (b) TUM public base tablolarda RLS acik olmali
    SELECT 4,
           'rls_enabled_all_base_tables',
           format('%s public base tablo; RLS KAPALI=%s%s',
                  n_base, n_bad_rls,
                  CASE WHEN n_bad_rls > 0 THEN ' -> ' || s_bad_rls ELSE '' END),
           CASE WHEN n_bad_rls = 0 THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- (EK) app-bozulmadi invaryanti: service_role CRUD'u KAYBETMEMELI
    --      (CLAUDE.md §3-27e — REVOKE'lar app'i bozmamali)
    SELECT 5,
           'grant_service_role_crud',
           CASE WHEN n_svc = 0
                THEN 'service_role rolu YOK -> app bu DB ile calisamaz'
                ELSE format('%s base tablo tarandi; CRUD eksik=%s%s',
                            n_base, n_bad_svc,
                            CASE WHEN n_bad_svc > 0 THEN ' -> ' || s_bad_svc ELSE '' END)
           END,
           CASE WHEN n_svc = 0 THEN 'FAIL'
                WHEN n_bad_svc = 0 THEN 'PASS'
                ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- (c) zorunlu nesneler
    SELECT 6,
           'tenant_obj_processed_telegram_updates',
           CASE WHEN has_ptu THEN 'tablo VAR' ELSE 'tablo YOK (tenant_hardening.sql BOLUM 1)' END,
           CASE WHEN has_ptu THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    SELECT 7,
           'tenant_obj_rate_limit_counters',
           CASE WHEN has_rlc THEN 'tablo VAR' ELSE 'tablo YOK (tenant_hardening.sql BOLUM 2)' END,
           CASE WHEN has_rlc THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- (EK) sayac tablosu tek basina yetmez; fonksiyon yoksa rate-limit
    --      FAIL-OPEN calisir (sessizce korumasiz) -> ayrica olculur
    SELECT 8,
           'tenant_obj_rate_limit_hit_fn',
           CASE WHEN has_rlh THEN 'fonksiyon VAR' ELSE 'fonksiyon YOK -> rate-limit FAIL-OPEN kosar (koruma YOK)' END,
           CASE WHEN has_rlh THEN 'PASS' ELSE 'FAIL' END
      FROM cnt

    UNION ALL
    -- sla_events YOKSA index beklenmez (baz sema henuz kosmamis olabilir)
    SELECT 9,
           'tenant_obj_uq_sla_events_open_request',
           CASE WHEN NOT has_sla THEN 'sla_events tablosu YOK -> index BEKLENMIYOR'
                WHEN has_uq      THEN 'partial-unique index VAR'
                ELSE 'sla_events VAR ama index YOK (tenant_hardening.sql BOLUM 3 TEKRAR KOS)' END,
           CASE WHEN NOT has_sla THEN 'PASS'
                WHEN has_uq      THEN 'PASS'
                ELSE 'FAIL' END
      FROM cnt
  ) v
 ORDER BY v.ord;
