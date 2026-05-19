-- =============================================================================
-- 002_perplexity.sql
-- Modül 14.b — Perplexity AI keşif tablosu
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS perplexity_discoveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_tag  TEXT NOT NULL,
  query_text    TEXT NOT NULL,
  results       JSONB,
  raw_response  TEXT,
  sources       JSONB,
  model_used    TEXT,
  tokens_used   INTEGER,
  is_pinned     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_perplexity_discoveries_interest_tag
  ON perplexity_discoveries(interest_tag);

CREATE INDEX IF NOT EXISTS idx_perplexity_discoveries_expires_at
  ON perplexity_discoveries(expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;
