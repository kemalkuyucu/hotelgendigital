-- =============================================================================
-- 011_guest_allergens.sql
-- Alerjen Modülü (Modül 1 — Veri Katmanı)
-- Misafire alerjen sorusu sorulur, yanıt bu tabloda tutulur.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- exec_sql RPC ile çalıştırılır (BEGIN/COMMIT yok, runMigrations wrapper koyar)
-- Hard delete yok — is_active false yapılır, konaklama bitince.
-- =============================================================================

CREATE TABLE IF NOT EXISTS guest_allergens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id          UUID,                                        -- guests tablosuna referans (varsa)
  platform          TEXT        NOT NULL,                        -- 'telegram' / 'whatsapp' / 'instagram'
  platform_user_id  TEXT        NOT NULL,                        -- misafirin platform ID'si
  guest_full_name   TEXT,
  room_number       TEXT,                                        -- nullable, oda alınca dolar
  allergen_text     TEXT,                                        -- "fıstık, deniz ürünleri" vb.
  status            TEXT        NOT NULL DEFAULT 'not_asked',    -- 'not_asked' | 'asked_no_response' | 'none' | 'reported'
  check_in          DATE,
  check_out         DATE,
  asked_at          TIMESTAMPTZ,
  reported_at       TIMESTAMPTZ,
  is_active         BOOLEAN     NOT NULL DEFAULT true,           -- konaklama bitince false (hard delete yok)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_allergens_lookup
  ON guest_allergens(platform, platform_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_guest_allergens_room
  ON guest_allergens(room_number, is_active);
