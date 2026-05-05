-- ============================================================================
-- HOTELGEN — CENTRAL SUPABASE: ROW LEVEL SECURITY
-- ============================================================================
-- Run this AFTER 01_central_schema.sql
--
-- IMPORTANT: All access to Central DB happens via service role key from
-- Vercel server-side code. RLS here is defense-in-depth, not primary control.
-- ============================================================================

-- Enable RLS on all sensitive tables
alter table packages enable row level security;
alter table hotels enable row level security;
alter table bridge_credentials enable row level security;
alter table channel_routing enable row level security;
alter table master_admins enable row level security;
alter table master_admin_sessions enable row level security;
alter table vip_managers enable row level security;
alter table audit_log enable row level security;
alter table system_health enable row level security;


-- ----------------------------------------------------------------------------
-- POLICY: Service role has full access (for our server-side code)
-- ----------------------------------------------------------------------------
-- Note: service_role bypasses RLS by default in Supabase, but we explicitly
-- grant for clarity and future migration safety.

-- packages: read by anyone (public info), write by service only
create policy "packages_read_all" on packages
  for select using (true);

create policy "packages_write_service" on packages
  for all using (auth.role() = 'service_role');


-- hotels: only service role
create policy "hotels_service_only" on hotels
  for all using (auth.role() = 'service_role');


-- bridge_credentials: ONLY service role, never expose
create policy "bridge_credentials_service_only" on bridge_credentials
  for all using (auth.role() = 'service_role');


-- channel_routing: only service role
create policy "channel_routing_service_only" on channel_routing
  for all using (auth.role() = 'service_role');


-- master_admins: only service role (login flow handles auth manually)
create policy "master_admins_service_only" on master_admins
  for all using (auth.role() = 'service_role');


-- master_admin_sessions: only service role
create policy "master_admin_sessions_service_only" on master_admin_sessions
  for all using (auth.role() = 'service_role');


-- vip_managers: only service role
create policy "vip_managers_service_only" on vip_managers
  for all using (auth.role() = 'service_role');


-- audit_log: write by service, never updated/deleted
create policy "audit_log_insert_service" on audit_log
  for insert with check (auth.role() = 'service_role');

create policy "audit_log_read_service" on audit_log
  for select using (auth.role() = 'service_role');


-- system_health: only service role
create policy "system_health_service_only" on system_health
  for all using (auth.role() = 'service_role');


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- Next: Run 03_central_seed_admins.sql to create the master admin accounts
