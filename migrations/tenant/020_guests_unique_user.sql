-- 020: guests.telegram_user_id UNIQUE index
-- Amac: ayni telegram kullanicisi icin birden fazla guest satiri olusmasini engellemek.
-- ON KOSUL: ilgili tenant'ta duplicate temizlenmis olmali.
-- Partial index: telegram_user_id NULL olan satirlar haric.

CREATE UNIQUE INDEX IF NOT EXISTS uq_guests_telegram_user_id
  ON guests(telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
