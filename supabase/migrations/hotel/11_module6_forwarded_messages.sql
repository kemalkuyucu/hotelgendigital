-- Modül 6 — Departman forward kayıtları
-- Misafir mesajı AI sınıflandırması sonrası departman Telegram grubuna iletildiğinde bu tablo dolar.

CREATE TABLE IF NOT EXISTS forwarded_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_intent_id     UUID REFERENCES ai_intents(id) ON DELETE SET NULL,

  -- Hedef
  target_department  TEXT NOT NULL,              -- departments.code
  target_chat_id     BIGINT NOT NULL,            -- Telegram grup chat_id

  -- Telegram sonucu
  telegram_message_id INTEGER,                   -- Telegram API'nin döndürdüğü message_id
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  error               TEXT,                      -- Başarısız olursa hata mesajı

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fwd_ai_intent   ON forwarded_messages(ai_intent_id);
CREATE INDEX IF NOT EXISTS idx_fwd_department  ON forwarded_messages(target_department);
CREATE INDEX IF NOT EXISTS idx_fwd_created_at  ON forwarded_messages(created_at DESC);

-- RLS
ALTER TABLE forwarded_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON forwarded_messages
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE forwarded_messages IS 'Modül 6 — Departman Telegram gruplarına iletilen mesaj kayıtları';
