-- =============================================================================
-- 023_menu_catalog.sql
-- Room Service Katalog Sistemi: menu urunleri (kod+fiyat+gorsel) + siparis kaydi
--
-- PROBLEM: menu_items tablosu kodda kullaniliyor (hotel-context.ts fetchMenuItems,
--   hotel-admin menu/items API, route.ts isOrderInMenu) ama hicbir migration'da
--   tanimli degildi -- order_pending ile ayni hastalik. Ayrica urun KODU ve GORSEL
--   alani yoktu; siparis kalemleri ve tutar hicbir yere kaydedilmiyordu.
--
-- COZUM: menu_items'i idempotent olustur (varsa dokunma) + item_code / image_url /
--   description kolonlarini ekle; siparis kalemlerini ve tutari tutan yeni
--   room_service_orders tablosunu ac; misafire fiyat gosterilip gosterilmeyecegini
--   belirleyen show_price_to_guest bayragini hotel_settings'e ekle (varsayilan:
--   gizli -- tutar personel kartinda gorunur, misafire gosterilmez).
--
-- NOT: eski, kullanilmayan fb_room_service_orders tablosuna (001_initial_schema)
--   DOKUNULMAZ -- o tablo requests(id)'ye FK'li, bugunku akis sla_events kullaniyor.
--
-- Idempotent: CREATE TABLE / ADD COLUMN / CREATE INDEX -- hepsi IF NOT EXISTS
-- Numara: 023
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) MENU URUNLERI (varsa dokunmaz, yoksa olusturur)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     TEXT        NOT NULL,
  category      TEXT,
  price         NUMERIC     DEFAULT 0,
  currency      TEXT        DEFAULT 'TRY',
  is_paid       BOOLEAN     NOT NULL DEFAULT true,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  display_order INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Yeni katalog alanlari (mevcut menu_items'a da guvenli sekilde eklenir)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS item_code   TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Urun kodu otel icinde benzersiz (bos/null haric). Koddan siparis icin sart.
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_item_code_uniq
  ON menu_items (item_code) WHERE item_code IS NOT NULL AND item_code <> '';

-- ---------------------------------------------------------------------------
-- 2) ROOM SERVICE SIPARISLERI (yeni tablo -- fb_room_service_orders'a DOKUNMA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_service_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID,
  room_number      TEXT,
  guest_name       TEXT,
  platform         TEXT,                                    -- 'telegram' vs
  platform_user_id TEXT,
  items            JSONB       NOT NULL DEFAULT '[]'::jsonb, -- [{code,name,qty,unit_price}]
  total_amount     NUMERIC     DEFAULT 0,                    -- personel kartinda gorunur
  currency         TEXT        DEFAULT 'TRY',
  status           TEXT        NOT NULL DEFAULT 'pending',   -- pending|confirmed|delivered|cancelled
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_service_orders_conv_idx
  ON room_service_orders (conversation_id, status);

-- ---------------------------------------------------------------------------
-- 3) OTEL AYARI: misafire fiyat goster/gizle
-- Otel-bazli ayarlar hotel_settings'te tutuluyor (001_initial_schema.sql:81);
-- 016/017 de ayni sekilde bu tabloya ADD COLUMN ile ayar ekliyor.
-- Varsayilan false = Yol 1 (misafire fiyat gosterme, tutar sadece personel kartinda).
-- ---------------------------------------------------------------------------
ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS show_price_to_guest BOOLEAN NOT NULL DEFAULT false;
