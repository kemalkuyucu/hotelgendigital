-- =============================================================================
-- 024_menu_image.sql
-- Room-service menu gorseli (fiyat listesi). JSONB dizi: cok sayfali menu destegi.
-- sendPhotos imageUrls[] aliyor.
--
-- hotel_settings singleton bir tablodur (otel DB'sinde tek satir); 016/017/023 de
-- otel-bazli ayarlari ayni sekilde ADD COLUMN ile ekliyor.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS
-- Numara: 024
-- =============================================================================

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS menu_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
