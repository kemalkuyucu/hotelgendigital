-- =============================================================================
-- 005_module17_inhouse.sql
-- Modül 17.a — In-house misafir yönetimi
-- Tablolar: inhouse_guests_v2, excel_column_mapping, inhouse_upload_history,
--           inhouse_archive (ek kolonlar), inhouse_guests (v1 ek kolonlar)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- inhouse_guests_v2 (Modül 17.a ana tablo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inhouse_guests_v2 (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number     TEXT NOT NULL,
  agency          TEXT,
  guest_name      TEXT NOT NULL,
  guest_count     INTEGER,
  check_in_date   DATE NOT NULL,
  check_out_date  DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  upload_batch_id UUID,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  telegram_id     TEXT,
  whatsapp_id     TEXT
);

CREATE INDEX IF NOT EXISTS idx_inhouse_guests_v2_check_out_date
  ON inhouse_guests_v2(check_out_date);

CREATE INDEX IF NOT EXISTS idx_inhouse_guests_v2_status
  ON inhouse_guests_v2(status);

CREATE INDEX IF NOT EXISTS idx_inhouse_guests_v2_upload_batch_id
  ON inhouse_guests_v2(upload_batch_id);

-- ---------------------------------------------------------------------------
-- excel_column_mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS excel_column_mapping (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_slug       TEXT NOT NULL,
  room_number_col  TEXT,
  agency_col       TEXT,
  guest_name_col   TEXT,
  guest_count_col  TEXT,
  check_in_col     TEXT,
  check_out_col    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_excel_column_mapping_hotel_slug
  ON excel_column_mapping(hotel_slug);

-- ---------------------------------------------------------------------------
-- inhouse_upload_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inhouse_upload_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL,
  hotel_slug      TEXT NOT NULL,
  uploaded_by     TEXT,
  file_name       TEXT,
  inserted_count  INTEGER DEFAULT 0,
  updated_count   INTEGER DEFAULT 0,
  archived_count  INTEGER DEFAULT 0,
  total_rows      INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'completed',
  error_detail    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inhouse_upload_history_hotel_slug
  ON inhouse_upload_history(hotel_slug);

CREATE INDEX IF NOT EXISTS idx_inhouse_upload_history_created_at
  ON inhouse_upload_history(created_at DESC);

-- ---------------------------------------------------------------------------
-- inhouse_guests v1 — Modül 17 ile eklenen ek kolonlar
-- ---------------------------------------------------------------------------
ALTER TABLE inhouse_guests
  ADD COLUMN IF NOT EXISTS gender TEXT;

