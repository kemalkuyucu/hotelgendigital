-- =============================================================
-- Modul 10.4 Patch
--   1. conversations.pending_request_text kolonu
--      Dogrulama oncesi orijinal talep saklanir, dogrulama sonrasi
--      forward icin kullanilir ve NULL'a doner.
-- =============================================================

BEGIN;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pending_request_text TEXT;

COMMENT ON COLUMN conversations.pending_request_text IS
  'Dogrulama akisi basladiginda saklanan orijinal misafir talebi. Dogrulama tamamlanip forward edildiginde NULL''a doner.';

COMMIT;
