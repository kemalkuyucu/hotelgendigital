-- ############################################################################
-- ⚠️  DEPRECATED / ARŞİV — 2026-06-01 (A15 / AUDIT D7) — CANLI DB'YE UYGULANMAZ
-- BU DOSYA TARİHSEL REFERANSTIR (silinmedi). Tenant şemasının tek otoritesi:
-- migrations/tenant/*.sql. Migration sistemi öncesi elle "SQL Editor" bootstrap
-- lineage'ından (05'in ardından çalıştırılırdı). NOT: artık var olmayan `messages`
-- gibi 05-tablolarına RLS uygular → eskimiş. 2026-06-01 probe: canlı drift YOK.
-- ############################################################################
--
-- ============================================================================
-- HOTELGEN — HOTEL SUPABASE: ROW LEVEL SECURITY
-- ============================================================================
-- Run AFTER 05_hotel_schema.sql in EACH hotel's Supabase project.
--
-- Strategy:
--   - Service role key (used by our Vercel server) bypasses RLS automatically
--   - Anon key access is BLOCKED by default
--   - Hotel admin authentication happens via custom logic in our API
--     (we do NOT use Supabase Auth for hotel admin login)
-- ============================================================================

-- Enable RLS on all tables
alter table inhouse_guests              enable row level security;
alter table inhouse_archive             enable row level security;
alter table messages                    enable row level security;
alter table conversation_summary        enable row level security;
alter table customer_facts              enable row level security;
alter table customer_facts_archive      enable row level security;
alter table departments                 enable row level security;
alter table department_staff            enable row level security;
alter table technical_subcategories     enable row level security;
alter table technical_staff_subcategories enable row level security;
alter table requests                    enable row level security;
alter table sla_violations              enable row level security;
alter table fb_room_service_orders      enable row level security;
alter table hotel_settings              enable row level security;
alter table dnd_list                    enable row level security;
alter table allergic_guests             enable row level security;
alter table critical_word_escalations   enable row level security;
alter table lost_items                  enable row level security;
alter table hotel_documents             enable row level security;
alter table document_chunks             enable row level security;
alter table admin_users                 enable row level security;
alter table admin_sessions              enable row level security;
alter table hotel_audit_log             enable row level security;


-- ----------------------------------------------------------------------------
-- POLICIES: All access goes through service role
-- ----------------------------------------------------------------------------
-- Helper macro pattern: each table gets a single policy granting service_role

create policy "service_only_inhouse_guests"          on inhouse_guests          for all using (auth.role() = 'service_role');
create policy "service_only_inhouse_archive"         on inhouse_archive         for all using (auth.role() = 'service_role');
create policy "service_only_messages"                on messages                for all using (auth.role() = 'service_role');
create policy "service_only_conversation_summary"    on conversation_summary    for all using (auth.role() = 'service_role');
create policy "service_only_customer_facts"          on customer_facts          for all using (auth.role() = 'service_role');
create policy "service_only_customer_facts_archive"  on customer_facts_archive  for all using (auth.role() = 'service_role');
create policy "service_only_departments"             on departments             for all using (auth.role() = 'service_role');
create policy "service_only_department_staff"        on department_staff        for all using (auth.role() = 'service_role');
create policy "service_only_technical_subcategories" on technical_subcategories for all using (auth.role() = 'service_role');
create policy "service_only_tech_staff_subcat"       on technical_staff_subcategories for all using (auth.role() = 'service_role');
create policy "service_only_requests"                on requests                for all using (auth.role() = 'service_role');
create policy "service_only_sla_violations"          on sla_violations          for all using (auth.role() = 'service_role');
create policy "service_only_fb_room_service"         on fb_room_service_orders  for all using (auth.role() = 'service_role');
create policy "service_only_hotel_settings"          on hotel_settings          for all using (auth.role() = 'service_role');
create policy "service_only_dnd_list"                on dnd_list                for all using (auth.role() = 'service_role');
create policy "service_only_allergic_guests"         on allergic_guests         for all using (auth.role() = 'service_role');
create policy "service_only_critical_word"           on critical_word_escalations for all using (auth.role() = 'service_role');
create policy "service_only_lost_items"              on lost_items              for all using (auth.role() = 'service_role');
create policy "service_only_hotel_documents"         on hotel_documents         for all using (auth.role() = 'service_role');
create policy "service_only_document_chunks"         on document_chunks         for all using (auth.role() = 'service_role');
create policy "service_only_admin_users"             on admin_users             for all using (auth.role() = 'service_role');
create policy "service_only_admin_sessions"          on admin_sessions          for all using (auth.role() = 'service_role');
create policy "service_only_hotel_audit_log"         on hotel_audit_log         for all using (auth.role() = 'service_role');


-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
-- Next: 07_hotel_storage.sql for storage buckets
