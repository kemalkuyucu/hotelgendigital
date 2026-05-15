-- ============================================================
-- Migration: add_holidays_to_departments
-- Description: holidays kolonu departments tablosuna eklenir.
--   Format: [{ "date": "2026-01-01", "label": "Yılbaşı" }, ...]
-- ============================================================
--
-- KULLANIM TALİMATI (Manuel):
--   1. Supabase Dashboard → SQL Editor'ü aç
--   2. Bu dosyanın tamamını yapıştır
--   3. "Run" düğmesine bas
--   (Antigravity bu SQL'i Supabase'e direkt push edemez,
--    kullanıcı manuel olarak çalıştırmalıdır.)
--
-- ============================================================

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb;

-- Optionally add a comment for documentation
COMMENT ON COLUMN departments.holidays IS
  'JSON array of holiday entries: [{ "date": "YYYY-MM-DD", "label": "string" }]';
