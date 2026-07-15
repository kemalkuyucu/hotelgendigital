-- =============================================================================
-- 027_hk_pending.sql
-- Housekeeping coklu-esya buton akisi state
--
-- Kod conversations.hk_pending / hk_pending_text kolonlarina yazip okur
-- (route.ts hk coklu-esya kapisi + handle-housekeeping-callback.ts). order_pending
-- (022) ikizi: BOOLEAN bayrak + TEXT eslikci (JSON state).
--
-- Yeni sutunlar:
--   hk_pending      : Housekeeping esya tip/adet butonlari yaniti bekleniyor mu?
--   hk_pending_text : Cozulmemis esya state'i JSON ({ items:[{c,q,a}], i })
--
-- Idempotent: IF NOT EXISTS
-- Numara: 027
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS hk_pending      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hk_pending_text TEXT;
