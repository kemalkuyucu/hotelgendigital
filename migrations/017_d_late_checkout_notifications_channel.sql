-- Migration: 017_d_late_checkout_notifications_channel
-- Module 17.d - Add channel column to late_checkout_notifications
-- Channels: telegram | whatsapp | manual
-- Created: 2026-05-19

ALTER TABLE late_checkout_notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'telegram'
    CHECK (channel IN ('telegram', 'whatsapp', 'manual'));

ALTER TABLE late_checkout_notifications
  ADD COLUMN IF NOT EXISTS error_message text;
