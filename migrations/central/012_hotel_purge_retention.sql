-- =============================================================================
-- migrations/central/012_hotel_purge_retention.sql
-- Otel soft-delete RETENTION + KALICI SILME (purge) veri katmani.
--
-- NE YAPAR:
--   1. hotels: soft-delete kolonlarini garantiye alir (009 zaten kurmustu ->
--      ADD COLUMN IF NOT EXISTS VAR OLANA DOKUNMAZ) + purge_hold bayragi ekler.
--   2. hotel_purge_log: kalici silinen otelin MEZAR TASI kaydi. Otel satiri
--      gittikten SONRA "ne silindi, kim sildi, hangi Supabase projesi kaldi"
--      sorusunun TEK cevabi budur.
--   3. Yeni tabloya central/011 hardening desenini uygular (RLS + REVOKE/GRANT).
--
-- NE YAPMAZ: veri SILMEZ, mevcut kolon/constraint DEGISTIRMEZ. Tamamen ADDITIVE.
--
-- FK YOKTUR (central/010:10-12 karari): hotels soft-delete edilebildigi icin
-- CASCADE istenmez. Bagimli satirlarin silinme SIRASI uygulama katmanindadir
-- (src/lib/hotels/purge-hotel.ts). Bu dosya o siraya KARISMAZ.
--
-- Bu dosya exec_sql RPC ile calisir: BEGIN/COMMIT YOK, bare `$$` YOK
-- (exec_sql'in kendi govdesi `$$` kullanir -> etiketli dollar-quote sart),
-- idempotent (IF NOT EXISTS / katalog guard).
-- =============================================================================

-- --- 1) hotels: soft-delete kolonlari (009 ile AYNI, garanti amacli) ---------
--     ADD COLUMN IF NOT EXISTS var olan kolonun tipine/verisine DOKUNMAZ.
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- --- 2) purge_hold: otomatik purge KILIDI -----------------------------------
--     true -> retention dolsa bile CRON o oteli ATLAR. Manuel purge bunu ASAR
--     ama hotel_purge_log.note'a yazar (sessiz asma YASAK).
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS purge_hold BOOLEAN NOT NULL DEFAULT false;

-- --- 3) hotel_purge_log: kalici silme mezar tasi -----------------------------
--     hotel_id'ye FK KONMAZ: satir zaten silinmis otele isaret eder (FK olsaydi
--     log'un kendisi INSERT edilemezdi). slug NOT NULL cunku isin kimligi odur.
CREATE TABLE IF NOT EXISTS public.hotel_purge_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID,
  slug                  TEXT        NOT NULL,
  hotel_name            TEXT,
  deleted_at            TIMESTAMPTZ,
  purged_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_by             TEXT        NOT NULL,
  mode                  TEXT        NOT NULL CHECK (mode IN ('auto', 'manual')),
  central_deleted       JSONB,
  supabase_project_ref  TEXT,
  note                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_hotel_purge_log_purged_at
  ON public.hotel_purge_log(purged_at DESC);

-- --- 4) HARDENING (central/011 deseni, tabloya OZEL) -------------------------
--     011 sema-genisi sweep yapar; burada YENI tabloyu ANINDA kilitliyoruz ki
--     011 tekrar kosulana kadar acik kalmasin. Supabase public semada
--     anon+authenticated'e AYRI default-privilege grant'i koyar -> `FROM PUBLIC`
--     TEK BASINA YETMEZ, uc rol birden revoke edilir (CLAUDE.md §3-27b).
--     Policy YAZILMAZ: policy yok -> anon/authenticated SIFIR satir gorur;
--     service_role rolbypassrls=true oldugu icin app ETKILENMEZ.
--     FONKSIYON URETILMEDIGI icin fn-REVOKE gerekmez (CLAUDE.md §0 Bulgu B).
ALTER TABLE public.hotel_purge_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hotel_purge_log FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.hotel_purge_log TO service_role;

DO $hg_purge_notice$
BEGIN
  RAISE NOTICE 'Central 012: purge_hold + hotel_purge_log hazir (RLS ON, service_role-only).';
END
$hg_purge_notice$;
