-- =============================================================================
-- 006_module17_notifications.sql
-- Modül 17.b/c/d — Bildirim sistemi ve konuşma eşleştirme
-- Tablolar: late_checkout_notifications, pending_guest_matches
-- ALTER: conversations (inhouse_match_guest_id, verification_* kolonları)
-- ALTER: inhouse_guests_v2 (telegram_id, whatsapp_id zaten 005'te var)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- late_checkout_notifications (Modül 17.b)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS late_checkout_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inhouse_guest_id  UUID NOT NULL REFERENCES inhouse_guests_v2(id),
  notification_date DATE NOT NULL,
  channel           TEXT NOT NULL,
  message_content   TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  sent_by_user_id   UUID,
  sent_by_username  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_late_checkout_notifications_guest_id
  ON late_checkout_notifications(inhouse_guest_id);

CREATE INDEX IF NOT EXISTS idx_late_checkout_notifications_date
  ON late_checkout_notifications(notification_date);

-- ---------------------------------------------------------------------------
-- pending_guest_matches (Modül 17.c)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_guest_matches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id            BIGINT,
  whatsapp_id            TEXT,
  platform               TEXT NOT NULL,
  attempted_room_number  TEXT,
  message_excerpt        TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved               BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at            TIMESTAMPTZ,
  resolved_by_user_id    TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_guest_matches_resolved
  ON pending_guest_matches(resolved)
  WHERE resolved = FALSE;

-- ---------------------------------------------------------------------------
-- conversations — Modül 17.c/d ek kolonları
-- ---------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS inhouse_match_guest_id UUID
    REFERENCES inhouse_guests_v2(id);

-- verification_* kolonları (001'de zaten var, IF NOT EXISTS güvenli)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS verification_pending_intent TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS verification_last_attempt_at TIMESTAMPTZ;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pending_request_text TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pending_intents_json JSONB;

-- last_message_at (Modül 17.d — bot'un son mesaj zamanı için)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

