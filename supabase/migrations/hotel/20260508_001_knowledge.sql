-- ============================================================
-- MODÜL 7: Knowledge Base — hotel_facts + knowledge_sections
-- ============================================================

CREATE TABLE IF NOT EXISTS hotel_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key TEXT NOT NULL UNIQUE,
  fact_value TEXT NOT NULL,
  fact_label TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hotel_facts_category_check CHECK (
    category IN ('general','pool','restaurant','spa','rooms','beach','wifi','contact','other')
  )
);

CREATE INDEX IF NOT EXISTS hotel_facts_category_idx ON hotel_facts(category);
CREATE INDEX IF NOT EXISTS hotel_facts_is_active_idx ON hotel_facts(is_active);

CREATE TABLE IF NOT EXISTS knowledge_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sections_is_active_idx ON knowledge_sections(is_active);
CREATE INDEX IF NOT EXISTS knowledge_sections_content_search_idx
  ON knowledge_sections USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')));

-- updated_at trigger
CREATE OR REPLACE FUNCTION knowledge_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hotel_facts_set_updated_at ON hotel_facts;
CREATE TRIGGER hotel_facts_set_updated_at
  BEFORE UPDATE ON hotel_facts
  FOR EACH ROW EXECUTE FUNCTION knowledge_set_updated_at();

DROP TRIGGER IF EXISTS knowledge_sections_set_updated_at ON knowledge_sections;
CREATE TRIGGER knowledge_sections_set_updated_at
  BEFORE UPDATE ON knowledge_sections
  FOR EACH ROW EXECUTE FUNCTION knowledge_set_updated_at();

-- ============================================================
-- DOĞRULAMA SORGUSU (migration sonrası çalıştır):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name IN ('hotel_facts','knowledge_sections')
-- ORDER BY table_name, ordinal_position;
-- Beklenen: 9 satır hotel_facts + 8 satır knowledge_sections
-- ============================================================
