-- =============================================================================
-- 015_allergen_state_isolation.sql
-- Alerjen State İzolasyonu — Bağımsız Mini State Machine
--
-- PROBLEM: allergen_room_verify akışı verification_pending_intent alanına
--   yazıyordu ve normal doğrulama akışıyla çakışıyordu.
--
-- ÇÖZÜM: Alerjen oda-doğrulama state'i tamamen kendi sütunlarına taşındı.
--   verification_pending_intent SADECE normal doğrulama (Modül 10) içindir.
--
-- Yeni sütunlar:
--   allergen_verify_pending    : Misafir oda no + isim doğrulaması bekleniyor mu?
--   allergen_verify_pending_at : TTL için timestamp (24h sonra otomatik temizlenir)
--   allergen_verify_attempts   : Kaç deneme yapıldı? (max 3, sonra temizle)
--
-- Idempotent: IF NOT EXISTS
-- Numara: 015
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS allergen_verify_pending    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergen_verify_pending_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allergen_verify_attempts   INTEGER     NOT NULL DEFAULT 0;

-- İndex: allergen_verify_pending=true olan konuşmaları hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_conversations_allergen_verify_pending
  ON conversations(allergen_verify_pending)
  WHERE allergen_verify_pending = true;
