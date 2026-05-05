-- ============================================================================
-- HOTELGEN — CENTRAL SUPABASE SCHEMA
-- ============================================================================
-- This database is owned by HotelGen team (us). It manages all hotels,
-- bridge credentials to their isolated Supabase projects, and master admin
-- accounts. Hotel operational data lives in each hotel's own Supabase.
--
-- Run this in: Supabase Dashboard > SQL Editor (Central project)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ----------------------------------------------------------------------------
-- TABLE: packages
-- Defines the three product tiers offered to hotels
-- ----------------------------------------------------------------------------
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in ('basic', 'full', 'premium')),
  display_name text not null,
  description text,
  features jsonb not null default '{}'::jsonb,
  monthly_price_usd numeric(10,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table packages is 'Product tiers offered to hotels (Basic/Full/Premium)';
comment on column packages.features is 'Feature flags as JSON (e.g. {"voice_agent": true, "request_management": true})';

-- Seed the three default packages
insert into packages (code, display_name, description, features, monthly_price_usd) values
  ('basic',   'Basic Plan',   'Information & chat only. No request management. No department IDs.',
   '{"information_chat": true, "request_management": false, "voice_agent": false, "rag_search": true, "memory_layers": 3}'::jsonb, 0),
  ('full',    'Full Plan',    'Information + request management + all 7 departments. No voice agent.',
   '{"information_chat": true, "request_management": true, "voice_agent": false, "rag_search": true, "memory_layers": 3, "all_departments": true}'::jsonb, 0),
  ('premium', 'Premium Plan', 'Full + voice agent (Phase 2 ready).',
   '{"information_chat": true, "request_management": true, "voice_agent": true, "rag_search": true, "memory_layers": 3, "all_departments": true}'::jsonb, 0)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- TABLE: hotels
-- Master registry of all client hotels
-- ----------------------------------------------------------------------------
create table if not exists hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  brand_color text,
  package_id uuid references packages(id) on delete restrict,
  contract_start_date date,
  contract_end_date date,
  contract_months int,
  monthly_revenue_usd numeric(10,2) default 0,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  google_maps_url text,
  status text default 'active' check (status in ('active', 'suspended', 'cancelled', 'demo')),
  is_demo boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table hotels is 'Master list of all hotels using HotelGen';
comment on column hotels.slug is 'URL-safe identifier (e.g., "demo-resort-spa")';
comment on column hotels.is_demo is 'TRUE for demo hotel used for sales presentations';

create index if not exists idx_hotels_slug on hotels(slug);
create index if not exists idx_hotels_status on hotels(status);
create index if not exists idx_hotels_is_demo on hotels(is_demo);


-- ----------------------------------------------------------------------------
-- TABLE: bridge_credentials
-- Encrypted Supabase URL + service key for each hotel's isolated DB
-- ----------------------------------------------------------------------------
create table if not exists bridge_credentials (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  supabase_url_encrypted text not null,
  supabase_anon_key_encrypted text not null,
  supabase_service_key_encrypted text not null,
  manychat_api_key_encrypted text,
  manychat_workspace_id text,
  telegram_bot_token_encrypted text,
  telegram_bot_username text,
  whatsapp_business_id text,
  encryption_key_version int default 1,
  last_verified_at timestamptz,
  is_healthy boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(hotel_id)
);

comment on table bridge_credentials is 'Encrypted credentials (AES-256) to access each hotel''s isolated Supabase';
comment on column bridge_credentials.encryption_key_version is 'For future key rotation support';

create index if not exists idx_bridge_credentials_hotel on bridge_credentials(hotel_id);


-- ----------------------------------------------------------------------------
-- TABLE: channel_routing
-- Maps incoming channel IDs (WhatsApp/Telegram/IG) to hotel
-- Used by Tenant Resolver
-- ----------------------------------------------------------------------------
create table if not exists channel_routing (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  channel_type text not null check (channel_type in ('whatsapp', 'telegram', 'instagram')),
  channel_identifier text not null,
  webhook_secret text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(channel_type, channel_identifier)
);

comment on table channel_routing is 'Tenant Resolver lookup: which channel ID belongs to which hotel';
comment on column channel_routing.channel_identifier is 'Bot username, page ID, or workspace ID depending on channel';

create index if not exists idx_channel_routing_lookup on channel_routing(channel_type, channel_identifier) where is_active = true;


-- ----------------------------------------------------------------------------
-- TABLE: master_admins
-- HotelGen team accounts (us) for Master Hub access
-- ----------------------------------------------------------------------------
create table if not exists master_admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  email text,
  role text not null check (role in ('super_admin', 'admin', 'support', 'default_admin')),
  is_active boolean default true,
  last_login_at timestamptz,
  failed_login_attempts int default 0,
  locked_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table master_admins is 'HotelGen team members with Master Hub access';
comment on column master_admins.role is 'super_admin = Özgür ÖZEN level, default_admin = backup account';


-- ----------------------------------------------------------------------------
-- TABLE: master_admin_sessions
-- Active sessions for master admins (5min auto-logout)
-- ----------------------------------------------------------------------------
create table if not exists master_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references master_admins(id) on delete cascade,
  token_hash text not null,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_master_admin_sessions_token on master_admin_sessions(token_hash);
create index if not exists idx_master_admin_sessions_admin on master_admin_sessions(admin_id);


-- ----------------------------------------------------------------------------
-- TABLE: vip_managers
-- VIP managers (CEO, owner level) per hotel
-- ----------------------------------------------------------------------------
create table if not exists vip_managers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  full_name text not null,
  email text,
  whatsapp_id text,
  telegram_id text,
  preferred_channel text check (preferred_channel in ('whatsapp', 'telegram', 'email')),
  preferred_language text default 'tr',
  receives_voice_reports boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

comment on table vip_managers is 'Top-level managers who can request operational reports';

create index if not exists idx_vip_managers_hotel on vip_managers(hotel_id);


-- ----------------------------------------------------------------------------
-- TABLE: audit_log
-- All system-level changes are logged here
-- ----------------------------------------------------------------------------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('master_admin', 'hotel_admin', 'system', 'cron')),
  actor_id uuid,
  actor_username text,
  action text not null,
  resource_type text,
  resource_id uuid,
  hotel_id uuid references hotels(id) on delete set null,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

comment on table audit_log is 'Audit trail for all sensitive operations (KVKK + security)';

create index if not exists idx_audit_log_hotel on audit_log(hotel_id, created_at desc);
create index if not exists idx_audit_log_actor on audit_log(actor_type, actor_id, created_at desc);
create index if not exists idx_audit_log_action on audit_log(action, created_at desc);


-- ----------------------------------------------------------------------------
-- TABLE: system_health
-- Self-test agent writes daily health snapshots here
-- ----------------------------------------------------------------------------
create table if not exists system_health (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('ok', 'warning', 'error')),
  details jsonb,
  checked_at timestamptz default now()
);

create index if not exists idx_system_health_hotel on system_health(hotel_id, checked_at desc);


-- ----------------------------------------------------------------------------
-- TRIGGERS: Auto-update updated_at
-- ----------------------------------------------------------------------------
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_packages on packages;
create trigger set_updated_at_packages
  before update on packages
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_hotels on hotels;
create trigger set_updated_at_hotels
  before update on hotels
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_bridge_credentials on bridge_credentials;
create trigger set_updated_at_bridge_credentials
  before update on bridge_credentials
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_master_admins on master_admins;
create trigger set_updated_at_master_admins
  before update on master_admins
  for each row execute function trigger_set_updated_at();


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- After running this, run 02_central_rls.sql to enable Row Level Security.
