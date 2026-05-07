-- ============================================================================
-- HOTELGEN — MODULE 4: DEMO HOTEL MIGRATION (SAFE / IDEMPOTENT)
-- ============================================================================
-- Bu dosyayı DEMO HOTEL Supabase Dashboard > SQL Editor'a yapıştır.
-- Daha önce 09_module4_hotel_migration.sql çalıştırıldıysa da güvenle çalışır.
-- ============================================================================

-- 1) guests
create table if not exists guests (
  id                 uuid        primary key default gen_random_uuid(),
  full_name          text        not null,
  telegram_user_id   bigint      unique,
  telegram_username  text,
  whatsapp_id        text,
  instagram_id       text,
  language           text        default 'tr',
  metadata           jsonb       default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- 2) conversations
--    NOT: nullable sütunlar üzerinde multi-column unique sorun çıkarır;
--    her kanal için ayrı partial unique index kullanıyoruz.
create table if not exists conversations (
  id                   uuid        primary key default gen_random_uuid(),
  guest_id             uuid        references guests(id) on delete set null,
  channel              text        not null check (channel in ('telegram', 'whatsapp', 'instagram')),
  telegram_chat_id     bigint,
  whatsapp_chat_id     text,
  instagram_thread_id  text,
  status               text        default 'active' check (status in ('active', 'closed', 'archived')),
  metadata             jsonb       default '{}'::jsonb,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Partial unique index'ler (nullable kolonlar için güvenli)
create unique index if not exists uq_conversations_telegram
  on conversations(telegram_chat_id)
  where telegram_chat_id is not null;

create unique index if not exists uq_conversations_whatsapp
  on conversations(whatsapp_chat_id)
  where whatsapp_chat_id is not null;

create unique index if not exists uq_conversations_instagram
  on conversations(instagram_thread_id)
  where instagram_thread_id is not null;

create index if not exists idx_conversations_guest    on conversations(guest_id);
create index if not exists idx_conversations_telegram on conversations(telegram_chat_id) where telegram_chat_id is not null;
create index if not exists idx_conversations_status   on conversations(status, created_at desc);

-- 3) bot_messages
create table if not exists bot_messages (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references conversations(id) on delete cascade,
  direction        text        not null check (direction in ('inbound', 'outbound')),
  content          text,
  message_type     text        default 'text' check (message_type in ('text', 'voice', 'photo', 'document', 'button')),
  metadata         jsonb       default '{}'::jsonb,
  created_at       timestamptz default now()
);

create index if not exists idx_bot_messages_conversation on bot_messages(conversation_id, created_at desc);

-- 4) updated_at triggers
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

-- ============================================================================
-- DOĞRULAMA — Bu sorgunun 3 satır döndürmesi gerekir:
-- bot_messages | conversations | guests
-- ============================================================================
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('guests', 'conversations', 'bot_messages')
order by table_name;
