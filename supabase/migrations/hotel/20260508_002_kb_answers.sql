-- ============================================================
-- MODÜL 7.1: Knowledge Answers — KB'den verilen cevapları logla
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  predicted_intent TEXT,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_answers_conversation_idx ON knowledge_answers(conversation_id);
CREATE INDEX IF NOT EXISTS knowledge_answers_created_at_idx ON knowledge_answers(created_at DESC);

-- ============================================================
-- DOĞRULAMA SORGUSU (migration sonrası çalıştır):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_answers' ORDER BY ordinal_position;
-- Beklenen: 6 kolon
-- (id, conversation_id, predicted_intent, question_text, answer_text, created_at)
-- ============================================================
