-- =============================================================================
-- 010_reservation_links.sql
-- Rezervasyon Linkleri Modülü (Faz 1)
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- exec_sql RPC ile çalıştırılır (BEGIN/COMMIT yok, runMigrations wrapper koyar)
-- =============================================================================

CREATE TABLE IF NOT EXISTS reservation_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT        NOT NULL,                        -- "Otel Resmi Sitesi", "ETS Tur"
  url         TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 99,             -- 1 = en üst, küçükten büyüğe sıralanır
  is_official BOOLEAN     NOT NULL DEFAULT false,          -- otelin kendi resmi linki mi
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_reservation_links_order
  ON reservation_links(sort_order);
