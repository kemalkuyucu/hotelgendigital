-- =============================================================================
-- 025_note_pending.sql
-- Iki asamali not akisi: misafir "2 RS01" yazinca once "not var mi?" sorulur,
-- sonra onay karti gelir. Not asamasi boyunca siparisin JSON'u bekletilmeli.
--
-- Yeni sutunlar:
--   note_pending        : Misafirden "siparise not eklemek ister misiniz" cevabi
--                         bekleniyor mu? (BOOLEAN bayrak, order_pending ikizi)
--   note_pending_order  : Not asamasi boyunca bekletilen siparis JSON'u
--                         ({raw, lines, total, currency}). Not cevabi gelince
--                         bu JSON'a not eklenip order_pending akisina devredilir.
--
-- Desen: 022_order_pending.sql ile ayni (BOOLEAN bayrak + TEXT eslikci).
-- Idempotent: IF NOT EXISTS. Mevcut hicbir kolona dokunmaz.
-- Numara: 025
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS note_pending       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS note_pending_order TEXT;
