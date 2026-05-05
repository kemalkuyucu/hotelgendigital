-- ============================================================================
-- HOTELGEN — HOTEL SUPABASE TEMPLATE SCHEMA
-- ============================================================================
-- This schema is applied to EACH hotel's own isolated Supabase project.
-- Hotel operational data lives here — never in Central Supabase.
--
-- For Module 1, run this in: Demo Hotel's Supabase > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";    -- pgvector for RAG search


-- ============================================================================
-- SECTION 1: GUEST DATA & MEMORY (3-Layer System)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: inhouse_guests
-- Active guests currently staying at the hotel (uploaded daily by Front Office)
-- ----------------------------------------------------------------------------
create table if not exists inhouse_guests (
  id uuid primary key default gen_random_uuid(),
  room_number text not null,
  full_name text not null,
  agency text,
  voucher text,
  pax int default 1,
  check_in_date date not null,
  check_out_date date not null,
  channel_ids jsonb default '[]'::jsonb,
  language text,
  vip_status text check (vip_status in ('standard', 'repeat', 'loyalty', 'vip')) default 'standard',
  uploaded_at timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now()
);

comment on table inhouse_guests is 'Currently staying guests. Updated by Front Office Excel upload.';
comment on column inhouse_guests.channel_ids is 'Array of channel IDs (WhatsApp/Telegram/IG) linked to this guest';

create index if not exists idx_inhouse_room on inhouse_guests(room_number) where is_active = true;
create index if not exists idx_inhouse_name on inhouse_guests(full_name) where is_active = true;
create index if not exists idx_inhouse_checkout on inhouse_guests(check_out_date) where is_active = true;
create index if not exists idx_inhouse_active on inhouse_guests(is_active);


-- ----------------------------------------------------------------------------
-- TABLE: inhouse_archive
-- Guests who have checked out (1 year retention)
-- ----------------------------------------------------------------------------
create table if not exists inhouse_archive (
  id uuid primary key default gen_random_uuid(),
  original_guest_id uuid,
  room_number text,
  full_name text not null,
  agency text,
  pax int,
  check_in_date date,
  check_out_date date,
  language text,
  vip_status text,
  archived_at timestamptz default now(),
  archive_reason text default 'checkout'
);

create index if not exists idx_inhouse_archive_name on inhouse_archive(full_name);
create index if not exists idx_inhouse_archive_dates on inhouse_archive(check_in_date, check_out_date);


-- ----------------------------------------------------------------------------
-- TABLE: messages (Memory Layer 1: Raw conversation log)
-- Every incoming/outgoing message stored verbatim. NEVER sent to LLM.
-- For audit and legal purposes only.
-- ----------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null check (channel_type in ('whatsapp', 'telegram', 'instagram')),
  channel_id text not null,
  guest_id uuid references inhouse_guests(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text default 'text' check (message_type in ('text', 'voice', 'image', 'video', 'document', 'button')),
  content text,
  media_url text,
  language text,
  intent text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

comment on table messages is 'Memory Layer 1: Raw conversation archive. Audit only.';

create index if not exists idx_messages_channel on messages(channel_type, channel_id, created_at desc);
create index if not exists idx_messages_guest on messages(guest_id, created_at desc);


-- ----------------------------------------------------------------------------
-- TABLE: conversation_summary (Memory Layer 2: Compressed history)
-- Cumulative summary that grows as conversation progresses.
-- Triggered every 20 messages OR when context exceeds 8000 tokens.
-- ----------------------------------------------------------------------------
create table if not exists conversation_summary (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null check (channel_type in ('whatsapp', 'telegram', 'instagram')),
  channel_id text not null,
  guest_id uuid references inhouse_guests(id) on delete set null,
  summary_text text not null,
  message_count int default 0,
  last_compressed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(channel_type, channel_id)
);

comment on table conversation_summary is 'Memory Layer 2: LLM-generated cumulative summary, sent to LLM every turn';

create index if not exists idx_conversation_summary_channel on conversation_summary(channel_type, channel_id);


-- ----------------------------------------------------------------------------
-- TABLE: customer_facts (Memory Layer 3: Critical structured facts)
-- Sabit sütunlu, asla unutulmayan gerçekler. Sent with EVERY LLM call.
-- ----------------------------------------------------------------------------
create table if not exists customer_facts (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null check (channel_type in ('whatsapp', 'telegram', 'instagram')),
  channel_id text not null,
  guest_id uuid references inhouse_guests(id) on delete set null,
  full_name text,
  room_number text,
  check_in_date date,
  check_out_date date,
  language text,
  allergies jsonb default '[]'::jsonb,
  dietary_preferences jsonb default '[]'::jsonb,
  special_requests jsonb default '[]'::jsonb,
  open_complaint text,
  vip_status text,
  metadata jsonb default '{}'::jsonb,
  last_updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(channel_type, channel_id)
);

comment on table customer_facts is 'Memory Layer 3: Structured facts. Updated by fact-extractor skill.';

create index if not exists idx_customer_facts_channel on customer_facts(channel_type, channel_id);
create index if not exists idx_customer_facts_guest on customer_facts(guest_id);


-- ----------------------------------------------------------------------------
-- TABLE: customer_facts_archive
-- Archived after guest checkout (1 year retention per hotel policy)
-- ----------------------------------------------------------------------------
create table if not exists customer_facts_archive (
  id uuid primary key default gen_random_uuid(),
  original_facts_id uuid,
  channel_type text,
  channel_id text,
  full_name text,
  room_number text,
  check_in_date date,
  check_out_date date,
  language text,
  allergies jsonb,
  dietary_preferences jsonb,
  special_requests jsonb,
  vip_status text,
  metadata jsonb,
  archived_at timestamptz default now()
);

create index if not exists idx_customer_facts_archive_name on customer_facts_archive(full_name);


-- ============================================================================
-- SECTION 2: DEPARTMENTS & STAFF
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: departments
-- 7 fixed departments per hotel
-- ----------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in (
    'front_office', 'housekeeping', 'technical', 'fb',
    'guest_relation', 'spa', 'animation'
  )),
  display_name text not null,
  is_enabled boolean default true,
  sla_minutes int not null default 5,
  working_hours jsonb default '[]'::jsonb,
  off_hours_behavior text default 'forward_to_reception' check (
    off_hours_behavior in ('forward_to_reception', 'wait_until_business', 'reject')
  ),
  notification_channel_priority text default 'whatsapp' check (
    notification_channel_priority in ('whatsapp', 'telegram', 'both')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table departments is '7 hotel departments with SLA & working hour config';
comment on column departments.working_hours is 'JSON array: [{"day":1,"start":"08:00","end":"16:00"},...]';

-- Seed the 7 departments
insert into departments (code, display_name, sla_minutes) values
  ('front_office',   'Front Office',         3),
  ('housekeeping',   'Housekeeping',         5),
  ('technical',      'Technical Service',   10),
  ('fb',             'F&B',                  5),
  ('guest_relation', 'Guest Relation',       3),
  ('spa',            'SPA',                  5),
  ('animation',      'Animation',           10)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- TABLE: department_staff
-- People who receive notifications for each department (max 15 per dept)
-- ----------------------------------------------------------------------------
create table if not exists department_staff (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  full_name text not null,
  role text,
  whatsapp_id text,
  telegram_id text,
  email text,
  shift_start time,
  shift_end time,
  is_active boolean default true,
  receives_notifications boolean default true,
  is_allergy_responsible boolean default false,
  is_critical_word_responsible boolean default false,
  created_at timestamptz default now()
);

comment on table department_staff is 'Up to 15 staff per department, 5 per shift';

create index if not exists idx_dept_staff_dept on department_staff(department_id) where is_active = true;


-- ----------------------------------------------------------------------------
-- TABLE: technical_subcategories
-- Technical service has internal categories (water, electric, carpentry...)
-- ----------------------------------------------------------------------------
create table if not exists technical_subcategories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in (
    'plumbing', 'electrical', 'carpentry', 'hvac',
    'elevator', 'general', 'emergency'
  )),
  display_name text not null,
  is_emergency boolean default false,
  created_at timestamptz default now()
);

insert into technical_subcategories (code, display_name, is_emergency) values
  ('plumbing',    'Plumbing (water, pipes, leaks)', false),
  ('electrical',  'Electrical (power, lights, sparks)', false),
  ('carpentry',   'Carpentry (furniture, doors, windows)', false),
  ('hvac',        'HVAC (AC, heating, ventilation)', false),
  ('elevator',    'Elevator', false),
  ('general',     'General Maintenance', false),
  ('emergency',   'Emergency (water flood, gas leak, fire)', true)
on conflict (code) do nothing;


-- Junction: which staff handles which technical subcategory
create table if not exists technical_staff_subcategories (
  staff_id uuid references department_staff(id) on delete cascade,
  subcategory_id uuid references technical_subcategories(id) on delete cascade,
  primary key (staff_id, subcategory_id)
);


-- ============================================================================
-- SECTION 3: REQUESTS & TICKETS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: requests
-- All guest requests/complaints flow here
-- ----------------------------------------------------------------------------
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  channel_type text check (channel_type in ('whatsapp', 'telegram', 'instagram')),
  channel_id text,
  guest_id uuid references inhouse_guests(id) on delete set null,
  room_number text,
  full_name text,
  request_text text not null,
  request_text_tr text,
  language text default 'tr',
  intent text,
  department_id uuid references departments(id) on delete set null,
  subcategory_id uuid references technical_subcategories(id) on delete set null,
  assigned_staff_id uuid references department_staff(id) on delete set null,
  image_urls jsonb default '[]'::jsonb,
  voice_url text,
  status text default 'pending' check (status in (
    'pending', 'acknowledged_now', 'acknowledged_later',
    'in_progress', 'resolved', 'escalated', 'cancelled'
  )),
  priority text default 'normal' check (priority in ('normal', 'high', 'emergency')),
  is_emergency boolean default false,
  is_off_hours boolean default false,
  escalated_to_reception boolean default false,
  reception_note text,
  created_at timestamptz default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_minutes int,
  sla_breached boolean default false,
  metadata jsonb default '{}'::jsonb
);

comment on table requests is 'Central table for all guest requests with SLA tracking';

create index if not exists idx_requests_status on requests(status, created_at desc);
create index if not exists idx_requests_dept on requests(department_id, status);
create index if not exists idx_requests_guest on requests(guest_id, created_at desc);
create index if not exists idx_requests_emergency on requests(is_emergency) where is_emergency = true;


-- ----------------------------------------------------------------------------
-- TABLE: sla_violations
-- When a department fails to respond within SLA window
-- ----------------------------------------------------------------------------
create table if not exists sla_violations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  expected_response_minutes int,
  actual_response_minutes int,
  reception_acknowledged_by text,
  reception_explanation text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_sla_violations_request on sla_violations(request_id);


-- ----------------------------------------------------------------------------
-- TABLE: fb_room_service_orders
-- F&B-specific order details
-- ----------------------------------------------------------------------------
create table if not exists fb_room_service_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  items jsonb not null,
  total_estimated_amount numeric(10,2),
  delivered_at timestamptz,
  created_at timestamptz default now()
);


-- ============================================================================
-- SECTION 4: HOTEL OPERATIONAL DATA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: hotel_settings
-- Single-row table holding hotel-level config
-- ----------------------------------------------------------------------------
create table if not exists hotel_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null,
  contact_phone text,
  contact_email text,
  address text,
  google_maps_url text,
  general_rules text,
  extra_info text,
  check_in_time time default '14:00',
  check_out_time time default '12:00',
  default_language text default 'tr',
  supported_languages jsonb default '["tr","en","ru","de","fr","ar","ja"]'::jsonb,
  wifi_info jsonb default '{}'::jsonb,
  iban_info jsonb default '[]'::jsonb,
  reservation_links jsonb default '[]'::jsonb,
  agency_links jsonb default '[]'::jsonb,
  taxi_info jsonb default '{}'::jsonb,
  exchange_office_info jsonb default '{}'::jsonb,
  atm_locations jsonb default '[]'::jsonb,
  bus_stop_info jsonb default '{}'::jsonb,
  bazaar_info jsonb default '{}'::jsonb,
  doctor_office_info jsonb default '{}'::jsonb,
  ramazan_info jsonb default '{}'::jsonb,
  directions_text text,
  updated_at timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- TABLE: dnd_list
-- Daily Do-Not-Disturb list (uploaded by Housekeeping)
-- ----------------------------------------------------------------------------
create table if not exists dnd_list (
  id uuid primary key default gen_random_uuid(),
  room_number text not null,
  dnd_date date not null,
  uploaded_by_method text check (uploaded_by_method in ('excel', 'manual', 'sensor')),
  notes text,
  created_at timestamptz default now(),
  unique(room_number, dnd_date)
);

create index if not exists idx_dnd_date on dnd_list(dnd_date);


-- ----------------------------------------------------------------------------
-- TABLE: allergic_guests
-- Active allergic guest panel (Guest Relation manages this)
-- ----------------------------------------------------------------------------
create table if not exists allergic_guests (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references inhouse_guests(id) on delete cascade,
  channel_type text,
  channel_id text,
  full_name text,
  room_number text,
  allergies jsonb not null,
  notified_staff_ids jsonb default '[]'::jsonb,
  notified_at timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_allergic_active on allergic_guests(is_active) where is_active = true;
create index if not exists idx_allergic_guest on allergic_guests(guest_id);


-- ----------------------------------------------------------------------------
-- TABLE: critical_word_escalations
-- Triggered when guest message contains words like "şikayet", "iade", "berbat"
-- ----------------------------------------------------------------------------
create table if not exists critical_word_escalations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) on delete set null,
  channel_type text,
  channel_id text,
  guest_message_excerpt text,
  detected_words jsonb,
  notified_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz default now()
);

create index if not exists idx_critical_unresolved on critical_word_escalations(resolved_at) where resolved_at is null;


-- ----------------------------------------------------------------------------
-- TABLE: lost_items
-- Lost & found tracking
-- ----------------------------------------------------------------------------
create table if not exists lost_items (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references inhouse_guests(id) on delete set null,
  room_number text,
  full_name text,
  check_in_date date,
  check_out_date date,
  item_description text not null,
  guest_notes text,
  status text default 'reported' check (status in ('reported', 'searching', 'found', 'returned', 'not_found')),
  staff_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ============================================================================
-- SECTION 5: DOCUMENTS & RAG (pgvector)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: hotel_documents
-- PDF/Word/Excel documents uploaded via panels
-- ----------------------------------------------------------------------------
create table if not exists hotel_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in (
    'concept', 'fact_sheet', 'price_list', 'day_use', 'map',
    'iban', 'bar_menu', 'room_service_menu', 'spa_services',
    'a_la_carte', 'wifi_info', 'dnd_list', 'agency_list',
    'general_rules', 'taxi_info', 'parking_info', 'other'
  )),
  department_code text,
  language text default 'tr',
  file_url text not null,
  file_name text,
  file_size_bytes int,
  mime_type text,
  raw_text text,
  is_active boolean default true,
  uploaded_by text,
  uploaded_at timestamptz default now(),
  parsed_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

comment on table hotel_documents is 'Source documents uploaded by hotel staff via panels';

create index if not exists idx_hotel_documents_type on hotel_documents(document_type) where is_active = true;
create index if not exists idx_hotel_documents_dept on hotel_documents(department_code) where is_active = true;


-- ----------------------------------------------------------------------------
-- TABLE: document_chunks
-- Documents split into semantic chunks with embeddings (pgvector RAG)
-- ----------------------------------------------------------------------------
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references hotel_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  content_tokens int,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

comment on table document_chunks is 'pgvector RAG: semantic search over hotel documents';

-- HNSW index for fast similarity search
create index if not exists idx_document_chunks_embedding
  on document_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_document_chunks_document on document_chunks(document_id);


-- ----------------------------------------------------------------------------
-- FUNCTION: match_documents
-- Semantic search RPC for the bot
-- ----------------------------------------------------------------------------
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_document_type text default null,
  filter_department text default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_type text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id as chunk_id,
    dc.document_id,
    hd.document_type,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join hotel_documents hd on hd.id = dc.document_id
  where hd.is_active = true
    and (filter_document_type is null or hd.document_type = filter_document_type)
    and (filter_department is null or hd.department_code = filter_department)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;


-- ============================================================================
-- SECTION 6: ADMIN USERS (Hotel-side)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: admin_users
-- Hotel staff who log into the admin panel
-- ----------------------------------------------------------------------------
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  email text,
  role text not null check (role in (
    'hotel_owner', 'general_manager', 'department_manager', 'staff'
  )),
  department_code text,
  is_active boolean default true,
  last_login_at timestamptz,
  failed_login_attempts int default 0,
  locked_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_admin_users_username on admin_users(username);


-- ----------------------------------------------------------------------------
-- TABLE: admin_sessions
-- 5-minute idle timeout
-- ----------------------------------------------------------------------------
create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users(id) on delete cascade,
  token_hash text not null,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_admin_sessions_token on admin_sessions(token_hash);


-- ----------------------------------------------------------------------------
-- TABLE: hotel_audit_log
-- Hotel-side audit trail
-- ----------------------------------------------------------------------------
create table if not exists hotel_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text check (actor_type in ('admin_user', 'system', 'cron', 'bot')),
  actor_id uuid,
  actor_username text,
  action text not null,
  resource_type text,
  resource_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists idx_hotel_audit_actor on hotel_audit_log(actor_type, created_at desc);


-- ============================================================================
-- SECTION 7: TRIGGERS
-- ============================================================================

create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_departments on departments;
create trigger set_updated_at_departments
  before update on departments
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_lost_items on lost_items;
create trigger set_updated_at_lost_items
  before update on lost_items
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_admin_users on admin_users;
create trigger set_updated_at_admin_users
  before update on admin_users
  for each row execute function trigger_set_updated_at();


-- ============================================================================
-- DONE
-- ============================================================================
-- Next: Run 06_hotel_rls.sql for Row Level Security
-- Total tables: 26
-- Total functions: 2 (trigger_set_updated_at, match_documents)
