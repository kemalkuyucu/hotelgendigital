-- Modül 11.2: Çoklu departman intent bekletme
-- Verified DEĞİL misafirin çoklu intent talepleri doğrulama tamamlanana
-- kadar JSONB array olarak bekletilir.
-- Eski tekil kolonlar (verification_pending_intent, pending_request_text)
-- geriye dönük uyum için korunur.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pending_intents_json jsonb NULL;
