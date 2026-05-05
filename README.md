# 📦 MODÜL 1 PAKETİ — TEMEL KATMAN

> HotelGen v2 — Multi-tenant otel otomasyon SaaS'ının ilk modülü.

---

## 🎯 Bu Pakette Ne Var?

```
modul-1-paketi/
├── docs/
│   ├── MODUL_01_SENIN_ICIN.md         ← Sen bunu oku, adım adım uygula
│   └── MODUL_01_ANTIGRAVITY.md        ← Antigravity'ye yapıştır
│
├── sql/
│   ├── 01_central_schema.sql          ← Central DB tablolar
│   ├── 02_central_rls.sql             ← Central DB güvenlik
│   ├── 03_central_seed.sql            ← Master adminler + demo otel
│   ├── 04_central_storage.sql         ← Central storage bucket'lar
│   ├── 05_hotel_schema.sql            ← Hotel DB tablolar (26 tablo)
│   ├── 06_hotel_rls.sql               ← Hotel DB güvenlik
│   └── 07_hotel_storage.sql           ← Hotel storage bucket'lar
│
└── code-templates/
    ├── encryption.ts                  ← AES-256-GCM şifreleme
    ├── supabase-client.ts             ← DB bağlantı factory
    ├── tenant-resolver.ts             ← Multi-tenant beyni
    ├── health-check-route.ts          ← Sağlık kontrolü endpoint'i
    ├── .env.example                   ← Env şablonu
    └── .gitignore                     ← Git ignore listesi
```

---

## 🚀 Başlama Sırası

### 1. Önce dokümanı oku
👉 `docs/MODUL_01_SENIN_ICIN.md` — bu senin rehberin, baştan sona oku.

### 2. Adım adım takip et
Doküman 7 adımda ilerliyor:
1. Supabase'de 2 proje aç
2. SQL'leri sırayla çalıştır
3. API key'leri topla
4. Güvenlik anahtarlarını üret (terminal)
5. GitHub repo aç
6. Antigravity'ye kod talimatı ver
7. Vercel'e deploy + env variables

### 3. Bittiğinde
`/api/health-check` endpoint'i tüm yeşilleri gösteriyor olmalı.

---

## ❓ Hangi Dosyayı Ne Zaman Açacağım?

| Aşama | Açacağın Dosya |
|-------|----------------|
| 0. Başlangıç | `docs/MODUL_01_SENIN_ICIN.md` |
| 1. Supabase Central kurulumu | `sql/01_*.sql`, `sql/02_*.sql`, `sql/03_*.sql`, `sql/04_*.sql` |
| 2. Supabase Hotel kurulumu | `sql/05_*.sql`, `sql/06_*.sql`, `sql/07_*.sql` |
| 3. Antigravity'e talimat | `docs/MODUL_01_ANTIGRAVITY.md` (ve referans olarak `code-templates/*`) |
| 4. Vercel env yardım | `code-templates/.env.example` |
| 5. Sorun çıkarsa | Bu README + bana mesaj |

---

## 📊 Pakette Toplam Ne Var?

- **7 SQL dosyası** — toplam ~1100 satır
- **6 kod şablonu** — TypeScript modülleri
- **2 talimat dokümanı** — sen ve Antigravity için
- **35 tablo** (Central: 9, Hotel: 26)
- **6 storage bucket** (Central: 2, Hotel: 4)
- **2 Postgres extension** (uuid-ossp, vector)

---

## ⚠️ Kritik Hatırlatmalar

1. **API key'leri Antigravity'ye verme.** Sadece Vercel env variables'a gir.
2. **`.env.local` dosyasını GitHub'a push etme.** `.gitignore` zaten engeller, ama dikkat.
3. **SQL'leri SIRA İLE çalıştır.** Atlamaca yapma, dosya numaralarını takip et.
4. **Central ve Hotel Supabase'lerini karıştırma.** Hangi SQL'i hangi projede çalıştırdığına dikkat.
5. **Bir şey takılırsa dur, sor.** Kendi kafandan "düzeltme" yapma.

---

## 🆘 Yardım

Modülü tamamlarken takıldığında bana mesaj at:
- **Hangi adımdayım** (örn: "Adım 6.2 — Antigravity'de step 3.3"de takıldım")
- **Ne hata aldım** (kopyala yapıştır, ekran görüntüsü)
- **Beklediğim davranış neydi**

---

**Hazırsın. `docs/MODUL_01_SENIN_ICIN.md` ile başla. 💪**
