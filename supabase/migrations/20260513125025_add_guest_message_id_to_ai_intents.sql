-- Modül 11.2: Çoklu departman intent routing
-- Aynı misafir mesajından çıkan birden fazla ai_intents kaydını birbirine bağlar
ALTER TABLE ai_intents
  ADD COLUMN IF NOT EXISTS guest_message_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_ai_intents_guest_message_id
  ON ai_intents (guest_message_id)
  WHERE guest_message_id IS NOT NULL;
