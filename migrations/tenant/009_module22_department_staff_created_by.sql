-- =============================================================================
-- 009_module22_department_staff_created_by.sql
-- Modül 22 Katman 2: department_staff tablosuna created_by kolonu ekle
-- Idempotent: DO $$ ile kolon zaten varsa atlar.
-- =============================================================================

DO $$
BEGIN
  -- created_by kolonu yoksa ekle
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'department_staff'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE department_staff
      ADD COLUMN created_by TEXT;
  END IF;
END;
$$;
