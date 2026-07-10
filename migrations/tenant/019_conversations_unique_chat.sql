-- 019: conversations.telegram_chat_id UNIQUE index
-- Amac: ayni chat_id icin birden fazla conversation satiri olusmasini DB seviyesinde engellemek.
-- ON KOSUL: Bu index olusturulmadan once ilgili tenant'ta duplicate satirlar TEMIZLENMIS olmali,
-- aksi halde CREATE UNIQUE INDEX hata verir.
-- Partial index: telegram_chat_id NULL olan satirlar (WhatsApp/Instagram) haric tutulur.

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_telegram_chat_id
  ON conversations(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;
