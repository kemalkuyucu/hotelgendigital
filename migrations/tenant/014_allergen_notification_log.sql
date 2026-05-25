-- =============================================================================
-- 014_allergen_notification_log.sql
-- Alerjen Modülü 4 — Bildirim Log Tablosu
-- Her bildirim girişimini kaydeder (başarılı, başarısız, telegram_id boş).
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- exec_sql RPC ile çalıştırılır (BEGIN/COMMIT yok, runMigrations wrapper koyar)
-- Hard delete yok — is_active false yapılır.
-- =============================================================================

CREATE TABLE IF NOT EXISTS allergen_notification_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_allergen_id   UUID,                                        -- guest_allergens.id referansı
  recipient_type      TEXT        NOT NULL,                        -- 'fb_primary' | 'fb_backup' | 'gr' | 'front_office'
  staff_id            UUID,                                        -- department_staff.id (varsa)
  staff_full_name     TEXT,                                        -- İnsan okunabilir log için
  telegram_user_id    TEXT,                                        -- Gönderilen telegram ID (ya da boş)
  status              TEXT        NOT NULL DEFAULT 'pending',      -- 'sent' | 'failed' | 'skipped_no_telegram_id'
  error_message       TEXT,                                        -- Hata varsa
  scenario            TEXT,                                        -- 'A' | 'B' | 'C'
  notification_text   TEXT,                                        -- Gönderilen mesaj metni
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allergen_notif_log_allergen_id
  ON allergen_notification_log(guest_allergen_id);

CREATE INDEX IF NOT EXISTS idx_allergen_notif_log_status
  ON allergen_notification_log(status);
