# MODÜL 7 — Knowledge Base / Konsept Bilgisi

**Önceki tag:** `v1.0-module6.1`
**Bu modül tagı:** `v1.0-module7`
**Hedef:** Misafirin bilgi sorularına AI uydurmadan, otelin Supabase'inde saklanan konsept verisinden cevap versin. Bilgi yoksa front_office'e forward etsin.

---

## 0. Özet kararlar

- Tek modülde hem altyapı hem master admin tarafı (Modül 7 = sadece otel-geneli konsept)
- Departman panelleri Modül 8'e
- Veri formatı: hibrit (yapılandırılmış facts + serbest metin sections)
- Sezonluk versiyonlama yok (şimdilik tek aktif versiyon)
- Arama: keyword + structured field lookup + ILIKE (embedding Modül 11'e bırakıldı)
- Konsept yoksa fallback: front_office
- Yetki: sadece master admin

---

## 1. Veri modeli

**Lokasyon:** Demo Hotel Supabase (her tenant kendi DB'sinde tutar). Migration dosyaları `supabase/migrations/hotel/` altına eklenecek.

### 1.1 Migration: `supabase/migrations/hotel/20260508_001_knowledge.sql`

```sql
-- ============================================================
-- MODÜL 7: Knowledge Base — hotel_facts + knowledge_sections
-- ============================================================

CREATE TABLE IF NOT EXISTS hotel_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key TEXT NOT NULL UNIQUE,
  fact_value TEXT NOT NULL,
  fact_label TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hotel_facts_category_check CHECK (
    category IN ('general','pool','restaurant','spa','rooms','beach','wifi','contact','other')
  )
);

CREATE INDEX IF NOT EXISTS hotel_facts_category_idx ON hotel_facts(category);
CREATE INDEX IF NOT EXISTS hotel_facts_is_active_idx ON hotel_facts(is_active);

CREATE TABLE IF NOT EXISTS knowledge_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sections_is_active_idx ON knowledge_sections(is_active);
CREATE INDEX IF NOT EXISTS knowledge_sections_content_search_idx
  ON knowledge_sections USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')));

-- updated_at trigger
CREATE OR REPLACE FUNCTION knowledge_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hotel_facts_set_updated_at ON hotel_facts;
CREATE TRIGGER hotel_facts_set_updated_at
  BEFORE UPDATE ON hotel_facts
  FOR EACH ROW EXECUTE FUNCTION knowledge_set_updated_at();

DROP TRIGGER IF EXISTS knowledge_sections_set_updated_at ON knowledge_sections;
CREATE TRIGGER knowledge_sections_set_updated_at
  BEFORE UPDATE ON knowledge_sections
  FOR EACH ROW EXECUTE FUNCTION knowledge_set_updated_at();
```

**Migration sonrası doğrulama (zorunlu):**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('hotel_facts','knowledge_sections')
ORDER BY table_name, ordinal_position;
```
Sonuç beklenen: 9 kolon hotel_facts, 8 kolon knowledge_sections.

### 1.2 Predefined fact_key listesi

Admin panelinde dropdown olarak gösterilecek hazır anahtarlar. Kullanıcı bunlardan birini seçer veya kendi key'ini yazar.

`src/lib/knowledge/predefined-facts.ts`:

```ts
export const PREDEFINED_FACTS = [
  // pool
  { key: 'pool_open_time', label: 'Havuz Açılış Saati', category: 'pool' },
  { key: 'pool_close_time', label: 'Havuz Kapanış Saati', category: 'pool' },
  { key: 'pool_kids_open_time', label: 'Çocuk Havuzu Açılış', category: 'pool' },
  { key: 'pool_kids_close_time', label: 'Çocuk Havuzu Kapanış', category: 'pool' },
  // restaurant
  { key: 'restaurant_breakfast_start', label: 'Kahvaltı Başlangıç', category: 'restaurant' },
  { key: 'restaurant_breakfast_end', label: 'Kahvaltı Bitiş', category: 'restaurant' },
  { key: 'restaurant_lunch_start', label: 'Öğle Yemeği Başlangıç', category: 'restaurant' },
  { key: 'restaurant_lunch_end', label: 'Öğle Yemeği Bitiş', category: 'restaurant' },
  { key: 'restaurant_dinner_start', label: 'Akşam Yemeği Başlangıç', category: 'restaurant' },
  { key: 'restaurant_dinner_end', label: 'Akşam Yemeği Bitiş', category: 'restaurant' },
  // spa
  { key: 'spa_open_time', label: 'Spa Açılış', category: 'spa' },
  { key: 'spa_close_time', label: 'Spa Kapanış', category: 'spa' },
  { key: 'gym_open_time', label: 'Fitness Açılış', category: 'spa' },
  { key: 'gym_close_time', label: 'Fitness Kapanış', category: 'spa' },
  // rooms
  { key: 'check_in_time', label: 'Check-in Saati', category: 'rooms' },
  { key: 'check_out_time', label: 'Check-out Saati', category: 'rooms' },
  { key: 'total_rooms', label: 'Toplam Oda Sayısı', category: 'rooms' },
  // wifi
  { key: 'wifi_ssid', label: 'Wi-Fi Ağ Adı', category: 'wifi' },
  { key: 'wifi_password', label: 'Wi-Fi Şifresi', category: 'wifi' },
  // contact
  { key: 'hotel_phone', label: 'Otel Telefonu', category: 'contact' },
  { key: 'hotel_address', label: 'Otel Adresi', category: 'contact' },
  { key: 'hotel_email', label: 'Otel E-posta', category: 'contact' },
  // beach
  { key: 'beach_distance', label: 'Plaja Mesafe', category: 'beach' },
  { key: 'beach_access', label: 'Plaj Erişimi', category: 'beach' },
] as const;

export type PredefinedFact = typeof PREDEFINED_FACTS[number];
```

---

## 2. Backend

### 2.1 `src/lib/knowledge/knowledge-client.ts` (yeni dosya)

Demo Hotel Supabase üzerinden facts ve sections okuma/yazma. Mevcut `getHotelClient` kullanılacak.

Fonksiyon imzaları:
```ts
listFacts(hotelId: string): Promise<Fact[]>
upsertFact(hotelId: string, fact: FactInput): Promise<Fact>
deleteFact(hotelId: string, id: string): Promise<void>

listSections(hotelId: string): Promise<Section[]>
upsertSection(hotelId: string, section: SectionInput): Promise<Section>
deleteSection(hotelId: string, id: string): Promise<void>
```

Hepsi `is_active=true` filtresiyle döner. Soft delete: `deleteFact` aslında `is_active=false` yapar (audit için).

### 2.2 `src/lib/knowledge/build-summary.ts` (yeni dosya)

AI için sistem promptuna inject edilecek özet metin.

```ts
export async function buildKnowledgeSummary(hotelId: string): Promise<string> {
  const facts = await listFacts(hotelId);
  const sections = await listSections(hotelId);

  // Facts: kategoriye göre gruplandır
  const grouped = groupByCategory(facts);
  const factsText = Object.entries(grouped)
    .map(([cat, list]) =>
      `[${categoryLabel(cat)}]\n` +
      list.map(f => `- ${f.fact_label}: ${f.fact_value}`).join('\n')
    )
    .join('\n\n');

  // Sections: başlık + kısa içerik
  const sectionsText = sections
    .map(s => `[${s.title}]\n${s.content}`)
    .join('\n\n');

  const full = `=== OTEL BİLGİLERİ ===\n${factsText}\n\n=== EKSTRA BİLGİLER ===\n${sectionsText}\n=== SON ===`;

  // Token cap: 2000 karakter (yaklaşık 600-700 token)
  if (full.length <= 2000) return full;
  return full.slice(0, 1997) + '...';
}
```

### 2.3 API endpoint'ler

**Tümü `/admin` session zorunlu (mevcut middleware kullan).**

```
GET    /api/admin/hotels/[id]/knowledge/facts        → list
POST   /api/admin/hotels/[id]/knowledge/facts        → create/update (upsert by fact_key)
PATCH  /api/admin/hotels/[id]/knowledge/facts/[fid]  → update
DELETE /api/admin/hotels/[id]/knowledge/facts/[fid]  → soft delete

GET    /api/admin/hotels/[id]/knowledge/sections        → list
POST   /api/admin/hotels/[id]/knowledge/sections        → create
PATCH  /api/admin/hotels/[id]/knowledge/sections/[sid]  → update
DELETE /api/admin/hotels/[id]/knowledge/sections/[sid]  → soft delete
```

Her POST/PATCH `audit_log`'a yazsın (action: `knowledge.fact.upsert` veya `knowledge.section.upsert`, target_id: hotel id).

---

## 3. Frontend

### 3.1 `/admin/hotels/[id]/knowledge` sayfası

Dosya: `src/app/admin/hotels/[id]/knowledge/page.tsx`

Layout:
```
Otel: [Hotel Adı]                                  [← Hotel detayına dön]

[Sekme: Hızlı Bilgiler] [Sekme: Detaylı Bölümler]

— Hızlı Bilgiler sekmesi seçiliyse —
Kategori filtreleri: [Tümü] [Havuz] [Restoran] [Spa] [Oda] [Wi-Fi] [İletişim] [Plaj] [Diğer]

[+ Yeni bilgi ekle] butonu

Tablo:
| Etiket            | Değer       | Kategori  | İşlemler          |
|-------------------|-------------|-----------|-------------------|
| Havuz Açılış      | 09:00       | Havuz     | [Düzenle][Sil]   |
| ...               | ...         | ...       | ...              |

— Detaylı Bölümler sekmesi seçiliyse —
[+ Yeni bölüm ekle]

Kart liste:
┌─────────────────────────────────────────┐
│ [Başlık: Otelimiz Hakkında]   [Düzenle][Sil] │
│ İçerik önizlemesi (ilk 200 char)...     │
└─────────────────────────────────────────┘
```

Form modaları:
- **Fact ekle/düzenle:** dropdown (predefined keys) veya custom key input + value input + label input + category select
- **Section ekle/düzenle:** title input + content textarea (markdown destekli, basit) + category opsiyonel + display_order

UX detayları:
- Predefined dropdown'dan seçilince label ve category otomatik dolar
- Custom key seçilirse label ve category manuel
- Save sonrası toast + listeyi yenile
- Sil onay modal

### 3.2 `/admin/hotels/[id]` ana detay sayfasında link

Mevcut hotel detay sayfasına `[Bilgi Bankası]` butonu eklensin → `/admin/hotels/[id]/knowledge`'e yönlendirsin.

---

## 4. AI Orchestrator entegrasyonu

### 4.1 Mevcut akış

`src/lib/ai/orchestrator.ts` (Modül 5'te oluşturuldu) Claude'a istek gönderiyor. Bu istekte sistem promptu var.

### 4.2 Değişiklik

Sistem promptu üretilirken `buildKnowledgeSummary(hotelId)` çağrılsın, çıktı sistem promptuna eklensin.

**Mevcut sistem promptuna eklenecek bölüm:**
```
{KNOWLEDGE_SUMMARY}

KURAL: Yukarıdaki "OTEL BİLGİLERİ" ve "EKSTRA BİLGİLER" bölümlerinde verilen bilgileri kullan. Bu bilgilerde olmayan konularda ASLA tahmin yürütme veya uydurma yapma. Bilmediğin bir bilgi sorulursa misafire şöyle de:
"Bu konuyu sizin için hemen ön büromuza ileteceğim, kısa süre içinde dönüş yapılacaktır." 
ve aynı zamanda intent'i front_office olarak işaretle.
```

### 4.3 Önbellek stratejisi

`buildKnowledgeSummary` her mesajda DB'ye gitmesin. Mevcut `getHotelClient`'taki gibi 5 dakikalık in-memory cache:

`src/lib/knowledge/cache.ts`:
```ts
const cache = new Map<string, { summary: string; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getCachedSummary(hotelId: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(hotelId);
  if (hit && hit.expiresAt > now) return hit.summary;
  const summary = await buildKnowledgeSummary(hotelId);
  cache.set(hotelId, { summary, expiresAt: now + TTL_MS });
  return summary;
}

export function invalidateSummary(hotelId: string) {
  cache.delete(hotelId);
}
```

Admin tarafında her POST/PATCH/DELETE sonrası `invalidateSummary(hotelId)` çağrılsın.

---

## 5. Seed data — Demo Hotel için

`scripts/seed-demo-knowledge.ts` (one-time script):

```ts
const seedFacts = [
  { fact_key: 'pool_open_time', fact_value: '09:00', fact_label: 'Havuz Açılış Saati', category: 'pool' },
  { fact_key: 'pool_close_time', fact_value: '19:00', fact_label: 'Havuz Kapanış Saati', category: 'pool' },
  { fact_key: 'restaurant_breakfast_start', fact_value: '07:00', fact_label: 'Kahvaltı Başlangıç', category: 'restaurant' },
  { fact_key: 'restaurant_breakfast_end', fact_value: '10:30', fact_label: 'Kahvaltı Bitiş', category: 'restaurant' },
  { fact_key: 'restaurant_dinner_start', fact_value: '19:00', fact_label: 'Akşam Yemeği Başlangıç', category: 'restaurant' },
  { fact_key: 'restaurant_dinner_end', fact_value: '22:00', fact_label: 'Akşam Yemeği Bitiş', category: 'restaurant' },
  { fact_key: 'check_in_time', fact_value: '14:00', fact_label: 'Check-in Saati', category: 'rooms' },
  { fact_key: 'check_out_time', fact_value: '12:00', fact_label: 'Check-out Saati', category: 'rooms' },
  { fact_key: 'wifi_ssid', fact_value: 'DemoHotelGuest', fact_label: 'Wi-Fi Ağ Adı', category: 'wifi' },
  { fact_key: 'wifi_password', fact_value: 'misafir2026', fact_label: 'Wi-Fi Şifresi', category: 'wifi' },
  { fact_key: 'spa_open_time', fact_value: '10:00', fact_label: 'Spa Açılış', category: 'spa' },
  { fact_key: 'spa_close_time', fact_value: '20:00', fact_label: 'Spa Kapanış', category: 'spa' },
];

const seedSections = [
  {
    title: 'Otelimiz Hakkında',
    content: 'Demo Hotel, Antalya kıyısında 5 yıldızlı bir tatil köyüdür. 250 oda, 4 restoran, 3 havuz ve özel plaj imkânı sunmaktadır.',
    category: 'general',
  },
  {
    title: 'Evcil Hayvan Politikası',
    content: 'Otelimizde evcil hayvan kabul edilmemektedir.',
    category: 'rules',
  },
];
```

Script doğrudan Demo Hotel'in service_role key'i ile insert eder. Çalıştırma talimatı README'de.

---

## 6. Test adımları

Antigravity build başarılı olduktan ve Vercel deploy bittikten sonra Kemal'in yapacağı testler:

**Test 1 — Migration doğrulama**
- Supabase Demo Hotel SQL editor'de:
```sql
SELECT count(*) FROM hotel_facts;     -- seed sonrası 12 olmalı
SELECT count(*) FROM knowledge_sections;  -- seed sonrası 2
```

**Test 2 — Admin panel görünüm**
- `/admin/hotels/[demo-hotel-id]/knowledge` aç
- "Hızlı Bilgiler" sekmesinde 12 satır görünmeli
- "Detaylı Bölümler" sekmesinde 2 kart görünmeli

**Test 3 — Fact ekleme**
- "+ Yeni bilgi ekle" → `gym_open_time = 08:00`, kategori Spa
- Listeye eklendi mi kontrol et

**Test 4 — Misafir botu (kritik)**
Telegram @DemoHotelAnaBot_bot:
| Mesaj | Beklenen |
|-------|----------|
| "Havuz kaçta açılıyor?" | "Havuz 09:00'da açılıyor" benzeri net cevap, forward YOK |
| "Wi-Fi şifresi ne?" | "DemoHotelGuest / misafir2026" |
| "Evcil hayvan kabul ediyor musunuz?" | "Hayır, kabul etmiyoruz" benzeri |
| "Akşam yemeği saat kaçta?" | "19:00 - 22:00 arası" |
| "Otel müdürünüz kim?" | "Hemen ön büromuza ilettim..." + Demo_OnBuro grubuna forward |
| "Spa rezervasyonu yapmak istiyorum" | Eskisi gibi spa departmanına forward (bilgi sorusu değil) |

**Test 5 — Cache invalidation**
- Bir fact'ı düzenle (havuz saati 09:00 → 10:00)
- 30 saniye içinde botu test et: yeni saat dönmeli

---

## 7. Yapılmayacaklar (Modül 7 kapsamı dışı)

- Departman panelleri (Modül 8)
- Sezonluk versiyonlama (Modül 11+)
- Embedding/semantic search (Modül 11)
- Çoklu dil (ileri modüller)
- Otel-içi rol yönetimi (Modül 8)

---

## 8. Commit + Tag

```bash
git add .
git commit -m "feat(module7): knowledge base — facts, sections, AI integration

- hotel_facts + knowledge_sections tables (Demo Hotel)
- Predefined fact keys (24 entry)
- /admin/hotels/[id]/knowledge admin UI (2 tabs, full CRUD)
- buildKnowledgeSummary + 5min cache
- AI orchestrator: knowledge inject + 'no hallucination' rule
- Seed script: 12 facts + 2 sections for Demo Hotel
- Audit log for all knowledge mutations"

git tag v1.0-module7
git push origin main --tags
```

---

## 9. Riskler ve önlemler

| Risk | Önlem |
|------|-------|
| Migration tablo yaratmaz (Modül 4'te oldu) | Migration sonrası `information_schema` ile doğrula, sonuç ekran görüntüsü Kemal'e |
| Cache invalidate edilmez, eski veri kalır | Her CRUD endpoint `invalidateSummary()` çağırsın, test 5 ile doğrula |
| Knowledge çok büyürse prompt token limit aşılır | 2000 char cap (`buildKnowledgeSummary` içinde), aşan kısım kesilir |
| AI yine uyduruyor | Prompt'a sert kural: "ASLA tahmin yürütme" + test 4 ile doğrula |
| Audit log şişer | Mevcut audit_log tablosu yeterli, tek satır per mutation |

---

**Modül 7 spec sonu.** Antigravity bu dosyayı okuyup uygulayacak. Doğrulama sonrası `v1.0-module7` tag atılır.
