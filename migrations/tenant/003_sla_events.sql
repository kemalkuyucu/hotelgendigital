-- =============================================================================
-- 003_sla_events.sql
-- SLA olay takip tablosu — Modül 16.a kapsamında
-- (Modül 16.b safety routing Central DB'de kalır; tenant'ta sadece bu tablo)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_events (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id                 UUID NOT NULL REFERENCES conversations(id),
  inhouse_guest_id                UUID,
  department_code                 TEXT NOT NULL,
  department_chat_id              TEXT NOT NULL,
  department_message_id           BIGINT,
  request_text                    TEXT NOT NULL,
  room_number                     TEXT,
  guest_full_name                 TEXT,
  forwarded_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_deadline                    TIMESTAMPTZ NOT NULL,
  responded_at                    TIMESTAMPTZ,
  response_type                   TEXT,
  responder_telegram_id           TEXT,
  responder_username              TEXT,
  escalated_at                    TIMESTAMPTZ,
  escalation_message_id           BIGINT,
  reception_sla_deadline          TIMESTAMPTZ,
  reception_responded_at          TIMESTAMPTZ,
  reception_response_text         TEXT,
  reception_responder_telegram_id TEXT,
  final_status                    TEXT,
  closed_at                       TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_events_conversation_id
  ON sla_events(conversation_id);

CREATE INDEX IF NOT EXISTS idx_sla_events_final_status
  ON sla_events(final_status);

CREATE INDEX IF NOT EXISTS idx_sla_events_sla_deadline
  ON sla_events(sla_deadline)
  WHERE final_status IS NULL;

