-- Migration: 017_c_pending_guest_matches
-- Module 17.c - Unmatched guest bot session tracking
-- Created: 2026-05-19

CREATE TABLE IF NOT EXISTS pending_guest_matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id      bigint,
  whatsapp_id      text,
  platform         text NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  attempted_room_number text,
  message_excerpt  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved         boolean NOT NULL DEFAULT false,
  resolved_at      timestamptz,
  resolved_by_user_id text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pgm_resolved ON pending_guest_matches (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pgm_telegram_id ON pending_guest_matches (telegram_id);
CREATE INDEX IF NOT EXISTS idx_pgm_whatsapp_id ON pending_guest_matches (whatsapp_id);
