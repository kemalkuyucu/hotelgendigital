-- =============================================================================
-- MODÜL 9: knowledge_documents tablosu + knowledge_sections.source_document_id
-- =============================================================================
-- Supabase Studio > SQL Editor'de manuel çalıştır.
-- Önce knowledge_set_updated_at() trigger fonksiyonunun mevcut olduğundan emin ol
-- (20260508_001_knowledge.sql'de tanımlanmıştır).

-- ---------------------------------------------------------------------------
-- 1. knowledge_documents tablosu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key       TEXT        NOT NULL,
  document_type        TEXT        NOT NULL DEFAULT 'custom',
  title                TEXT        NOT NULL,
  file_name            TEXT        NOT NULL,
  file_path            TEXT        NOT NULL,
  file_size_bytes      INT,
  mime_type            TEXT,
  uploaded_by_user_id  UUID,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed_content       TEXT,
  parse_status         TEXT        NOT NULL DEFAULT 'pending',
  parse_error          TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  version              INT         NOT NULL DEFAULT 1,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT knowledge_documents_dept_check CHECK (
    department_key IN ('front_office','housekeeping','technical','fb','guest_relation','spa','animation','general')
  ),
  CONSTRAINT knowledge_documents_type_check CHECK (
    document_type IN ('fact_sheet','concept','price_list','menu','reservation','allergen','schedule','custom')
  ),
  CONSTRAINT knowledge_documents_parse_status_check CHECK (
    parse_status IN ('pending','processing','completed','failed')
  )
);

-- ---------------------------------------------------------------------------
-- 2. İndeksler
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS knowledge_documents_dept_idx
  ON knowledge_documents(department_key);

CREATE INDEX IF NOT EXISTS knowledge_documents_active_idx
  ON knowledge_documents(is_active);

CREATE INDEX IF NOT EXISTS knowledge_documents_uploaded_at_idx
  ON knowledge_documents(uploaded_at DESC);

-- ---------------------------------------------------------------------------
-- 3. knowledge_sections'a source_document_id kolonu ekle
-- ---------------------------------------------------------------------------
ALTER TABLE knowledge_sections
  ADD COLUMN IF NOT EXISTS source_document_id UUID;

-- ---------------------------------------------------------------------------
-- 4. updated_at auto-trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS knowledge_documents_set_updated_at ON knowledge_documents;

CREATE TRIGGER knowledge_documents_set_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION knowledge_set_updated_at();

-- ---------------------------------------------------------------------------
-- DOĞRULAMA — Bu sorgular 17 + 1 satır dönmeli
-- ---------------------------------------------------------------------------
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'knowledge_documents' ORDER BY ordinal_position;
-- Beklenen: 17 satır
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'knowledge_sections' AND column_name = 'source_document_id';
-- Beklenen: 1 satır
