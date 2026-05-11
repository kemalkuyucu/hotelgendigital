-- ============================================================
-- Modül 10 — Verification State Reset
-- Bu script'i Supabase SQL Editor'da MANUEL çalıştır.
-- Eski test denemelerinden birikmiş verification_attempts
-- ve ilişkili sütunları sıfırlar, kilit açılır.
-- ============================================================

UPDATE conversations
SET
  verification_attempts            = 0,
  verification_pending_intent      = NULL,
  verification_last_attempt_at     = NULL,
  verified_inhouse_guest_id        = NULL,
  verified_at                      = NULL;