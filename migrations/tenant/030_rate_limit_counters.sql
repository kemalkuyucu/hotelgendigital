-- =============================================================================
-- 030_rate_limit_counters.sql
-- KALICI RATE LIMIT deposu — denial-of-wallet savunmasi.
--
-- KOK SORUN: bugunku tek koruma route.ts'teki MODUL-SEVIYESI Map'ti
-- (`_rateLimitMap`, 10 mesaj / 60 sn). Iki nedenle para riskini KAPATMAZ:
--   1) Vercel'de her invocation AYRI instance olabilir -> sayac her cold start'ta
--      SIFIRLANIR ve instance'lar birbirinin sayacini GORMEZ. Yeterli paralellikle
--      sinir pratikte yok sayilir.
--   2) Yalniz chat basinadir; bir saldirgan N sahte hesapla otelin AI butcesini
--      (Anthropic + OpenAI Whisper) tuketebilir — otel capinda TAVAN YOKTU.
--
-- Bu tablo sayaci TENANT DB'ye tasir: tum instance'lar ayni satiri gorur.
-- Desen `029_processed_telegram_updates` ile AYNI: karar PRIMARY KEY catismasindan
-- gelir, okuma-sonra-yazma YOK -> es zamanlilikta da dogru.
--
-- Kolonlar:
--   scope        : 'chat' (tek misafir) | 'hotel' (otel capinda tavan)
--   subject      : scope='chat' -> telegram user id · scope='hotel' -> '*'
--   window_start : SABIT pencere baslangici (kayan degil) — anahtarin parcasi
--                  oldugu icin pencere degisince YENI satir acilir, eski satir
--                  TTL ile supurulur.
--   hits         : o penceredeki istek sayisi.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION
-- Numara: 030
-- =============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  hotel_slug   TEXT        NOT NULL,
  scope        TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_slug, scope, subject, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rlc_window_start ON rate_limit_counters (window_start);

-- ---------------------------------------------------------------------------
-- rate_limit_hit: chat ve otel sayaclarini TEK turda, ATOMIK olarak artirir.
--
-- ATOMIKLIK: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` tek deyimde
-- kilitler ve artirir; iki es zamanli cagri birbirinin uzerine YAZAMAZ. Bunu
-- uygulama katmaninda SELECT+UPDATE ile yapmak, order-callback'te yasanan
-- okuma-sonra-yazma yarisinin aynisini uretirdi.
--
-- TEK RPC: iki sayac tek fonksiyonda artirilir — her mesaj basina iki ayri
-- round-trip odememek icin.
--
-- Dollar-quote etiketi BILINCLI olarak `$rate_limit_hit$`: bu dosya migration
-- runner'i tarafindan exec_sql(sql text) icine PARAMETRE olarak gecirilir ve
-- exec_sql'in kendi govdesi `$$` kullanir; ayri etiket ic ice tirnak riskini
-- tamamen ortadan kaldirir.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_hotel_slug     TEXT,
  p_subject        TEXT,
  p_window_seconds INTEGER
)
RETURNS TABLE (chat_hits INTEGER, hotel_hits INTEGER)
LANGUAGE plpgsql
AS $rate_limit_hit$
DECLARE
  v_window TIMESTAMPTZ;
  v_chat   INTEGER;
  v_hotel  INTEGER;
BEGIN
  -- Sabit pencere: epoch'u pencere boyuna bolup tabana yuvarla.
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO rate_limit_counters AS r (hotel_slug, scope, subject, window_start, hits)
  VALUES (p_hotel_slug, 'chat', p_subject, v_window, 1)
  ON CONFLICT (hotel_slug, scope, subject, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_chat;

  INSERT INTO rate_limit_counters AS r (hotel_slug, scope, subject, window_start, hits)
  VALUES (p_hotel_slug, 'hotel', '*', v_window, 1)
  ON CONFLICT (hotel_slug, scope, subject, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hotel;

  RETURN QUERY SELECT v_chat, v_hotel;
END;
$rate_limit_hit$;
