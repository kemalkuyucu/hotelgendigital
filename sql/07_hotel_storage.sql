-- ============================================================================
-- HOTELGEN — HOTEL SUPABASE: STORAGE BUCKETS
-- ============================================================================
-- Run AFTER 06_hotel_rls.sql in EACH hotel's Supabase project.
--
-- Buckets:
--   hotel-documents : PDFs, Word docs, Excel files (fact sheet, menus, etc)
--   hotel-images    : Photos (rooms, restaurants, SPA, animation, hotel map)
--   guest-uploads   : Images/videos guests send (technical service photos)
--   voice-messages  : Voice notes from guests (Whisper transcription source)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BUCKET: hotel-documents
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-documents',
  'hotel-documents',
  false,
  20971520,                                          -- 20 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- BUCKET: hotel-images
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-images',
  'hotel-images',
  true,                                              -- public so bot can include URLs
  10485760,                                          -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- BUCKET: guest-uploads
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guest-uploads',
  'guest-uploads',
  false,
  52428800,                                          -- 50 MB (videos can be larger)
  array[
    'image/png', 'image/jpeg', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- BUCKET: voice-messages
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-messages',
  'voice-messages',
  false,
  10485760,                                          -- 10 MB
  array['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm']
)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- STORAGE POLICIES
-- ----------------------------------------------------------------------------

-- hotel-images: public read, service role write
create policy "hotel_images_public_read"
  on storage.objects for select
  using (bucket_id = 'hotel-images');

create policy "hotel_images_service_write"
  on storage.objects for insert
  with check (bucket_id = 'hotel-images' and auth.role() = 'service_role');

create policy "hotel_images_service_update"
  on storage.objects for update
  using (bucket_id = 'hotel-images' and auth.role() = 'service_role');

create policy "hotel_images_service_delete"
  on storage.objects for delete
  using (bucket_id = 'hotel-images' and auth.role() = 'service_role');


-- hotel-documents: service role only
create policy "hotel_documents_service_only"
  on storage.objects for all
  using (bucket_id = 'hotel-documents' and auth.role() = 'service_role');


-- guest-uploads: service role only
create policy "guest_uploads_service_only"
  on storage.objects for all
  using (bucket_id = 'guest-uploads' and auth.role() = 'service_role');


-- voice-messages: service role only
create policy "voice_messages_service_only"
  on storage.objects for all
  using (bucket_id = 'voice-messages' and auth.role() = 'service_role');


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- Hotel Supabase setup complete!
