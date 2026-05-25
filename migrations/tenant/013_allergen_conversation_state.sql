-- =============================================================================
-- 013_allergen_conversation_state.sql
-- Alerjen Modülü 3 — Konuşma State Sütunları
-- conversations tablosuna alerji soru takibi için iki boolean sütun ekler.
--   allergen_asked   : Bu konaklama/konuşma için alerji sorusu soruldu mu?
--   allergen_pending : Şu an misafirden alerji cevabı bekleniyor mu?
-- Idempotent: IF NOT EXISTS — exec_sql RPC ile çalıştırılır (BEGIN/COMMIT yok)
-- UYGULANMAZ, sadece dosya olarak saklanır.
-- =============================================================================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS allergen_asked  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS allergen_pending BOOLEAN NOT NULL DEFAULT false;
