-- 017_meeting_equipment
-- Otel geneli toplantı teknik ekipman listesi
-- Idempotent: ADD COLUMN IF NOT EXISTS + DEFAULT '[]'

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS meeting_equipment JSONB NOT NULL DEFAULT '[]'::jsonb;
