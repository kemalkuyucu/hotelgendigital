-- =============================================================================
-- 008_module17_7_multi_match_flag.sql
-- Modül 17.7-B — Çoklu eşleşme çözülemedi bildirimi
-- ALTER: conversations — multi_match_* kolonları
-- =============================================================================

-- Çoklu eşleşme durumunda misafirin girdiği oda numarasını saklar
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS multi_match_pending_room TEXT;

-- Misafirin çoklu eşleşme durumunda kaç isim denemesi yaptığını sayar
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS multi_match_attempts INTEGER DEFAULT 0;

-- Aynı conversation'a tekrar bildirim gitmemesi için flag
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS multi_match_notified BOOLEAN DEFAULT FALSE;

-- PostgREST schema cache'ini yenile
NOTIFY pgrst, 'reload schema';

