-- Migration: 017_c_conversations_inhouse_match
-- Module 17.c - Add inhouse_match_guest_id to conversations for bot guest linking
-- Created: 2026-05-19
-- NOTE: This links a Telegram/WhatsApp conversation to inhouse_guests_v2
--       (separate from the existing verified_inhouse_guest_id which uses inhouse_guests)

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS inhouse_match_guest_id uuid REFERENCES inhouse_guests_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_inhouse_match ON conversations (inhouse_match_guest_id);
