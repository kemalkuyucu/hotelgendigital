-- =============================================================================
-- 018_detail_pending.sql
-- Oda-Detay Follow-up State — Cok Turlu Tarih Akisi
--
-- PROBLEM: Misafir "villa ozellikleri nedir" deyince bot tarih soruyor, ama
--   misafir tarihi AYRI mesajda ("1-4 agustos") verince onceki oda baglami
--   kayboluyordu. Ikinci turda detay kapisi acilmiyor, mesaj bos AI cevabina
--   dusuyordu.
--
-- COZUM: Alerjen state deseninin (allergen_pending) ikizi. Detay kapisi tarih
--   sorunca detail_pending=true yazar + orijinal oda sorusunu detail_pending_text'e
--   saklar. Sonraki turda bu bayrak okunup tarih ile birlestirilir, sonra temizlenir.
--
-- Yeni sutunlar:
--   detail_pending      : Misafir detay akisinda tarih cevabi bekleniyor mu?
--   detail_pending_text : Orijinal oda sorusu ("villa ozellikleri nedir")
--
-- Idempotent: IF NOT EXISTS
-- Numara: 018
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS detail_pending      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS detail_pending_text TEXT;

-- Index: detail_pending=true olan konusmalari hizli bulmak icin
CREATE INDEX IF NOT EXISTS idx_conversations_detail_pending
  ON conversations(detail_pending)
  WHERE detail_pending = true;
