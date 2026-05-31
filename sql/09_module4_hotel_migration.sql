-- ############################################################################
-- ⚠️  DEPRECATED / ARŞİV — 2026-06-01 (A15 / AUDIT D7) — CANLI DB'YE UYGULANMAZ
-- BU DOSYA TARİHSEL REFERANSTIR (silinmedi). Tenant şemasının tek otoritesi:
-- migrations/tenant/*.sql. Migration sistemi öncesi elle "SQL Editor" bootstrap
-- lineage'ından bir dosyadır; içeriği (guests, conversations vb.)
-- migrations/tenant/001 ile karşılanmıştır. 2026-06-01 probe: canlı drift YOK.
-- ############################################################################
--
-- ============================================================================
-- HOTELGEN — MODULE 4: DEMO HOTEL SUPABASE MIGRATION
-- ============================================================================
-- Çalıştır: Demo Hotel Supabase Dashboard > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) guests tablosu — Telegram'dan gelen kullanıcılar
--    (inhouse_guests farklı: ön büro yükler, bu bot tarafından oluşturulan)
-- ----------------------------------------------------------------------------
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  telegram_user_id bigint unique,
  telegram_username text,
  whatsapp_id text,
  instagram_id text,
  language text default 'tr',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table guests is 'Bot tarafından tanınan misafirler (kanal bazlı)';
comment on column guests.telegram_user_id is 'Telegram user.id (unique per user globally)';

create index if not exists idx_guests_telegram on guests(telegram_user_id) where telegram_user_id is not null;
create index if not exists idx_guests_whatsapp on guests(whatsapp_id) where whatsapp_id is not null;

-- ----------------------------------------------------------------------------
-- 2) conversations tablosu — Her kanal oturumu bir conversation
-- ----------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete set null,
  channel text not null check (channel in ('telegram', 'whatsapp', 'instagram')),
  telegram_chat_id bigint,
  whatsapp_chat_id text,
  instagram_thread_id text,
  status text default 'active' check (status in ('active', 'closed', 'archived')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(channel, telegram_chat_id),
  unique(channel, whatsapp_chat_id),
  unique(channel, instagram_thread_id)
);

comment on table conversations is 'Her misafir-kanal çifti için oturum';

create index if not exists idx_conversations_guest on conversations(guest_id);
create index if not exists idx_conversations_telegram on conversations(telegram_chat_id) where telegram_chat_id is not null;
create index if not exists idx_conversations_status on conversations(status, created_at desc);

-- ----------------------------------------------------------------------------
-- 3) bot_messages tablosu — Webhook route.ts'in yazdığı mesajlar
--    (05_hotel_schema.sql'deki messages tablosundan bağımsız — o audit içindir)
--    route.ts conversation_id + direction + content + message_type + metadata bekliyor
-- ----------------------------------------------------------------------------
create table if not exists bot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  message_type text default 'text' check (message_type in ('text', 'voice', 'photo', 'document', 'button')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

comment on table bot_messages is 'Bot konuşma geçmişi (conversation_id bazlı)';

create index if not exists idx_bot_messages_conversation on bot_messages(conversation_id, created_at desc);
create index if not exists idx_bot_messages_direction on bot_messages(direction, created_at desc);

-- ----------------------------------------------------------------------------
-- 4) updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_guests on guests;
create trigger set_updated_at_guests
  before update on guests
  for each row execute function trigger_set_updated_at();

drop trigger if exists set_updated_at_conversations on conversations;
create trigger set_updated_at_conversations
  before update on conversations
  for each row execute function trigger_set_updated_at();

-- ----------------------------------------------------------------------------
-- Doğrulama
-- ----------------------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('guests', 'conversations', 'bot_messages')
order by table_name;
