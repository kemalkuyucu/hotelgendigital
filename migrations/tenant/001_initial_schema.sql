-- =============================================================================
-- 001_initial_schema.sql
-- Temel tenant şeması: guests, conversations, bot_messages, hotel_settings,
-- hotel_facts, hotel_documents, document_chunks, departments, department_staff,
-- hotel_admin_users, hotel_audit_log, ai_intents, forwarded_messages,
-- customer_facts, customer_facts_archive, dnd_list, requests, sla_violations,
-- conversation_summary, knowledge_answers, knowledge_documents, knowledge_sections,
-- guest_facts, allergic_guests, critical_word_escalations, fb_room_service_orders,
-- lost_items, inhouse_guests (eski), inhouse_archive, technical_subcategories,
-- technical_staff_subcategories, verification_attempts
-- =============================================================================

-- ---------------------------------------------------------------------------
-- guests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL,
  telegram_user_id  BIGINT,
  telegram_username TEXT,
  whatsapp_id       TEXT,
  instagram_id      TEXT,
  language          TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id                        UUID REFERENCES guests(id),
  channel                         TEXT NOT NULL,
  telegram_chat_id                BIGINT,
  whatsapp_chat_id                TEXT,
  instagram_thread_id             TEXT,
  status                          TEXT,
  metadata                        JSONB,
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW(),
  last_intent                     TEXT,
  last_forwarded_at               TIMESTAMPTZ,
  verified_inhouse_guest_id       UUID,
  verified_at                     TIMESTAMPTZ,
  verification_pending_intent     TEXT,
  verification_attempts           INTEGER NOT NULL DEFAULT 0,
  verification_last_attempt_at    TIMESTAMPTZ,
  pending_request_text            TEXT,
  pending_intents_json            JSONB,
  last_message_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_telegram_chat_id
  ON conversations(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON conversations(last_message_at DESC);

-- ---------------------------------------------------------------------------
-- bot_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  direction        TEXT NOT NULL,
  text             TEXT,
  message_type     TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_conversation_id
  ON bot_messages(conversation_id);

-- ---------------------------------------------------------------------------
-- hotel_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name              TEXT NOT NULL,
  contact_phone           TEXT,
  contact_email           TEXT,
  address                 TEXT,
  google_maps_url         TEXT,
  general_rules           TEXT,
  extra_info              TEXT,
  check_in_time           TIME,
  check_out_time          TIME,
  default_language        TEXT,
  supported_languages     JSONB,
  wifi_info               JSONB,
  iban_info               JSONB,
  reservation_links       JSONB,
  agency_links            JSONB,
  taxi_info               JSONB,
  exchange_office_info    JSONB,
  atm_locations           JSONB,
  bus_stop_info           JSONB,
  bazaar_info             JSONB,
  doctor_office_info      JSONB,
  ramazan_info            JSONB,
  directions_text         TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  concept_type            TEXT,
  location_info           JSONB,
  nearby_places           JSONB
);

-- ---------------------------------------------------------------------------
-- hotel_facts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_facts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key       TEXT NOT NULL,
  fact_value     TEXT NOT NULL,
  fact_label     TEXT NOT NULL,
  category       TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- hotel_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type     TEXT NOT NULL,
  department_code   TEXT,
  language          TEXT,
  file_url          TEXT,
  file_name         TEXT,
  file_size_bytes   INTEGER,
  mime_type         TEXT,
  raw_text          TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  uploaded_by       TEXT,
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  parsed_at         TIMESTAMPTZ,
  metadata          JSONB,
  delivery_policy   TEXT,
  display_text      TEXT,
  structured_data   JSONB,
  ai_auto_send      BOOLEAN DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- document_chunks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES hotel_documents(id),
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  content_tokens  INTEGER,
  embedding       TEXT,  -- public.vector(1536) — pgvector extension gerektirir
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                             TEXT NOT NULL,
  display_name                     TEXT NOT NULL,
  is_enabled                       BOOLEAN DEFAULT TRUE,
  sla_minutes                      INTEGER NOT NULL DEFAULT 30,
  working_hours                    JSONB,
  off_hours_behavior               TEXT,
  notification_channel_priority    TEXT,
  created_at                       TIMESTAMPTZ DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ DEFAULT NOW(),
  telegram_chat_id                 TEXT,
  reception_sla_minutes            INTEGER NOT NULL DEFAULT 15,
  holidays                         JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code
  ON departments(code);

-- ---------------------------------------------------------------------------
-- department_staff
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS department_staff (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key    TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  role_title        TEXT,
  telegram_user_id  TEXT,
  telegram_username TEXT,
  whatsapp_id       TEXT,
  shift_start       TIME,
  shift_end         TIME,
  days_off          TEXT[],
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- hotel_admin_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_admin_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'staff',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_admin_users_username
  ON hotel_admin_users(username);

-- ---------------------------------------------------------------------------
-- hotel_audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type      TEXT,
  actor_id        UUID,
  actor_username  TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  details         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- ai_intents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_intents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id          UUID NOT NULL REFERENCES conversations(id),
  bot_message_id           UUID,
  classified_department    TEXT,
  confidence               NUMERIC,
  reasoning                TEXT,
  ai_response              TEXT,
  model                    TEXT NOT NULL,
  prompt_tokens            INTEGER,
  completion_tokens        INTEGER,
  latency_ms               INTEGER,
  error                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guest_message_id         UUID
);

-- ---------------------------------------------------------------------------
-- forwarded_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forwarded_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_intent_id        UUID REFERENCES ai_intents(id),
  target_department   TEXT NOT NULL,
  target_chat_id      BIGINT NOT NULL,
  telegram_message_id INTEGER,
  status              TEXT NOT NULL,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_off_hours        BOOLEAN NOT NULL DEFAULT FALSE,
  source_department   TEXT,
  target_type         TEXT
);

-- ---------------------------------------------------------------------------
-- customer_facts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_facts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type         TEXT NOT NULL,
  channel_id           TEXT NOT NULL,
  guest_id             UUID,
  full_name            TEXT,
  room_number          TEXT,
  check_in_date        DATE,
  check_out_date       DATE,
  language             TEXT,
  allergies            JSONB,
  dietary_preferences  JSONB,
  special_requests     JSONB,
  open_complaint       TEXT,
  vip_status           TEXT,
  metadata             JSONB,
  last_updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- customer_facts_archive
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_facts_archive (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_facts_id    UUID,
  channel_type         TEXT,
  channel_id           TEXT,
  full_name            TEXT,
  room_number          TEXT,
  check_in_date        DATE,
  check_out_date       DATE,
  language             TEXT,
  allergies            JSONB,
  dietary_preferences  JSONB,
  special_requests     JSONB,
  vip_status           TEXT,
  metadata             JSONB,
  archived_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- dnd_list
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dnd_list (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number         TEXT NOT NULL,
  dnd_date            DATE NOT NULL,
  uploaded_by_method  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- technical_subcategories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technical_subcategories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_emergency  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_technical_subcategories_code
  ON technical_subcategories(code);

-- ---------------------------------------------------------------------------
-- technical_staff_subcategories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technical_staff_subcategories (
  staff_id        UUID NOT NULL,
  subcategory_id  UUID NOT NULL REFERENCES technical_subcategories(id),
  PRIMARY KEY (staff_id, subcategory_id)
);

-- ---------------------------------------------------------------------------
-- requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number             TEXT,
  channel_type              TEXT,
  channel_id                TEXT,
  guest_id                  UUID,
  room_number               TEXT,
  full_name                 TEXT,
  request_text              TEXT NOT NULL,
  request_text_tr           TEXT,
  language                  TEXT,
  intent                    TEXT,
  department_id             UUID REFERENCES departments(id),
  subcategory_id            UUID REFERENCES technical_subcategories(id),
  assigned_staff_id         UUID,
  image_urls                JSONB,
  voice_url                 TEXT,
  status                    TEXT,
  priority                  TEXT,
  is_emergency              BOOLEAN DEFAULT FALSE,
  is_off_hours              BOOLEAN DEFAULT FALSE,
  escalated_to_reception    BOOLEAN DEFAULT FALSE,
  reception_note            TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at           TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  resolution_minutes        INTEGER,
  sla_breached              BOOLEAN DEFAULT FALSE,
  metadata                  JSONB
);

-- ---------------------------------------------------------------------------
-- sla_violations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_violations (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id                   UUID NOT NULL REFERENCES requests(id),
  department_id                UUID REFERENCES departments(id),
  expected_response_minutes    INTEGER,
  actual_response_minutes      INTEGER,
  reception_acknowledged_by    TEXT,
  reception_explanation        TEXT,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at                  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- critical_word_escalations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS critical_word_escalations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           UUID REFERENCES requests(id),
  channel_type         TEXT,
  channel_id           TEXT,
  guest_message_excerpt TEXT,
  detected_words       JSONB,
  notified_at          TIMESTAMPTZ,
  resolved_at          TIMESTAMPTZ,
  resolution_note      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- fb_room_service_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fb_room_service_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id              UUID NOT NULL REFERENCES requests(id),
  items                   JSONB NOT NULL,
  total_estimated_amount  NUMERIC,
  delivered_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- conversation_summary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_summary (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  summary_text     TEXT NOT NULL,
  message_count    INTEGER NOT NULL,
  last_message_id  UUID,
  model_used       TEXT,
  tokens_used      INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- guest_facts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_facts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id          UUID NOT NULL REFERENCES guests(id),
  fact_key          TEXT NOT NULL,
  fact_value        TEXT NOT NULL,
  confidence        NUMERIC,
  source_message_id UUID,
  is_verified       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- inhouse_guests (eski — v1; kullanım devam ediyor, silinmiyor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inhouse_guests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number   TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  agency        TEXT,
  voucher       TEXT,
  pax           INTEGER,
  check_in_date  DATE NOT NULL,
  check_out_date DATE NOT NULL,
  channel_ids   JSONB,
  language      TEXT,
  vip_status    TEXT,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  package       TEXT,
  last_name     TEXT,
  first_name    TEXT,
  gender        TEXT
);

-- ---------------------------------------------------------------------------
-- allergic_guests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allergic_guests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         UUID REFERENCES inhouse_guests(id),
  channel_type     TEXT,
  channel_id       TEXT,
  full_name        TEXT,
  room_number      TEXT,
  allergies        JSONB NOT NULL,
  notified_staff_ids JSONB,
  notified_at      TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- lost_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lost_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         UUID REFERENCES inhouse_guests(id),
  room_number      TEXT,
  full_name        TEXT,
  check_in_date    DATE,
  check_out_date   DATE,
  item_description TEXT NOT NULL,
  guest_notes      TEXT,
  status           TEXT DEFAULT 'open',
  staff_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- inhouse_archive
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inhouse_archive (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_guest_id UUID,
  room_number       TEXT,
  full_name         TEXT NOT NULL,
  agency            TEXT,
  pax               INTEGER,
  check_in_date     DATE,
  check_out_date    DATE,
  language          TEXT,
  vip_status        TEXT,
  archived_at       TIMESTAMPTZ DEFAULT NOW(),
  archive_reason    TEXT
);

-- ---------------------------------------------------------------------------
-- verification_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES conversations(id),
  attempted_room_no   TEXT,
  attempted_last_name TEXT,
  result              TEXT NOT NULL,
  matched_guest_id    UUID REFERENCES inhouse_guests(id),
  intent_at_attempt   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- knowledge_answers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL,
  predicted_intent TEXT,
  question_text    TEXT NOT NULL,
  answer_text      TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- knowledge_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key      TEXT NOT NULL,
  document_type       TEXT NOT NULL,
  title               TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  file_path           TEXT NOT NULL,
  file_size_bytes     INTEGER,
  mime_type           TEXT,
  uploaded_by_user_id UUID,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_content      TEXT,
  parse_status        TEXT NOT NULL DEFAULT 'pending',
  parse_error         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  version             INTEGER NOT NULL DEFAULT 1,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- knowledge_sections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_sections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  category           TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  display_order      INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_document_id UUID
);

