-- =============================================================================
-- 022_order_pending.sql
-- F&B Siparis Teyit + Kademeli Menu Onerisi State
--
-- PROBLEM: Kod conversations.order_pending / order_pending_text kolonlarina
--   yazip okuyordu ama bu kolonlar hicbir migration'da tanimli degildi.
--   Yazma (route.ts F&B siparis teyit kapisi) hatayi yutup sessizce no-op
--   oluyordu; misafir "Evet, onayliyorum" butonuna basinca callback'teki
--   SELECT var-olmayan kolon yuzunden 400 donuyor, data=null kaliyor ve
--   handle-order-callback.ts "Kayit bulunamadi." hatasi veriyordu.
--   Ayni sorun menu_offer_pending / menu_offer_text (menude-yok akisi) icin de
--   gecerliydi -> kademeli menu onerisi butonlari da calismiyordu.
--
-- COZUM: Dort kolonu conversations'a ekle. Mevcut hicbir kolona dokunmaz.
--
-- Yeni sutunlar:
--   order_pending       : Misafirden F&B siparis onayi bekleniyor mu?
--   order_pending_text  : Onay gelince forward edilecek orijinal siparis cumlesi
--   menu_offer_pending  : Misafirden "menuye bakmak ister misiniz" onayi bekleniyor mu?
--   menu_offer_text     : Misafir EVET derse gonderilecek hazir menu cevabi
--
-- Idempotent: IF NOT EXISTS
-- Numara: 022
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS order_pending      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_pending_text TEXT,
  ADD COLUMN IF NOT EXISTS menu_offer_pending BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_offer_text    TEXT;
