-- Modül 5 — AI Intent kayıtları
-- Misafir mesajı geldiğinde Claude classification sonucu burada saklanır

CREATE TABLE IF NOT EXISTS ai_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  bot_message_id UUID REFERENCES bot_messages(id) ON DELETE SET NULL,

  -- Sınıflandırma sonucu
  classified_department TEXT,                -- departments.code ile eşleşir, NULL = sınıflandırılamadı
  confidence NUMERIC(3,2),                   -- 0.00 - 1.00
  reasoning TEXT,                            -- Claude'un departman seçim gerekçesi (kısa)
  ai_response TEXT,                          -- Claude'un misafire ürettiği cevap

  -- Telemetri
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  error TEXT,                                -- AI çağrısı başarısızsa hata mesajı

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_intents_conversation ON ai_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_intents_department ON ai_intents(classified_department);
CREATE INDEX IF NOT EXISTS idx_ai_intents_created_at ON ai_intents(created_at DESC);

-- RLS
ALTER TABLE ai_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON ai_intents
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE ai_intents IS 'Modül 5 — Claude tarafından üretilen departman sınıflandırması ve cevap kayıtları';
