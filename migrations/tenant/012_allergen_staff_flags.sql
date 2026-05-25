-- Migration: 012_allergen_staff_flags.sql
-- Modül 2: Alerjen bildirim alıcı bayrakları
-- Idempotent (IF NOT EXISTS) — BEGIN/COMMIT YOK — exec_sql ile çalıştırılır
-- UYGULANMAZ, sadece dosya olarak saklanır.

ALTER TABLE department_staff ADD COLUMN IF NOT EXISTS is_allergen_primary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE department_staff ADD COLUMN IF NOT EXISTS is_allergen_backup   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE department_staff ADD COLUMN IF NOT EXISTS is_manager           BOOLEAN NOT NULL DEFAULT false;
