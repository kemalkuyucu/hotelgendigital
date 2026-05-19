-- ============================================================================
-- MODUL 17b — late_checkout_notifications log tablosu
-- Hotel Supabase'inde calistir (Demo Hotel SQL Editor)
-- Bu migration idempotent'tir
-- ============================================================================

CREATE TABLE IF NOT EXISTS late_checkout_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inhouse_guest_id UUID NOT NULL REFERENCES inhouse_guests_v2(id)
    ON DELETE CASCADE,

  -- Bildirim detaylari
  notification_date DATE NOT NULL,  -- hangi gun icin gonderildi
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'manual')),
  message_content TEXT,

  -- Sonuc
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,

  -- Kim gonderdi
  sent_by_user_id UUID,
  sent_by_username TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_late_notif_guest
  ON late_checkout_notifications(inhouse_guest_id);

CREATE INDEX IF NOT EXISTS idx_late_notif_date
  ON late_checkout_notifications(notification_date);

CREATE INDEX IF NOT EXISTS idx_late_notif_status
  ON late_checkout_notifications(status);

-- ============================================================================
-- DONE — Demo Hotel Supabase SQL Editor'de calistir.
-- NOT: Modul 17.d bu tabloyu INSERT icin kullanacak.
--      17.b sadece SELECT yaparak UI'da gosteriyor.
-- ============================================================================
