-- =============================================================================
-- 028_reception_sla_default.sql
-- Resepsiyon SLA varsayilan suresi 15 -> 20 dk (kod fallback ile hizalama).
--
-- PROBLEM: 001_initial_schema.sql reception_sla_minutes NOT NULL DEFAULT 15 idi;
--   check-runner.ts kod fallback'i ise `?? 20`. Kolonu panelden hic degistirmemis
--   yeni tenant'lar 15 ile, kolon null durumu 20 ile calisiyordu -> tutarsizlik.
--   Bu migration DEFAULT'u koda hizalar.
--
-- ETKI: SADECE bundan sonra eklenecek departments satirlarinin DEFAULT'unu
--   degistirir. Mevcut satirlarin DEGERI DEGISMEZ (ALTER COLUMN SET DEFAULT
--   gecmis satirlari yeniden yazmaz). Panelden ayarlanmis degerler korunur.
--
-- Idempotent: SET DEFAULT tekrar calistirilabilir (ayni degeri set eder).
-- Numara: 028
-- =============================================================================

ALTER TABLE departments
  ALTER COLUMN reception_sla_minutes SET DEFAULT 20;
