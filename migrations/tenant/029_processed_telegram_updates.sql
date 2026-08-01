-- =============================================================================
-- 029_processed_telegram_updates.sql
-- Webhook-girisi update_id dedup deposu (backlog #3)
--
-- Telegram, yaniti gec/hatali gorurse AYNI update'i TEKRAR gonderir. Koruma
-- bugune kadar akis-basinaydi (order: M1 atomik claim; note:/hk: yalniz damga).
-- Bu tablo retry'i TEK GIRISTE keser: src/lib/telegram/update-dedup.ts
-- claimTelegramUpdate() PRIMARY KEY catismasini "zaten islendi" karari olarak
-- kullanir (okuma-sonra-yazma YOK -> es zamanlilikta da guvenli).
--
-- Kolonlar:
--   hotel_slug : update_id BOT BAZINDA artar, global DEGIL -> slug anahtarin
--                parcasi olmali; yoksa bir otelin update'i digerini susturur.
--   update_id  : BIGINT — Telegram degeri int32'yi asabilir.
--   seen_at    : TTL temizligi icin (cron/health-check 24 saatten eskiyi siler).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS
-- Numara: 029
-- =============================================================================

CREATE TABLE IF NOT EXISTS processed_telegram_updates (
  hotel_slug TEXT        NOT NULL,
  update_id  BIGINT      NOT NULL,
  seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_slug, update_id)
);

CREATE INDEX IF NOT EXISTS idx_ptu_seen_at ON processed_telegram_updates (seen_at);
