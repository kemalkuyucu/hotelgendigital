-- =============================================================
-- Modul 11 - SLA Escalation Setup
--   1. departments.sla_minutes kolonu (varsayilan 1 dk demo / panelden config)
--   2. departments.reception_sla_minutes kolonu (varsayilan 5)
--   3. sla_events tablosu (her forward icin lifecycle)
-- =============================================================

BEGIN;

-- 1) departments.sla_minutes
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS sla_minutes INTEGER NOT NULL DEFAULT 1;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS reception_sla_minutes INTEGER NOT NULL DEFAULT 5;

COMMENT ON COLUMN departments.sla_minutes IS
  'Departmanin talep cevap verme suresi (dakika). Asilirsa resepsiyona escalation.';
COMMENT ON COLUMN departments.reception_sla_minutes IS
  'Resepsiyonun form doldurma suresi (dakika). Asilirsa "cevap verilmedi" auto-kayit.';

-- 2) sla_events tablosu
CREATE TABLE IF NOT EXISTS sla_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  inhouse_guest_id UUID REFERENCES inhouse_guests(id) ON DELETE SET NULL,

  -- Talep bilgisi
  department_code TEXT NOT NULL,
  department_chat_id TEXT NOT NULL,
  department_message_id BIGINT,        -- Telegram message_id (callback edit icin)
  request_text TEXT NOT NULL,
  room_number TEXT,
  guest_full_name TEXT,

  -- Lifecycle
  forwarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_deadline TIMESTAMPTZ NOT NULL,    -- forwarded_at + sla_minutes
  responded_at TIMESTAMPTZ,
  response_type TEXT,                   -- 'immediate' | 'delayed' | null
  responder_telegram_id TEXT,
  responder_username TEXT,

  -- Escalation
  escalated_at TIMESTAMPTZ,
  escalation_message_id BIGINT,         -- Resepsiyon grubuna giden mesaj
  reception_sla_deadline TIMESTAMPTZ,
  reception_responded_at TIMESTAMPTZ,
  reception_response_text TEXT,         -- Resepsiyonun reply ile yazdigi aciklama
  reception_responder_telegram_id TEXT,

  -- Final state (rapor icin)
  final_status TEXT,                    -- 'completed_immediate' | 'completed_delayed'
                                        -- | 'escalated_resolved' | 'no_response'
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_events_deadline
  ON sla_events(sla_deadline) WHERE responded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_events_reception_deadline
  ON sla_events(reception_sla_deadline) WHERE escalated_at IS NOT NULL AND reception_responded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_events_conversation ON sla_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sla_events_department ON sla_events(department_code);
CREATE INDEX IF NOT EXISTS idx_sla_events_forwarded_at ON sla_events(forwarded_at DESC);

COMMENT ON TABLE sla_events IS
  'Her departman forward''i icin SLA lifecycle takibi. Modul 11.1 manager raporlamasi bu tablodan okuyacak.';

-- 3) Demo seed: 7 departman icin SLA degerlerini set et
UPDATE departments SET sla_minutes = 1, reception_sla_minutes = 5
WHERE code IN ('technical', 'housekeeping', 'fb', 'spa', 'animation', 'guest_relation', 'front_office');

COMMIT;
