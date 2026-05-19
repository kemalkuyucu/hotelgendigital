-- =============================================================================
-- 004_module15_iban.sql
-- Modül 15 — IBAN structured form (hotel_documents'ta structured_data kolonu
-- ve delivery_policy kolonu zaten 001'de eklendi; bu migration sadece
-- gerekli index ve constraint'leri ekler)
-- =============================================================================

BEGIN;

-- hotel_documents.delivery_policy için check constraint (güvenli ekleme)
DO $$ BEGIN
  ALTER TABLE hotel_documents
    ADD CONSTRAINT hotel_documents_delivery_policy_check
    CHECK (delivery_policy IN ('manual_only', 'auto_file', 'auto_text'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- delivery_policy index
CREATE INDEX IF NOT EXISTS idx_hotel_documents_delivery_policy
  ON hotel_documents(delivery_policy);

-- ai_auto_send kolonu eklenmemişse ekle
ALTER TABLE hotel_documents
  ADD COLUMN IF NOT EXISTS ai_auto_send BOOLEAN DEFAULT FALSE;

ALTER TABLE hotel_documents
  ADD COLUMN IF NOT EXISTS structured_data JSONB;

ALTER TABLE hotel_documents
  ADD COLUMN IF NOT EXISTS display_text TEXT;

COMMIT;
