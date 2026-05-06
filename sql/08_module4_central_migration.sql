-- ============================================================================
-- HOTELGEN — MODULE 4: CENTRAL SUPABASE MIGRATION
-- ============================================================================
-- Çalıştır: Central Supabase Dashboard > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) hotels tablosuna Telegram yönetici chat_id kolonu ekle
-- ----------------------------------------------------------------------------
alter table hotels
  add column if not exists telegram_manager_chat_id bigint;

comment on column hotels.telegram_manager_chat_id
  is 'Telegram chat_id for the manager who receives escalation notifications';

-- ----------------------------------------------------------------------------
-- 2) demo-hotel kaydını ekle (eğer yoksa)
-- NOT: 03_central_seed.sql'de slug=''demo-resort-spa'' olarak eklenmiş.
--      Webhook endpoint'i slug=''demo-hotel'' bekliyor → doğru kaydı ekle.
-- ----------------------------------------------------------------------------
insert into hotels (
  name,
  slug,
  package_id,
  contract_months,
  contact_name,
  status,
  is_demo
)
select
  'Demo Hotel',
  'demo-hotel',
  (select id from packages where code = 'full'),
  12,
  'Demo Owner',
  'active',
  true
where not exists (select 1 from hotels where slug = 'demo-hotel');

-- Doğrulama
select id, name, slug, status, is_demo, telegram_manager_chat_id
from hotels
where slug = 'demo-hotel';
