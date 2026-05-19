# Demo Hotel — Current Database Schema

**Dump Date:** 2026-05-19T15:42:54.836Z
**Supabase Project:** rvsyvegfeywzqbqljlij

---

## Tablolar (40 adet)

| # | Tablo Adı | Kolon Sayısı | Kayıt Sayısı |
|---|-----------|-------------|-------------|
| 1 | `ai_intents` | 14 | 0 |
| 2 | `allergic_guests` | 11 | 0 |
| 3 | `bot_messages` | 7 | 0 |
| 4 | `conversation_summary` | 9 | 0 |
| 5 | `conversations` | 21 | 0 |
| 6 | `critical_word_escalations` | 10 | 0 |
| 7 | `customer_facts` | 17 | 0 |
| 8 | `customer_facts_archive` | 15 | 0 |
| 9 | `department_staff` | 14 | 1 |
| 10 | `departments` | 13 | 7 |
| 11 | `dnd_list` | 6 | 0 |
| 12 | `document_chunks` | 8 | 0 |
| 13 | `excel_column_mapping` | 10 | 1 |
| 14 | `fb_room_service_orders` | 6 | 0 |
| 15 | `forwarded_messages` | 11 | 102 |
| 16 | `guest_facts` | 9 | 0 |
| 17 | `guests` | 10 | 1 |
| 18 | `hotel_admin_users` | 9 | 8 |
| 19 | `hotel_audit_log` | 10 | 0 |
| 20 | `hotel_documents` | 18 | 3 |
| 21 | `hotel_facts` | 9 | 12 |
| 22 | `hotel_settings` | 28 | 1 |
| 23 | `inhouse_archive` | 12 | 0 |
| 24 | `inhouse_guests` | 21 | 3 |
| 25 | `inhouse_guests_v2` | 14 | 20 |
| 26 | `inhouse_upload_history` | 12 | 7 |
| 27 | `knowledge_answers` | 6 | 49 |
| 28 | `knowledge_documents` | 18 | 11 |
| 29 | `knowledge_sections` | 9 | 47 |
| 30 | `late_checkout_notifications` | 11 | 0 |
| 31 | `lost_items` | 12 | 0 |
| 32 | `messages` | 12 | 0 |
| 33 | `pending_guest_matches` | 10 | 0 |
| 34 | `perplexity_discoveries` | 11 | 3 |
| 35 | `requests` | 28 | 0 |
| 36 | `sla_events` | 25 | 0 |
| 37 | `sla_violations` | 9 | 0 |
| 38 | `technical_staff_subcategories` | 2 | 0 |
| 39 | `technical_subcategories` | 5 | 7 |
| 40 | `verification_attempts` | 8 | 0 |

## Kolon Detayları

### `ai_intents`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO | Note:
This is a Foreign Key to `conversations.id`.<fk table='conversations' colu |
| `bot_message_id` | string (uuid) | YES | Note:
This is a Foreign Key to `bot_messages.id`.<fk table='bot_messages' column |
| `classified_department` | string (text) | YES |  |
| `confidence` | number (numeric) | YES |  |
| `reasoning` | string (text) | YES |  |
| `ai_response` | string (text) | YES |  |
| `model` | string (text) | NO |  |
| `prompt_tokens` | integer (integer) | YES |  |
| `completion_tokens` | integer (integer) | YES |  |
| `latency_ms` | integer (integer) | YES |  |
| `error` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `guest_message_id` | string (uuid) | YES |  |

### `allergic_guests`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `channel_type` | string (text) | YES |  |
| `channel_id` | string (text) | YES |  |
| `full_name` | string (text) | YES |  |
| `room_number` | string (text) | YES |  |
| `allergies` | unknown (jsonb) | NO |  |
| `notified_staff_ids` | unknown (jsonb) | YES |  |
| `notified_at` | string (timestamp with time zone) | YES |  |
| `is_active` | boolean (boolean) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `bot_messages`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO | Note:
This is a Foreign Key to `conversations.id`.<fk table='conversations' colu |
| `direction` | string (text) | NO |  |
| `text` | string (text) | YES |  |
| `message_type` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `conversation_summary`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO | Note:
This is a Foreign Key to `conversations.id`.<fk table='conversations' colu |
| `summary_text` | string (text) | NO |  |
| `message_count` | integer (integer) | NO |  |
| `last_message_id` | string (uuid) | YES |  |
| `model_used` | string (text) | YES |  |
| `tokens_used` | integer (integer) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |

### `conversations`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `guests.id`.<fk table='guests' column='id'/> |
| `channel` | string (text) | NO |  |
| `telegram_chat_id` | integer (bigint) | YES |  |
| `whatsapp_chat_id` | string (text) | YES |  |
| `instagram_thread_id` | string (text) | YES |  |
| `status` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |
| `last_intent` | string (text) | YES |  |
| `last_forwarded_at` | string (timestamp with time zone) | YES |  |
| `verified_inhouse_guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `verified_at` | string (timestamp with time zone) | YES |  |
| `verification_pending_intent` | string (text) | YES |  |
| `verification_attempts` | integer (integer) | NO |  |
| `verification_last_attempt_at` | string (timestamp with time zone) | YES |  |
| `pending_request_text` | string (text) | YES | Dogrulama akisi basladiginda saklanan orijinal misafir talebi. Dogrulama tamamla |
| `pending_intents_json` | unknown (jsonb) | YES |  |
| `inhouse_match_guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests_v2.id`.<fk table='inhouse_guests_ |
| `last_message_at` | string (timestamp with time zone) | YES |  |

### `critical_word_escalations`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `request_id` | string (uuid) | YES | Note:
This is a Foreign Key to `requests.id`.<fk table='requests' column='id'/> |
| `channel_type` | string (text) | YES |  |
| `channel_id` | string (text) | YES |  |
| `guest_message_excerpt` | string (text) | YES |  |
| `detected_words` | unknown (jsonb) | YES |  |
| `notified_at` | string (timestamp with time zone) | YES |  |
| `resolved_at` | string (timestamp with time zone) | YES |  |
| `resolution_note` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `customer_facts`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `channel_type` | string (text) | NO |  |
| `channel_id` | string (text) | NO |  |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `full_name` | string (text) | YES |  |
| `room_number` | string (text) | YES |  |
| `check_in_date` | string (date) | YES |  |
| `check_out_date` | string (date) | YES |  |
| `language` | string (text) | YES |  |
| `allergies` | unknown (jsonb) | YES |  |
| `dietary_preferences` | unknown (jsonb) | YES |  |
| `special_requests` | unknown (jsonb) | YES |  |
| `open_complaint` | string (text) | YES |  |
| `vip_status` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `last_updated_at` | string (timestamp with time zone) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `customer_facts_archive`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `original_facts_id` | string (uuid) | YES |  |
| `channel_type` | string (text) | YES |  |
| `channel_id` | string (text) | YES |  |
| `full_name` | string (text) | YES |  |
| `room_number` | string (text) | YES |  |
| `check_in_date` | string (date) | YES |  |
| `check_out_date` | string (date) | YES |  |
| `language` | string (text) | YES |  |
| `allergies` | unknown (jsonb) | YES |  |
| `dietary_preferences` | unknown (jsonb) | YES |  |
| `special_requests` | unknown (jsonb) | YES |  |
| `vip_status` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `archived_at` | string (timestamp with time zone) | YES |  |

### `department_staff`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `department_key` | string (text) | NO |  |
| `full_name` | string (text) | NO |  |
| `role_title` | string (text) | YES |  |
| `telegram_user_id` | string (text) | YES |  |
| `telegram_username` | string (text) | YES |  |
| `whatsapp_id` | string (text) | YES |  |
| `shift_start` | string (time without time zone) | YES |  |
| `shift_end` | string (time without time zone) | YES |  |
| `days_off` | array (text[]) | YES |  |
| `is_active` | boolean (boolean) | NO |  |
| `notes` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |

### `departments`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `code` | string (text) | NO |  |
| `display_name` | string (text) | NO |  |
| `is_enabled` | boolean (boolean) | YES |  |
| `sla_minutes` | integer (integer) | NO | Departmanin talep cevap verme suresi (dakika). Asilirsa resepsiyona escalation. |
| `working_hours` | unknown (jsonb) | YES |  |
| `off_hours_behavior` | string (text) | YES |  |
| `notification_channel_priority` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |
| `telegram_chat_id` | string (text) | YES |  |
| `reception_sla_minutes` | integer (integer) | NO | Resepsiyonun form doldurma suresi (dakika). Asilirsa "cevap verilmedi" auto-kayi |
| `holidays` | unknown (jsonb) | YES |  |

### `dnd_list`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `room_number` | string (text) | NO |  |
| `dnd_date` | string (date) | NO |  |
| `uploaded_by_method` | string (text) | YES |  |
| `notes` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `document_chunks`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `document_id` | string (uuid) | NO | Note:
This is a Foreign Key to `hotel_documents.id`.<fk table='hotel_documents'  |
| `chunk_index` | integer (integer) | NO |  |
| `content` | string (text) | NO |  |
| `content_tokens` | integer (integer) | YES |  |
| `embedding` | string (public.vector(1536)) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `excel_column_mapping`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `hotel_slug` | string (text) | NO |  |
| `room_number_col` | string (text) | YES |  |
| `agency_col` | string (text) | YES |  |
| `guest_name_col` | string (text) | YES |  |
| `guest_count_col` | string (text) | YES |  |
| `check_in_col` | string (text) | YES |  |
| `check_out_col` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |

### `fb_room_service_orders`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `request_id` | string (uuid) | NO | Note:
This is a Foreign Key to `requests.id`.<fk table='requests' column='id'/> |
| `items` | unknown (jsonb) | NO |  |
| `total_estimated_amount` | number (numeric) | YES |  |
| `delivered_at` | string (timestamp with time zone) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `forwarded_messages`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `ai_intent_id` | string (uuid) | YES | Note:
This is a Foreign Key to `ai_intents.id`.<fk table='ai_intents' column='id |
| `target_department` | string (text) | NO |  |
| `target_chat_id` | integer (bigint) | NO |  |
| `telegram_message_id` | integer (integer) | YES |  |
| `status` | string (text) | NO |  |
| `error` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `is_off_hours` | boolean (boolean) | NO |  |
| `source_department` | string (text) | YES |  |
| `target_type` | string (text) | YES |  |

### `guest_facts`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `guest_id` | string (uuid) | NO | Note:
This is a Foreign Key to `guests.id`.<fk table='guests' column='id'/> |
| `fact_key` | string (text) | NO | Ornek: dietary, allergy, language_pref, family_size |
| `fact_value` | string (text) | NO |  |
| `confidence` | number (numeric) | YES | 0.0-1.0: AI ne kadar emin? Verified=true ise manuel onay var. |
| `source_message_id` | string (uuid) | YES |  |
| `is_verified` | boolean (boolean) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |

### `guests`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `full_name` | string (text) | NO |  |
| `telegram_user_id` | integer (bigint) | YES |  |
| `telegram_username` | string (text) | YES |  |
| `whatsapp_id` | string (text) | YES |  |
| `instagram_id` | string (text) | YES |  |
| `language` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |

### `hotel_admin_users`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `username` | string (text) | NO |  |
| `password_hash` | string (text) | NO |  |
| `full_name` | string (text) | NO |  |
| `role` | string (text) | NO |  |
| `is_active` | boolean (boolean) | NO |  |
| `last_login_at` | string (timestamp with time zone) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |

### `hotel_audit_log`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `actor_type` | string (text) | YES |  |
| `actor_id` | string (uuid) | YES |  |
| `actor_username` | string (text) | YES |  |
| `action` | string (text) | NO |  |
| `resource_type` | string (text) | YES |  |
| `resource_id` | string (uuid) | YES |  |
| `details` | unknown (jsonb) | YES |  |
| `ip_address` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `hotel_documents`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `document_type` | string (text) | NO |  |
| `department_code` | string (text) | YES |  |
| `language` | string (text) | YES |  |
| `file_url` | string (text) | YES |  |
| `file_name` | string (text) | YES |  |
| `file_size_bytes` | integer (integer) | YES |  |
| `mime_type` | string (text) | YES |  |
| `raw_text` | string (text) | YES |  |
| `is_active` | boolean (boolean) | YES |  |
| `uploaded_by` | string (text) | YES |  |
| `uploaded_at` | string (timestamp with time zone) | YES |  |
| `parsed_at` | string (timestamp with time zone) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `delivery_policy` | string (text) | YES | Misafire iletim modu: manual_only=onburoya yonlendir, auto_file=dosyayi gonder,  |
| `display_text` | string (text) | YES | auto_text modu icin yapilandirilmis metin (orn: IBAN bilgileri alt alta) |
| `structured_data` | unknown (jsonb) | YES | auto_text modunda yapisal veri (IBAN: hesap listesi; menu: kalemler; vb.) |
| `ai_auto_send` | boolean (boolean) | YES | true=AI otomatik gonderir, false=AI bu belgeden bahsetmez/onburoya yonlendirir |

### `hotel_facts`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `fact_key` | string (text) | NO |  |
| `fact_value` | string (text) | NO |  |
| `fact_label` | string (text) | NO |  |
| `category` | string (text) | NO |  |
| `is_active` | boolean (boolean) | NO |  |
| `display_order` | integer (integer) | NO |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |

### `hotel_settings`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `hotel_name` | string (text) | NO |  |
| `contact_phone` | string (text) | YES |  |
| `contact_email` | string (text) | YES |  |
| `address` | string (text) | YES |  |
| `google_maps_url` | string (text) | YES |  |
| `general_rules` | string (text) | YES |  |
| `extra_info` | string (text) | YES |  |
| `check_in_time` | string (time without time zone) | YES |  |
| `check_out_time` | string (time without time zone) | YES |  |
| `default_language` | string (text) | YES |  |
| `supported_languages` | unknown (jsonb) | YES |  |
| `wifi_info` | unknown (jsonb) | YES |  |
| `iban_info` | unknown (jsonb) | YES |  |
| `reservation_links` | unknown (jsonb) | YES |  |
| `agency_links` | unknown (jsonb) | YES |  |
| `taxi_info` | unknown (jsonb) | YES |  |
| `exchange_office_info` | unknown (jsonb) | YES |  |
| `atm_locations` | unknown (jsonb) | YES |  |
| `bus_stop_info` | unknown (jsonb) | YES |  |
| `bazaar_info` | unknown (jsonb) | YES |  |
| `doctor_office_info` | unknown (jsonb) | YES |  |
| `ramazan_info` | unknown (jsonb) | YES |  |
| `directions_text` | string (text) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |
| `concept_type` | string (text) | YES |  |
| `location_info` | unknown (jsonb) | YES | Otel konum/ulasim bilgisi yapisal JSON: { maps_link, general_directions, details |
| `nearby_places` | unknown (jsonb) | YES | Otel cevresindeki mekanlar. Kategori bazli: { markets: [...], restaurants: [...] |

### `inhouse_archive`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `original_guest_id` | string (uuid) | YES |  |
| `room_number` | string (text) | YES |  |
| `full_name` | string (text) | NO |  |
| `agency` | string (text) | YES |  |
| `pax` | integer (integer) | YES |  |
| `check_in_date` | string (date) | YES |  |
| `check_out_date` | string (date) | YES |  |
| `language` | string (text) | YES |  |
| `vip_status` | string (text) | YES |  |
| `archived_at` | string (timestamp with time zone) | YES |  |
| `archive_reason` | string (text) | YES |  |

### `inhouse_guests`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `room_number` | string (text) | NO |  |
| `full_name` | string (text) | NO |  |
| `agency` | string (text) | YES |  |
| `voucher` | string (text) | YES |  |
| `pax` | integer (integer) | YES |  |
| `check_in_date` | string (date) | NO |  |
| `check_out_date` | string (date) | NO |  |
| `channel_ids` | unknown (jsonb) | YES |  |
| `language` | string (text) | YES |  |
| `vip_status` | string (text) | YES |  |
| `uploaded_at` | string (timestamp with time zone) | YES |  |
| `is_active` | boolean (boolean) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `phone` | string (text) | YES |  |
| `email` | string (text) | YES |  |
| `notes` | string (text) | YES |  |
| `package` | string (text) | YES |  |
| `last_name` | string (text) | YES |  |
| `first_name` | string (text) | YES |  |
| `gender` | string (text) | YES | Misafir cinsiyeti — salutation üretmek için (male/female/NULL) |

### `inhouse_guests_v2`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `room_number` | string (text) | NO |  |
| `agency` | string (text) | YES |  |
| `guest_name` | string (text) | NO |  |
| `guest_count` | integer (integer) | YES |  |
| `check_in_date` | string (date) | NO |  |
| `check_out_date` | string (date) | NO |  |
| `status` | string (text) | NO |  |
| `upload_batch_id` | string (uuid) | YES |  |
| `archived_at` | string (timestamp with time zone) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |
| `telegram_id` | string (text) | YES |  |
| `whatsapp_id` | string (text) | YES |  |

### `inhouse_upload_history`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `batch_id` | string (uuid) | NO |  |
| `hotel_slug` | string (text) | NO |  |
| `uploaded_by` | string (text) | YES |  |
| `file_name` | string (text) | YES |  |
| `inserted_count` | integer (integer) | YES |  |
| `updated_count` | integer (integer) | YES |  |
| `archived_count` | integer (integer) | YES |  |
| `total_rows` | integer (integer) | YES |  |
| `status` | string (text) | YES |  |
| `error_detail` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `knowledge_answers`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO |  |
| `predicted_intent` | string (text) | YES |  |
| `question_text` | string (text) | NO |  |
| `answer_text` | string (text) | NO |  |
| `created_at` | string (timestamp with time zone) | NO |  |

### `knowledge_documents`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `department_key` | string (text) | NO |  |
| `document_type` | string (text) | NO |  |
| `title` | string (text) | NO |  |
| `file_name` | string (text) | NO |  |
| `file_path` | string (text) | NO |  |
| `file_size_bytes` | integer (integer) | YES |  |
| `mime_type` | string (text) | YES |  |
| `uploaded_by_user_id` | string (uuid) | YES |  |
| `uploaded_at` | string (timestamp with time zone) | NO |  |
| `parsed_content` | string (text) | YES |  |
| `parse_status` | string (text) | NO |  |
| `parse_error` | string (text) | YES |  |
| `is_active` | boolean (boolean) | NO |  |
| `version` | integer (integer) | NO |  |
| `notes` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |

### `knowledge_sections`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `title` | string (text) | NO |  |
| `content` | string (text) | NO |  |
| `category` | string (text) | YES |  |
| `is_active` | boolean (boolean) | NO |  |
| `display_order` | integer (integer) | NO |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |
| `source_document_id` | string (uuid) | YES |  |

### `late_checkout_notifications`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `inhouse_guest_id` | string (uuid) | NO | Note:
This is a Foreign Key to `inhouse_guests_v2.id`.<fk table='inhouse_guests_ |
| `notification_date` | string (date) | NO |  |
| `channel` | string (text) | NO |  |
| `message_content` | string (text) | YES |  |
| `status` | string (text) | NO |  |
| `error_message` | string (text) | YES |  |
| `sent_at` | string (timestamp with time zone) | YES |  |
| `sent_by_user_id` | string (uuid) | YES |  |
| `sent_by_username` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `lost_items`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `room_number` | string (text) | YES |  |
| `full_name` | string (text) | YES |  |
| `check_in_date` | string (date) | YES |  |
| `check_out_date` | string (date) | YES |  |
| `item_description` | string (text) | NO |  |
| `guest_notes` | string (text) | YES |  |
| `status` | string (text) | YES |  |
| `staff_notes` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `updated_at` | string (timestamp with time zone) | YES |  |

### `messages`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `channel_type` | string (text) | NO |  |
| `channel_id` | string (text) | NO |  |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `direction` | string (text) | NO |  |
| `message_type` | string (text) | YES |  |
| `content` | string (text) | YES |  |
| `media_url` | string (text) | YES |  |
| `language` | string (text) | YES |  |
| `intent` | string (text) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `pending_guest_matches`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `telegram_id` | integer (bigint) | YES |  |
| `whatsapp_id` | string (text) | YES |  |
| `platform` | string (text) | NO |  |
| `attempted_room_number` | string (text) | YES |  |
| `message_excerpt` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `resolved` | boolean (boolean) | NO |  |
| `resolved_at` | string (timestamp with time zone) | YES |  |
| `resolved_by_user_id` | string (text) | YES |  |

### `perplexity_discoveries`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `interest_tag` | string (text) | NO | Sorgu kategorisi: restaurant, pharmacy, museum, transport, atm, shopping vb. |
| `query_text` | string (text) | NO |  |
| `results` | unknown (jsonb) | YES | Yapilandirilmis sonuc listesi: [{name, address, distance, rating, description}] |
| `raw_response` | string (text) | YES |  |
| `sources` | unknown (jsonb) | YES | Perplexity citation URL listesi |
| `model_used` | string (text) | YES |  |
| `tokens_used` | integer (integer) | YES |  |
| `is_pinned` | boolean (boolean) | YES | true = expires_at gelse bile silinmez (manager onayladi) |
| `created_at` | string (timestamp with time zone) | YES |  |
| `expires_at` | string (timestamp with time zone) | YES | 7 gun sonra otomatik expire; pinned olmayanlar cron ile silinir |

### `requests`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `ticket_number` | string (text) | YES |  |
| `channel_type` | string (text) | YES |  |
| `channel_id` | string (text) | YES |  |
| `guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `room_number` | string (text) | YES |  |
| `full_name` | string (text) | YES |  |
| `request_text` | string (text) | NO |  |
| `request_text_tr` | string (text) | YES |  |
| `language` | string (text) | YES |  |
| `intent` | string (text) | YES |  |
| `department_id` | string (uuid) | YES | Note:
This is a Foreign Key to `departments.id`.<fk table='departments' column=' |
| `subcategory_id` | string (uuid) | YES | Note:
This is a Foreign Key to `technical_subcategories.id`.<fk table='technical |
| `assigned_staff_id` | string (uuid) | YES |  |
| `image_urls` | unknown (jsonb) | YES |  |
| `voice_url` | string (text) | YES |  |
| `status` | string (text) | YES |  |
| `priority` | string (text) | YES |  |
| `is_emergency` | boolean (boolean) | YES |  |
| `is_off_hours` | boolean (boolean) | YES |  |
| `escalated_to_reception` | boolean (boolean) | YES |  |
| `reception_note` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `acknowledged_at` | string (timestamp with time zone) | YES |  |
| `resolved_at` | string (timestamp with time zone) | YES |  |
| `resolution_minutes` | integer (integer) | YES |  |
| `sla_breached` | boolean (boolean) | YES |  |
| `metadata` | unknown (jsonb) | YES |  |

### `sla_events`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO | Note:
This is a Foreign Key to `conversations.id`.<fk table='conversations' colu |
| `inhouse_guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `department_code` | string (text) | NO |  |
| `department_chat_id` | string (text) | NO |  |
| `department_message_id` | integer (bigint) | YES |  |
| `request_text` | string (text) | NO |  |
| `room_number` | string (text) | YES |  |
| `guest_full_name` | string (text) | YES |  |
| `forwarded_at` | string (timestamp with time zone) | NO |  |
| `sla_deadline` | string (timestamp with time zone) | NO |  |
| `responded_at` | string (timestamp with time zone) | YES |  |
| `response_type` | string (text) | YES |  |
| `responder_telegram_id` | string (text) | YES |  |
| `responder_username` | string (text) | YES |  |
| `escalated_at` | string (timestamp with time zone) | YES |  |
| `escalation_message_id` | integer (bigint) | YES |  |
| `reception_sla_deadline` | string (timestamp with time zone) | YES |  |
| `reception_responded_at` | string (timestamp with time zone) | YES |  |
| `reception_response_text` | string (text) | YES |  |
| `reception_responder_telegram_id` | string (text) | YES |  |
| `final_status` | string (text) | YES |  |
| `closed_at` | string (timestamp with time zone) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |
| `updated_at` | string (timestamp with time zone) | NO |  |

### `sla_violations`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `request_id` | string (uuid) | NO | Note:
This is a Foreign Key to `requests.id`.<fk table='requests' column='id'/> |
| `department_id` | string (uuid) | YES | Note:
This is a Foreign Key to `departments.id`.<fk table='departments' column=' |
| `expected_response_minutes` | integer (integer) | YES |  |
| `actual_response_minutes` | integer (integer) | YES |  |
| `reception_acknowledged_by` | string (text) | YES |  |
| `reception_explanation` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |
| `resolved_at` | string (timestamp with time zone) | YES |  |

### `technical_staff_subcategories`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `staff_id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `subcategory_id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/>
This is a Foreign Key to `technical_subcategor |

### `technical_subcategories`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `code` | string (text) | NO |  |
| `display_name` | string (text) | NO |  |
| `is_emergency` | boolean (boolean) | YES |  |
| `created_at` | string (timestamp with time zone) | YES |  |

### `verification_attempts`

| Kolon | Veri Tipi | Nullable | Açıklama |
|-------|-----------|----------|----------|
| `id` | string (uuid) | NO | Note:
This is a Primary Key.<pk/> |
| `conversation_id` | string (uuid) | NO | Note:
This is a Foreign Key to `conversations.id`.<fk table='conversations' colu |
| `attempted_room_no` | string (text) | YES |  |
| `attempted_last_name` | string (text) | YES |  |
| `result` | string (text) | NO |  |
| `matched_guest_id` | string (uuid) | YES | Note:
This is a Foreign Key to `inhouse_guests.id`.<fk table='inhouse_guests' co |
| `intent_at_attempt` | string (text) | YES |  |
| `created_at` | string (timestamp with time zone) | NO |  |

## Index Bilgileri

> **Not:** PostgREST REST API aracılığıyla pg_indexes tablosuna doğrudan erişim mümkün değildir. Aşağıda her tablonun primary key ve bilinen index'leri OpenAPI spec'ten çıkarılmıştır.

| Tablo | Index Adı | Tip |
|-------|-----------|-----|
| `ai_intents` | `ai_intents_pkey` | PRIMARY KEY (`id`) |
| `allergic_guests` | `allergic_guests_pkey` | PRIMARY KEY (`id`) |
| `bot_messages` | `bot_messages_pkey` | PRIMARY KEY (`id`) |
| `conversation_summary` | `conversation_summary_pkey` | PRIMARY KEY (`id`) |
| `conversations` | `conversations_pkey` | PRIMARY KEY (`id`) |
| `critical_word_escalations` | `critical_word_escalations_pkey` | PRIMARY KEY (`id`) |
| `customer_facts` | `customer_facts_pkey` | PRIMARY KEY (`id`) |
| `customer_facts_archive` | `customer_facts_archive_pkey` | PRIMARY KEY (`id`) |
| `department_staff` | `department_staff_pkey` | PRIMARY KEY (`id`) |
| `departments` | `departments_pkey` | PRIMARY KEY (`id`) |
| `dnd_list` | `dnd_list_pkey` | PRIMARY KEY (`id`) |
| `document_chunks` | `document_chunks_pkey` | PRIMARY KEY (`id`) |
| `excel_column_mapping` | `excel_column_mapping_pkey` | PRIMARY KEY (`id`) |
| `fb_room_service_orders` | `fb_room_service_orders_pkey` | PRIMARY KEY (`id`) |
| `forwarded_messages` | `forwarded_messages_pkey` | PRIMARY KEY (`id`) |
| `guest_facts` | `guest_facts_pkey` | PRIMARY KEY (`id`) |
| `guests` | `guests_pkey` | PRIMARY KEY (`id`) |
| `hotel_admin_users` | `hotel_admin_users_pkey` | PRIMARY KEY (`id`) |
| `hotel_audit_log` | `hotel_audit_log_pkey` | PRIMARY KEY (`id`) |
| `hotel_documents` | `hotel_documents_pkey` | PRIMARY KEY (`id`) |
| `hotel_facts` | `hotel_facts_pkey` | PRIMARY KEY (`id`) |
| `hotel_settings` | `hotel_settings_pkey` | PRIMARY KEY (`id`) |
| `inhouse_archive` | `inhouse_archive_pkey` | PRIMARY KEY (`id`) |
| `inhouse_guests` | `inhouse_guests_pkey` | PRIMARY KEY (`id`) |
| `inhouse_guests_v2` | `inhouse_guests_v2_pkey` | PRIMARY KEY (`id`) |
| `inhouse_upload_history` | `inhouse_upload_history_pkey` | PRIMARY KEY (`id`) |
| `knowledge_answers` | `knowledge_answers_pkey` | PRIMARY KEY (`id`) |
| `knowledge_documents` | `knowledge_documents_pkey` | PRIMARY KEY (`id`) |
| `knowledge_sections` | `knowledge_sections_pkey` | PRIMARY KEY (`id`) |
| `late_checkout_notifications` | `late_checkout_notifications_pkey` | PRIMARY KEY (`id`) |
| `lost_items` | `lost_items_pkey` | PRIMARY KEY (`id`) |
| `messages` | `messages_pkey` | PRIMARY KEY (`id`) |
| `pending_guest_matches` | `pending_guest_matches_pkey` | PRIMARY KEY (`id`) |
| `perplexity_discoveries` | `perplexity_discoveries_pkey` | PRIMARY KEY (`id`) |
| `requests` | `requests_pkey` | PRIMARY KEY (`id`) |
| `sla_events` | `sla_events_pkey` | PRIMARY KEY (`id`) |
| `sla_violations` | `sla_violations_pkey` | PRIMARY KEY (`id`) |
| `technical_staff_subcategories` | `technical_staff_subcategories_pkey` | PRIMARY KEY (`staff_id`) |
| `technical_subcategories` | `technical_subcategories_pkey` | PRIMARY KEY (`id`) |
| `verification_attempts` | `verification_attempts_pkey` | PRIMARY KEY (`id`) |

## Foreign Key İlişkileri

> **Not:** Kolon description alanındaki 'fkey' etiketlerinden tespit edilmiştir.

| Tablo | Kolon | → Referans Tablo | → Kolon | Güven |
|-------|-------|-----------------|---------|-------|
| `ai_intents` | `conversation_id` | `conversations` | `id` | MEDIUM |
| `ai_intents` | `bot_message_id` | `bot_messages` | `id` | MEDIUM |
| `allergic_guests` | `guest_id` | `guests` | `id` | MEDIUM |
| `bot_messages` | `conversation_id` | `conversations` | `id` | MEDIUM |
| `conversation_summary` | `conversation_id` | `conversations` | `id` | MEDIUM |
| `conversations` | `guest_id` | `guests` | `id` | MEDIUM |
| `critical_word_escalations` | `request_id` | `requests` | `id` | MEDIUM |
| `customer_facts` | `guest_id` | `guests` | `id` | MEDIUM |
| `fb_room_service_orders` | `request_id` | `requests` | `id` | MEDIUM |
| `forwarded_messages` | `ai_intent_id` | `ai_intents` | `id` | MEDIUM |
| `guest_facts` | `guest_id` | `guests` | `id` | MEDIUM |
| `knowledge_answers` | `conversation_id` | `conversations` | `id` | MEDIUM |
| `late_checkout_notifications` | `inhouse_guest_id` | `inhouse_guests` | `id` | MEDIUM |
| `lost_items` | `guest_id` | `guests` | `id` | MEDIUM |
| `messages` | `guest_id` | `guests` | `id` | MEDIUM |
| `requests` | `guest_id` | `guests` | `id` | MEDIUM |
| `requests` | `department_id` | `departments` | `id` | MEDIUM |
| `sla_events` | `conversation_id` | `conversations` | `id` | MEDIUM |
| `sla_events` | `inhouse_guest_id` | `inhouse_guests` | `id` | MEDIUM |
| `sla_violations` | `request_id` | `requests` | `id` | MEDIUM |
| `sla_violations` | `department_id` | `departments` | `id` | MEDIUM |
| `verification_attempts` | `conversation_id` | `conversations` | `id` | MEDIUM |

## Özet İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Tablo | 40 |
| Toplam Kolon | 490 |
| Tahmin FK İlişkisi | 22 |
| Boş Tablolar (0 kayıt) | 23 |
| Boş Tablo Listesi | `ai_intents`, `allergic_guests`, `bot_messages`, `conversation_summary`, `conversations`, `critical_word_escalations`, `customer_facts`, `customer_facts_archive`, `dnd_list`, `document_chunks`, `fb_room_service_orders`, `guest_facts`, `hotel_audit_log`, `inhouse_archive`, `late_checkout_notifications`, `lost_items`, `messages`, `pending_guest_matches`, `requests`, `sla_events`, `sla_violations`, `technical_staff_subcategories`, `verification_attempts` |
