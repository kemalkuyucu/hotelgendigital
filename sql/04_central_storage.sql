-- ============================================================================
-- HOTELGEN — CENTRAL SUPABASE: STORAGE BUCKETS
-- ============================================================================
-- Run this AFTER 03_central_seed.sql
--
-- Buckets in CENTRAL store:
--   - hotel-logos: each hotel's logo (shown in bot replies, panel header)
--   - master-assets: HotelGen branding, demo materials
--
-- Hotel-specific operational files (fact sheets, menus, room photos)
-- live in EACH HOTEL's own Supabase, not here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BUCKET: hotel-logos
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-logos',
  'hotel-logos',
  true,                                              -- public read for fast bot responses
  2097152,                                           -- 2 MB max
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- BUCKET: master-assets
-- Internal assets only — not public
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'master-assets',
  'master-assets',
  false,
  10485760,                                          -- 10 MB max
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- STORAGE POLICIES
-- ----------------------------------------------------------------------------

-- hotel-logos: public read (so bots can include logo URLs in messages)
create policy "hotel_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'hotel-logos');

-- hotel-logos: only service role can write
create policy "hotel_logos_service_write"
  on storage.objects for insert
  with check (bucket_id = 'hotel-logos' and auth.role() = 'service_role');

create policy "hotel_logos_service_update"
  on storage.objects for update
  using (bucket_id = 'hotel-logos' and auth.role() = 'service_role');

create policy "hotel_logos_service_delete"
  on storage.objects for delete
  using (bucket_id = 'hotel-logos' and auth.role() = 'service_role');


-- master-assets: only service role
create policy "master_assets_service_only"
  on storage.objects for all
  using (bucket_id = 'master-assets' and auth.role() = 'service_role');


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- Central Supabase setup complete!
-- Now move to Hotel Supabase template (will be applied when first hotel is created).
