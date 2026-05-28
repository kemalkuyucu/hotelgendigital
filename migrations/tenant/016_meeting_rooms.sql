ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS meeting_rooms JSONB NOT NULL DEFAULT '[]'::jsonb;
