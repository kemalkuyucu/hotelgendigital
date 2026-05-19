# Tenant Migration System — Modül 17.6 Planı

**Son Güncelleme:** 2026-05-19 (Adım 3 tamamlandı)

## Hedef

Her tenant (otel) Supabase DB'sinde versiyonlu, idempotent migration takibi.
Yeni otel kaydolunca tüm migration'lar otomatik uygulanır. Schema drift sıfır.

---

## Bileşenler

| # | Bileşen | Durum |
|---|---------|-------|
| 1 | `migrations/tenant/NNN_description.sql` — versiyonlu, idempotent SQL dosyaları | ✅ Tamamlandı (Adım 2) |
| 2 | `schema_migrations` tablosu — her tenant DB'de uygulanan version'ları takip | ✅ Tamamlandı (Adım 2) |
| 3 | `src/lib/migrations/` — runner core TypeScript | ✅ Tamamlandı (Adım 2) |
| 4 | `/api/admin/migrations/run` — manuel çalıştırma endpoint'i | ✅ Tamamlandı (Adım 3) |
| 5 | `/api/admin/migrations/status` — durum endpoint'i | ✅ Tamamlandı (Adım 3) |
| 6 | `/admin/migrations` sayfası — tüm otellerin durumu + "Uygula" butonu | ✅ Tamamlandı (Adım 3) |
| 7 | `migrations/tenant/000_bootstrap.sql` — exec_sql RPC fonksiyonu | ✅ Tamamlandı (Adım 3) |
| 8 | `src/lib/migrations/seedBaseline.ts` — baseline seed | ✅ Tamamlandı (Adım 3) |
| 9 | Demo Hotel baseline seed uygulandı (6/6) | ✅ Tamamlandı (Adım 3) |
| 10 | Otel ekleme flow entegrasyonu — yeni otel kaydolunca otomatik run | ⚠️ TODO (aşağıya bak) |

---

## ONBOARDING TODO

**Durum:** Sonraki modüle bırakıldı. Kod değişikliği yapılmadı.

### Sorun

`createHotelAction` (`src/app/admin/actions/hotels.ts`) otel oluştururken
`bridge_credentials` tablosuna **boş** bir kayıt ekler (`is_healthy: false`).
Bu noktada Supabase URL, service_role key gibi credentials henüz girilmemiştir.

`runBootstrap` ve `seedBaseline` fonksiyonları `getDecryptedBridge()` ile
şifrelenmiş credentials'a ihtiyaç duyar. Credentials olmadan migration çalıştırılamaz.

### Önerilen Çözüm (Sonraki Modül)

1. Otel ekleme formu **Supabase credentials** adımını içermeli (URL + keys).
2. `createHotelAction`:
   - Otel kaydını insert et
   - Credentials'ı şifrele + `bridge_credentials`'a yaz
   - `runBootstrap({ hotelSlug })` → exec_sql oluştur
   - `seedBaseline({ hotelSlug })` → boş DB için migration seed
   - Hata olursa: `hotels.status = 'setup_failed'` işaretle
3. Kullanıcıya göster: "Otel oluşturuldu. 6 veritabanı güncellemesi uygulandı."

### Geçici Çözüm (Şu an)

Yeni otel eklenince admin, `/admin/migrations` sayfasından oteli bulup
"Güncelle" butonuna basabilir (credentials eklendikten sonra).

---


## Migration Dosya Listesi (Adım 2 sonrası final)

| Dosya | İçerik | Durum |
|-------|--------|-------|
| `001_initial_schema.sql` | guests, conversations (last_message_at dahil), bot_messages, hotel_settings, hotel_facts, hotel_documents, document_chunks, departments, department_staff, hotel_admin_users, hotel_audit_log, ai_intents, forwarded_messages, customer_facts, customer_facts_archive, dnd_list, technical_subcategories, technical_staff_subcategories, requests, sla_violations, critical_word_escalations, fb_room_service_orders, conversation_summary, guest_facts, inhouse_guests (v1), allergic_guests, lost_items, inhouse_archive, verification_attempts, knowledge_answers, knowledge_documents, knowledge_sections | ✅ |
| `002_perplexity.sql` | perplexity_discoveries (Modül 14.b) | ✅ |
| `003_sla_events.sql` | sla_events (Modül 16.a) | ✅ |
| `004_module15_iban.sql` | hotel_documents IBAN kolonları, delivery_policy constraint (Modül 15) | ✅ |
| `005_module17_inhouse.sql` | inhouse_guests_v2, excel_column_mapping, inhouse_upload_history; inhouse_guests v1 gender kolonu (Modül 17.a) | ✅ |
| `006_module17_notifications.sql` | late_checkout_notifications, pending_guest_matches; conversations.inhouse_match_guest_id + verification_* + last_message_at (Modül 17.b/c/d) | ✅ |
| `007_drop_deprecated.sql` | DROP TABLE messages — **RUNNER'DA VARSAYILAN OLARAK ÇALIŞMAZ** (includeDestructive: true flag gerekir) | ✅ |

---

## İdempotency Kuralları (Tüm Dosyalar)

- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE TYPE ...` → `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;`
- `INSERT ... ON CONFLICT DO NOTHING`
- Her dosya `BEGIN; ... COMMIT;` sarmalı

---

## Runner API Örnekleri

```typescript
import { runMigrations, getMigrationStatus } from '@/lib/migrations';

// Tüm migration'ları çalıştır (007 hariç)
const result = await runMigrations({
  hotelSlug: 'demo-hotel',
  dryRun: false,
  includeDestructive: false,
  appliedBy: 'admin-panel',
});
// result: { hotel_slug, applied[], skipped[], failed?, total_ms }

// Durumu görüntüle
const status = await getMigrationStatus('demo-hotel');
// status: { hotel_slug, total_available, applied[], pending[], last_error? }

// Dry-run (SQL'i sadece loglar, çalıştırmaz)
const dryResult = await runMigrations({
  hotelSlug: 'demo-hotel',
  dryRun: true,
});

// Destructive migration dahil et (sadece planlı bakım penceresinde)
const destructiveResult = await runMigrations({
  hotelSlug: 'demo-hotel',
  includeDestructive: true,
  appliedBy: 'maintenance-2026-05-20',
});
```

---

## Adım 3'te Yapılacaklar

### API Endpoint'leri

#### `/api/admin/migrations/run` (POST)
```typescript
// Body: { hotelSlug: string; dryRun?: boolean; includeDestructive?: boolean }
// Response: RunResult
```

#### `/api/admin/migrations/status` (GET)
```typescript
// Query: ?hotelSlug=demo-hotel
// Response: MigrationStatusReport
```

### UI Sayfası: `/admin/migrations`

- Tüm otellerin migration durumunu listele (tablo)
- Her otel için: `applied` / `pending` / `last_error` göster
- "Dry Run" ve "Uygula" butonları
- 007_drop için ayrı onay modalı

### Otel Ekleme Flow Entegrasyonu

Yeni otel eklendiğinde (Central DB `hotels` tablosuna insert sonrası):
```typescript
await runMigrations({
  hotelSlug: newHotel.slug,
  appliedBy: `onboarding:${adminUsername}`,
});
```

### Demo Hotel Baseline Seed

Demo Hotel'deki tablolar zaten mevcut olduğu için `schema_migrations`'a
001–006 versiyonlarını `applied=true, success=true` ile seed et:

```sql
INSERT INTO schema_migrations (version, name, applied_by, success, duration_ms)
VALUES
  ('001', 'initial_schema', 'baseline-seed', true, 0),
  ('002', 'perplexity', 'baseline-seed', true, 0),
  ('003', 'sla_events', 'baseline-seed', true, 0),
  ('004', 'module15_iban', 'baseline-seed', true, 0),
  ('005', 'module17_inhouse', 'baseline-seed', true, 0),
  ('006', 'module17_notifications', 'baseline-seed', true, 0)
ON CONFLICT (version) DO NOTHING;
```

---

## Tablo Audit Özeti (Adım 2.1)

Tüm detaylar: `docs/migrations/TABLE_AUDIT.md`

| Karar | Sayı |
|-------|------|
| ACTIVE | 13 |
| ACTIVE_EMPTY | 9 |
| UNCERTAIN (migration'a dahil) | 17 |
| DEPRECATED (007_drop'ta) | 1 (`messages`) |
