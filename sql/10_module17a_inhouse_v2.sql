-- ############################################################################
-- ⚠️  DEPRECATED / ARŞİV — 2026-06-01 (A15 / AUDIT D7) — CANLI DB'YE UYGULANMAZ
-- BU DOSYA TARİHSEL REFERANSTIR (silinmedi). Tenant şemasının tek otoritesi:
-- migrations/tenant/*.sql. Migration sistemi öncesi elle "SQL Editor" bootstrap
-- lineage'ından bir dosyadır; inhouse_guests_v2 artık migrations/tenant/005_*
-- ile yönetilir. 2026-06-01 probe: canlı drift YOK.
-- ############################################################################
--
-- ============================================================================
-- MODUL 17a — Front-Office In-House Yonetim Sistemi
-- Hotel Supabase'inde calistir (Demo Hotel SQL Editor)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: inhouse_guests_v2
-- Excel'den yuklenen misafir listesi (v2 - daha zengin schema)
-- status: active | archived
-- ----------------------------------------------------------------------------
create table if not exists inhouse_guests_v2 (
  id uuid primary key default gen_random_uuid(),
  room_number text not null,
  agency text,
  guest_name text not null,
  guest_count int default 1,
  check_in_date date not null,
  check_out_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  upload_batch_id uuid,               -- hangi upload'a ait oldugu
  archived_at timestamptz,            -- ne zaman arsivlendi
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table inhouse_guests_v2 is 'Module 17a: Excel upload ile doldurulan in-house misafir listesi.';
comment on column inhouse_guests_v2.status is 'active = konakliyor, archived = cikis yapti veya artik listede yok';
comment on column inhouse_guests_v2.upload_batch_id is 'Her Excel yukleme islemine ait tekil batch UUID';

create index if not exists idx_inhouse_v2_status on inhouse_guests_v2(status);
create index if not exists idx_inhouse_v2_room on inhouse_guests_v2(room_number) where status = 'active';
create index if not exists idx_inhouse_v2_batch on inhouse_guests_v2(upload_batch_id);


-- ----------------------------------------------------------------------------
-- TABLE: excel_column_mapping
-- Her otel icin Excel kolon basliklari -> alan mapping'i saklar
-- Bir sonraki yukleme icin otomatik onceden doldurma saglar
-- ----------------------------------------------------------------------------
create table if not exists excel_column_mapping (
  id uuid primary key default gen_random_uuid(),
  hotel_slug text not null unique,    -- otel bazinda tek satir
  room_number_col text,
  agency_col text,
  guest_name_col text,
  guest_count_col text,
  check_in_col text,
  check_out_col text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table excel_column_mapping is 'Module 17a: Otel bazinda Excel kolon mapping''i. UPSERT ile guncellenir.';


-- ----------------------------------------------------------------------------
-- TABLE: inhouse_upload_history
-- Her Excel yukleme isleminin kaydi
-- ----------------------------------------------------------------------------
create table if not exists inhouse_upload_history (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique,
  hotel_slug text not null,
  uploaded_by text,                   -- admin kullanici adi
  file_name text,
  inserted_count int default 0,
  updated_count int default 0,
  archived_count int default 0,
  total_rows int default 0,
  status text default 'success' check (status in ('success', 'partial', 'failed')),
  error_detail text,
  created_at timestamptz default now()
);

comment on table inhouse_upload_history is 'Module 17a: Excel yukleme gecmisi. Her yukleme bir satir.';

create index if not exists idx_upload_history_slug on inhouse_upload_history(hotel_slug, created_at desc);


-- ----------------------------------------------------------------------------
-- TRIGGER: updated_at for inhouse_guests_v2
-- ----------------------------------------------------------------------------
drop trigger if exists set_updated_at_inhouse_v2 on inhouse_guests_v2;
create trigger set_updated_at_inhouse_v2
  before update on inhouse_guests_v2
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_excel_mapping on excel_column_mapping;
create trigger set_updated_at_excel_mapping
  before update on excel_column_mapping
  for each row execute function trigger_set_updated_at();


-- ============================================================================
-- DONE
-- Tabloları hotel Supabase SQL Editor'de calistir.
-- ============================================================================
