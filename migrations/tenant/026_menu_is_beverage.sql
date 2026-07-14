-- =============================================================================
-- 026_menu_is_beverage.sql
-- Yiyecek/icecek ayrimi: siparise "not var mi?" sorusu SADECE yiyecek iceren
-- siparislerde cikar. Icecek notu (kolasiz kola vb.) anlamsiz oldugu icin
-- sadece-icecek siparislerinde not adimi atlanir.
--
-- Yeni sutun:
--   is_beverage : Bu urun icecek mi? (BOOLEAN, is_paid ikizi)
--                 DEFAULT false -> mevcut tum urunler "yiyecek" sayilir,
--                 davranis bugunku ile ayni kalir. Otel panelden icecekleri
--                 isaretledikce not adimi incelir.
--
-- Desen: 023/025 ile ayni. Idempotent: IF NOT EXISTS. Mevcut kolonlara dokunmaz.
-- Numara: 026
-- =============================================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_beverage BOOLEAN NOT NULL DEFAULT false;
