-- ============================================================================
-- HOTELGEN — CENTRAL SUPABASE: SEED ADMINS & VIP MANAGERS
-- ============================================================================
-- Run this AFTER 02_central_rls.sql
--
-- IMPORTANT — DO NOT COMMIT THIS FILE WITH REAL PASSWORDS.
-- This is a TEMPLATE. Real password hashes will be inserted via Vercel
-- API endpoint after deployment, not via raw SQL.
--
-- For Module 1, we only seed PLACEHOLDER admins. Real password setup
-- happens in Module 2 when the auth API is implemented.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLACEHOLDER MASTER ADMINS
-- These rows will be UPDATED via API in Module 2 with real bcrypt hashes.
-- For now, password_hash is set to a non-functional value to prevent login.
-- ----------------------------------------------------------------------------

insert into master_admins (username, password_hash, full_name, email, role, is_active)
values
  ('OzgurOzen',     'PLACEHOLDER_REPLACE_VIA_API', 'Özgür ÖZEN',    null, 'super_admin', true),
  ('KemalKuyucu',   'PLACEHOLDER_REPLACE_VIA_API', 'Kemal KUYUCU',  null, 'super_admin', true),
  -- AdminYonetici: is_active=FALSE — manuel DB erişimi olmadan giriş YAPILAMAZ
  -- Role 'admin' olarak düzeltildi; 'default_admin' rolüyle /admin erişimi engellenir
  ('AdminYonetici', 'PLACEHOLDER_REPLACE_VIA_API', 'Default Admin', null, 'admin',       false)
on conflict (username) do nothing;


-- ----------------------------------------------------------------------------
-- DEMO HOTEL (for testing & sales presentations)
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
  'Demo Resort & SPA',
  'demo-resort-spa',
  (select id from packages where code = 'full'),
  12,
  'Demo Owner',
  'demo',
  true
where not exists (select 1 from hotels where slug = 'demo-resort-spa');


-- ----------------------------------------------------------------------------
-- VERIFICATION QUERIES (run these to confirm seed worked)
-- ----------------------------------------------------------------------------
-- select count(*) as admin_count from master_admins;          -- should be 3
-- select count(*) as package_count from packages;              -- should be 3
-- select count(*) as demo_hotel_count from hotels where is_demo; -- should be 1


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- Next: Run 04_central_storage.sql to set up storage buckets.
