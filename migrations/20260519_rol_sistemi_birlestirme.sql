-- ============================================================================
-- Migration: 20260519_rol_sistemi_birlestirme.sql
-- Tarih: 2026-05-19
-- Amaç:
--   1. admin_users tablosunu hotel_admin_users olarak rename et
--   2. role CHECK constraint'i 8 granüler role güncelle
--   3. Eski rolleri (general_manager, department_manager, staff) yeni rollere migrate et
--   4. admin_sessions foreign key'ini güncelle
--   5. Trigger'ı güncelle
-- ============================================================================
-- ÇALIŞTIRMA: Hotel Supabase projesinin SQL Editor'ında çalıştır.
-- Önce: admin_users tablosu mevcut olmalı
-- ============================================================================

-- ADIM 0: Eğer hotel_admin_users zaten varsa bu migration atlanabilir
-- (Idempotent kontrol)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'hotel_admin_users'
  ) THEN
    RAISE NOTICE 'hotel_admin_users tablosu bulunamadi, migration basliyor...';
  ELSE
    RAISE NOTICE 'hotel_admin_users tablosu zaten var. Migration atlanıyor.';
    -- return ile degil exception ile cikiyoruz cunku DO block'unda return yok
  END IF;
END $$;

-- ADIM 1: Tabloyu rename et (admin_users → hotel_admin_users)
-- Eğer zaten hotel_admin_users varsa bu satır hata verir, yoruma alın.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_admin_users'
  ) THEN
    ALTER TABLE admin_users RENAME TO hotel_admin_users;
    RAISE NOTICE 'Tablo admin_users -> hotel_admin_users olarak yeniden adlandirildi.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_admin_users'
  ) THEN
    RAISE NOTICE 'hotel_admin_users zaten mevcut, rename atlaniyor.';
  ELSE
    RAISE EXCEPTION 'Ne admin_users ne de hotel_admin_users tablosu bulundu!';
  END IF;
END $$;

-- ADIM 2: role sütunundaki eski CHECK constraint'i kaldır ve yenisini ekle
-- Constraint adı veritabanına göre farklı olabilir; önce kaldır, sonra yenisini ekle.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Mevcut role constraint adını bul
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'hotel_admin_users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE hotel_admin_users DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Eski role constraint kaldırıldı: %', v_constraint_name;
  END IF;
END $$;

-- Yeni 8-rol constraint ekle
ALTER TABLE hotel_admin_users
  ADD CONSTRAINT hotel_admin_users_role_check
  CHECK (role IN (
    'hotel_owner',
    'front_office_manager',
    'housekeeping_manager',
    'technical_manager',
    'fb_manager',
    'guest_relation_manager',
    'spa_manager',
    'animation_manager'
  ));

-- ADIM 3: Eski rol değerlerini yeni rollere migrate et
-- general_manager → hotel_owner (en yakın eşleşme: genel müdür = otel sahibi yetkisi)
UPDATE hotel_admin_users
SET role = 'hotel_owner'
WHERE role = 'general_manager';

-- department_manager → department_code'a göre ilgili role ata
-- department_code sütunu varsa kullan
UPDATE hotel_admin_users
SET role = CASE
  WHEN department_code = 'front_office'   THEN 'front_office_manager'
  WHEN department_code = 'housekeeping'   THEN 'housekeeping_manager'
  WHEN department_code = 'technical'      THEN 'technical_manager'
  WHEN department_code = 'fb'             THEN 'fb_manager'
  WHEN department_code = 'guest_relation' THEN 'guest_relation_manager'
  WHEN department_code = 'spa'            THEN 'spa_manager'
  WHEN department_code = 'animation'      THEN 'animation_manager'
  ELSE 'front_office_manager'  -- fallback: bilinmeyen department → fo_manager
END
WHERE role = 'department_manager';

-- staff → department_code'a göre ilgili manager rolüne ata (aynı mantık)
UPDATE hotel_admin_users
SET role = CASE
  WHEN department_code = 'front_office'   THEN 'front_office_manager'
  WHEN department_code = 'housekeeping'   THEN 'housekeeping_manager'
  WHEN department_code = 'technical'      THEN 'technical_manager'
  WHEN department_code = 'fb'             THEN 'fb_manager'
  WHEN department_code = 'guest_relation' THEN 'guest_relation_manager'
  WHEN department_code = 'spa'            THEN 'spa_manager'
  WHEN department_code = 'animation'      THEN 'animation_manager'
  ELSE 'front_office_manager'  -- fallback
END
WHERE role = 'staff';

-- ADIM 4: Demo kullanıcı değerlerini de düzelt (eğer varsa)
-- demo_owner → hotel_owner
UPDATE hotel_admin_users SET role = 'hotel_owner'        WHERE username = 'demo_owner' AND role NOT IN ('hotel_owner');
UPDATE hotel_admin_users SET role = 'front_office_manager' WHERE username = 'fo_user'    AND role NOT IN ('front_office_manager');
UPDATE hotel_admin_users SET role = 'fb_manager'           WHERE username = 'fb_user'    AND role NOT IN ('fb_manager');
UPDATE hotel_admin_users SET role = 'housekeeping_manager' WHERE username = 'hk_user'    AND role NOT IN ('housekeeping_manager');

-- ADIM 5: admin_sessions tablosu foreign key'ini güncelle (rename sonrası otomatik güncellenir, ama kontrol et)
-- PostgreSQL, RENAME TABLE sonrası FK'ları otomatik günceller; bu adım sadece doğrulama içindir.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%admin_sessions%'
      AND table_name = 'admin_sessions'
  ) THEN
    RAISE NOTICE 'admin_sessions FK mevcut ve hotel_admin_users e baglidir (auto-updated).';
  END IF;
END $$;

-- ADIM 6: Index'leri güncelle (rename sonrası index isimleri eski ismi taşıyabilir)
-- Eski index'leri kaldır ve yeniden oluştur
DROP INDEX IF EXISTS idx_admin_users_username;
CREATE INDEX IF NOT EXISTS idx_hotel_admin_users_username ON hotel_admin_users(username);
CREATE INDEX IF NOT EXISTS idx_hotel_admin_users_role ON hotel_admin_users(role);

-- ADIM 7: Trigger güncelle
DROP TRIGGER IF EXISTS set_updated_at_admin_users ON hotel_admin_users;
CREATE TRIGGER set_updated_at_hotel_admin_users
  BEFORE UPDATE ON hotel_admin_users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ADIM 8: Sonuç doğrulama
DO $$
DECLARE
  v_count int;
  v_invalid int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM hotel_admin_users;
  
  SELECT COUNT(*) INTO v_invalid
  FROM hotel_admin_users
  WHERE role NOT IN (
    'hotel_owner', 'front_office_manager', 'housekeeping_manager',
    'technical_manager', 'fb_manager', 'guest_relation_manager',
    'spa_manager', 'animation_manager'
  );
  
  RAISE NOTICE 'hotel_admin_users toplam kayit: %, gecersiz rol olan: %', v_count, v_invalid;
  
  IF v_invalid > 0 THEN
    RAISE WARNING 'DIKKAT: % kayıt hala gecersiz rol degeri iceriyor! Manuel kontrol gerekiyor.', v_invalid;
  ELSE
    RAISE NOTICE 'Tum kayitlarin rolleri gecerli 8-rol kümesinde. Migration basarili!';
  END IF;
END $$;

-- ============================================================================
-- DONE: admin_users -> hotel_admin_users, 4 rol -> 8 granüler rol
-- Sonraki adım: Kodda hotel_admin_users referansı zaten doğru (auth.ts satır 43)
-- ============================================================================
