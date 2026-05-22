-- =============================================================================
-- migrations/central/009_soft_delete_hotels.sql
-- Modül 21: Central DB — hotels tablosu soft delete kolonları
--
-- NOT: Bu migration zaten Central DB'de elle uygulandı.
--      IF NOT EXISTS / DO $$ bloklarıyla idempotent yazıldı.
--      Runner çalışınca hata vermez, sadece schema_migrations'a kaydeder.
--
-- BEGIN/COMMIT KULLANILMAZ (exec_sql ile uyumsuz).
-- =============================================================================

-- 1. deleted_at sütunu: soft-delete timestamp
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. deleted_by sütunu: hangi admin sildi (UUID veya username)
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 3. Performans indeksi: silinmemiş otelleri hızlı filtrele
CREATE INDEX IF NOT EXISTS idx_hotels_deleted_at
  ON public.hotels(deleted_at)
  WHERE deleted_at IS NULL;

-- 4. status CHECK constraint güncelleme
--    Mevcut constraint'i DROP edip yeniden CREATE etmek,
--    IF NOT EXISTS desteklemediği için idempotent DO bloğu kullan.
DO $$
BEGIN
  -- Mevcut hotels_status_check constraint'i varsa düşür
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'hotels'
      AND constraint_name = 'hotels_status_check'
  ) THEN
    ALTER TABLE public.hotels DROP CONSTRAINT hotels_status_check;
  END IF;

  -- Yeni constraint: 'deleted' değerini de içerir
  ALTER TABLE public.hotels
    ADD CONSTRAINT hotels_status_check
    CHECK (status IN ('active', 'suspended', 'cancelled', 'demo', 'deleted'));

  RAISE NOTICE 'Central DB 009: hotels_status_check constraint güncellendi.';
END;
$$;
