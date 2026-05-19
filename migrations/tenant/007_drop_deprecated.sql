-- =============================================================================
-- 007_drop_deprecated.sql
-- DEPRECATED tabloların kaldırılması
--
-- !!! DİKKAT: Bu dosya runner tarafından VARSAYILAN olarak ÇALIŞTIRILMAZ.
-- !!! Yalnızca --include-destructive flag'i ile çalışır.
-- !!! Her DROP'tan önce manuel review yapın.
-- !!! Üretim ortamında çalıştırmadan önce yedeği doğrulayın.
-- =============================================================================

BEGIN;

-- messages tablosu: 0 kayıt, 0 kod referansı, bot_messages ile mükerrer.
-- Kaldırmadan önce: SELECT COUNT(*) FROM messages; sonucu 0 olduğunu teyit edin.
DROP TABLE IF EXISTS messages CASCADE;

COMMIT;
