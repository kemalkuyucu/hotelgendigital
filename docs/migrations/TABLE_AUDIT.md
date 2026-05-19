# TABLE AUDIT — Modül 17.6 Adım 2.1

**Audit Tarihi:** 2026-05-19  
**Yöntem:** `src/` içinde `.from('table_name')` pattern grep  
**Schema Kaynağı:** `docs/migrations/demo-hotel-current-schema.md`

---

| # | Tablo | Kayıt Sayısı | Codebase Referans | Karar |
|---|-------|-------------|-------------------|-------|
| 1 | `ai_intents` | 0 | 2 yerde (route.ts, handle-rapor.ts) | ACTIVE_EMPTY → migration'a dahil |
| 2 | `allergic_guests` | 0 | 0 yerde | UNCERTAIN → migration'a dahil, eski inhouse_guests FK'ı var |
| 3 | `bot_messages` | 0 | 9 yerde (route.ts, handle-rapor, handle-son-mesajlar) | ACTIVE_EMPTY → migration'a dahil |
| 4 | `conversation_summary` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (gelecek kullanım) |
| 5 | `conversations` | 0 | 14 yerde (route.ts, handle-aktif-konusmalar, handle-callback) | ACTIVE_EMPTY → migration'a dahil |
| 6 | `critical_word_escalations` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (güvenlik kaydı) |
| 7 | `customer_facts` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (müşteri profili için tasarlanmış) |
| 8 | `customer_facts_archive` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 9 | `department_staff` | 1 | 11 yerde (staff-client.ts, route'lar) | ACTIVE → migration'a dahil |
| 10 | `departments` | 7 | 13 yerde (route.ts, sla, health-check, dashboard) | ACTIVE → migration'a dahil |
| 11 | `dnd_list` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 12 | `document_chunks` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (knowledge sistemi için tasarlanmış) |
| 13 | `excel_column_mapping` | 1 | 2 yerde (parse-excel, import route) | ACTIVE → migration'a dahil |
| 14 | `fb_room_service_orders` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 15 | `forwarded_messages` | 102 | 8 yerde (forward-to-department, handle-rapor, route) | ACTIVE → migration'a dahil |
| 16 | `guest_facts` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 17 | `guests` | 1 | 2 yerde (route.ts) | ACTIVE → migration'a dahil |
| 18 | `hotel_admin_users` | 8 | 7 yerde (auth.ts, route'lar) | ACTIVE → migration'a dahil |
| 19 | `hotel_audit_log` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (audit/compliance) |
| 20 | `hotel_documents` | 3 | 8 yerde (send-document, hotel-context, manager route'lar) | ACTIVE → migration'a dahil |
| 21 | `hotel_facts` | 12 | 10 yerde (knowledge-client, hotel-context, manager route'lar) | ACTIVE → migration'a dahil |
| 22 | `hotel_settings` | 1 | 8 yerde (hotel-context, manager route'lar, perplexity) | ACTIVE → migration'a dahil |
| 23 | `inhouse_archive` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (arşivleme için tasarlanmış) |
| 24 | `inhouse_guests` | 3 | 12 yerde (route.ts, guests page, verify-guest, archive-cron) | ACTIVE → 005'te dahil; 007_drop'ta kaldırılmayacak (hâlâ kullanılıyor) |
| 25 | `inhouse_guests_v2` | 20 | 13 yerde (route.ts, front-office, import, manychat) | ACTIVE → migration'a dahil |
| 26 | `inhouse_upload_history` | 7 | 4 yerde (front-office, history, import route) | ACTIVE → migration'a dahil |
| 27 | `knowledge_answers` | 49 | 2 yerde (handle-rapor, route.ts) | ACTIVE → migration'a dahil |
| 28 | `knowledge_documents` | 11 | 7 yerde (document-client.ts) | ACTIVE → migration'a dahil |
| 29 | `knowledge_sections` | 47 | 8 yerde (knowledge-client, document-client, process/reparse route) | ACTIVE → migration'a dahil |
| 30 | `late_checkout_notifications` | 0 | 8 yerde (send-checkout-notifications, list route) | ACTIVE_EMPTY → migration'a dahil |
| 31 | `lost_items` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 32 | `messages` | 0 | 0 yerde | DEPRECATED → 007_drop'a (bot_messages ile mükerrer, 0 referans) |
| 33 | `pending_guest_matches` | 0 | 5 yerde (manychat, telegram, pending-matches route) | ACTIVE_EMPTY → migration'a dahil |
| 34 | `perplexity_discoveries` | 3 | 6 yerde (hotel-context, manager route'lar) | ACTIVE → migration'a dahil |
| 35 | `requests` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (ileride kullanılacak) |
| 36 | `sla_events` | 0 | 10 yerde (handle-reception-reply, check-runner, handle-callback, route) | ACTIVE_EMPTY → migration'a dahil |
| 37 | `sla_violations` | 0 | 0 yerde | UNCERTAIN → migration'a dahil (SLA sistemi tamamlandığında) |
| 38 | `technical_staff_subcategories` | 0 | 0 yerde | UNCERTAIN → migration'a dahil |
| 39 | `technical_subcategories` | 7 | 0 yerde (tip tanımlarında var olabilir) | UNCERTAIN → migration'a dahil |
| 40 | `verification_attempts` | 0 | 1 yerde (route.ts) | ACTIVE_EMPTY → migration'a dahil |

---

## Özet

| Karar | Tablo Sayısı |
|-------|-------------|
| ACTIVE | 13 |
| ACTIVE_EMPTY | 9 |
| UNCERTAIN | 17 |
| DEPRECATED | 1 (`messages`) |

## DEPRECATED Tablolar (007_drop'a)

- `messages` — 0 kayıt, 0 kod referansı, `bot_messages` ile tamamen mükerrer işlev

## Notlar

- `inhouse_guests` (eski): Hâlâ aktif referansları var (12 yer). **Silinmeyecek.** Ancak yeni veri `inhouse_guests_v2`'ye gidiyor. 001_initial_schema'ya dahil edilecek.
- `hotel_admin_users`: Tenant DB'de yaşıyor, 001'e dahil.
- `knowledge_documents`, `knowledge_sections`, `knowledge_answers`: Tenant DB'de yaşıyor, 001'e dahil.
- `document_chunks`: Schema'da var ama `hotel_documents` FK'ı bağlı. UNCERTAIN ama dahil.
- `technical_subcategories` / `technical_staff_subcategories`: 0 kod referansı; muhtemelen SLA alt-kategori sistemi için hazırlanmış.
