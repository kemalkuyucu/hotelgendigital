-- ============================================================
-- Modül 19: Otel Soft Delete
-- Çalıştır: /admin/migrations arayüzünden veya exec_sql ile
-- NOT: BEGIN/COMMIT kullanılmadı (exec_sql uyumsuz)
-- ============================================================

-- 1. deleted_at sütunu ekle
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. deleted_by sütunu ekle (hangi admin sildi)
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 3. status enum/text kontrolü: 'deleted' değerini ekle
--    Eğer status bir TEXT sütunuysa bu satır gerekli değil; yorum satırına alındı
--    Eğer enum ise aşağıdaki satırı yorumdan çıkar:
-- ALTER TYPE hotel_status ADD VALUE IF NOT EXISTS 'deleted';

-- 4. Performans: silinmemiş otelleri hızlı filtrele
CREATE INDEX IF NOT EXISTS idx_hotels_deleted_at
  ON hotels(deleted_at)
  WHERE deleted_at IS NULL;

-- 5. Audit log: hotel_soft_delete action renk sınıfı için hazırlık
--    (audit_log tablosu zaten mevcut; ek sütun gerekmez)
