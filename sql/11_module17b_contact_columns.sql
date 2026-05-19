-- ============================================================================
-- MODUL 17b — inhouse_guests_v2 iletisim alanlari ekleme
-- Hotel Supabase'inde calistir (Demo Hotel SQL Editor)
-- Bu migration idempotent'tir (birkez calistirmak yeterli)
-- ============================================================================

-- telegram_id: misafirin Telegram kullanici ID'si (string olarak saklanir)
alter table inhouse_guests_v2
  add column if not exists telegram_id text default null;

-- whatsapp_id: misafirin WhatsApp numarasi (orn: "905321234567")
alter table inhouse_guests_v2
  add column if not exists whatsapp_id text default null;

comment on column inhouse_guests_v2.telegram_id
  is 'Module 17b: Misafirin Telegram kullanici ID''si. Bildirim icin kullanilir.';
comment on column inhouse_guests_v2.whatsapp_id
  is 'Module 17b: Misafirin WhatsApp numarasi (e.164 format). Bildirim icin kullanilir.';

-- ============================================================================
-- DONE — Hotel Supabase SQL Editor'de calistir.
-- ============================================================================
