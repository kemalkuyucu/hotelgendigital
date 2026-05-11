-- =============================================================
-- Modül 10.1 Patch
--  1. gender kolonu (in-house guests)
--  2. 3 seed misafiri male olarak işaretle
--  3. forwarded_messages target_type enum'una unverified_alert ekle
-- =============================================================

BEGIN;

-- 1) gender kolonu
ALTER TABLE inhouse_guests
  ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female') OR gender IS NULL);

COMMENT ON COLUMN inhouse_guests.gender IS
  'Misafir cinsiyeti — salutation üretmek için (male/female/NULL)';

-- 2) Seed güncelleme — 3 demo misafir male
UPDATE inhouse_guests SET gender = 'male'
WHERE room_number IN ('215', '312', '408');

-- 3) target_type enum'una unverified_alert ekle (eğer enum tipindeyse)
-- Eğer TEXT kolonsa bu satıra gerek yok
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forward_target_type') THEN
    ALTER TYPE forward_target_type ADD VALUE IF NOT EXISTS 'unverified_alert';
  END IF;
END$$;

COMMIT;
