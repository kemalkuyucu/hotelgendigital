# 📘 MODÜL 1 — TEMEL KATMAN: SENİN İÇİN ADIM ADIM REHBER

> **Hedef:** Multi-tenant SaaS altyapının temelini kurmak — 2 Supabase projesi, env, klasör yapısı, sağlık kontrolü.
>
> **Tahmini süre:** 60-90 dakika (acele etme, her adımı doğru yap)
>
> **Bittiğinde elinde:** Çalışan bir Vercel deployment, `/api/health-check` endpoint'i tüm yeşilleri gösteriyor.

---

## 🗺️ Bu Modülde Ne Yapacağız?

```
1. İki Supabase projesi açacaksın:
   • hotelgen-central        (bizim master DB — 11 tablo + 2 storage bucket)
   • hotelgen-demo-hotel     (demo otelin DB'si — 26 tablo + 4 storage bucket + pgvector)

2. SQL'leri sırayla çalıştıracaksın (7 dosya, hepsi paket içinde)

3. API key'leri toplayacaksın:
   • Anthropic Claude
   • OpenAI (Whisper + embeddings)
   • Resend (email — modül 5'te aktif olacak ama hesap şimdi açılsın)

4. Encryption master key üreteceksin (terminal'de tek komut)

5. GitHub'da yeni boş repo açacaksın: hotelgen-v2

6. Antigravity'ye kod talimat dosyasını vereceksin (ben hazırladım)

7. Vercel'e deploy edeceksin + env variables ekleyeceksin

8. /api/health-check çağıracaksın — tüm yeşilleri görmen lazım
```

---

## 📋 ADIM 1 — SUPABASE: İKİ PROJE AÇ

### 1.1 Central Project

1. https://supabase.com/dashboard adresine git
2. Sağ üstte **"New project"** butonuna bas
3. Şu bilgileri gir:
   - **Name:** `hotelgen-central`
   - **Database Password:** Güçlü bir şifre üret (şimdi bir yere kaydet, lazım olabilir)
   - **Region:** Sana en yakın olan (Türkiye için: `eu-central-1` Frankfurt önerilir)
   - **Pricing Plan:** Free tier yeter
4. **"Create new project"** bas, ~2 dakika bekle (yeşil tik gelene kadar)

### 1.2 Demo Hotel Project

Aynı adımları tekrar yap:
- **Name:** `hotelgen-demo-hotel`
- **Region:** Aynı bölge (`eu-central-1` Frankfurt)
- Şifreyi de farklı tut

---

## 📋 ADIM 2 — SQL'LERİ ÇALIŞTIR

> ⚠️ **Sıra önemli!** Numaraları takip et, atlamaca yapma.

### 2.1 Central Supabase'de (`hotelgen-central` projesi)

1. Sol menüden **SQL Editor** sekmesine git
2. **"New query"** bas
3. Sırayla şu 4 dosyayı çalıştır:

| Sıra | Dosya | Beklenen sonuç |
|------|-------|----------------|
| 1 | `sql/01_central_schema.sql` | "Success. No rows returned" |
| 2 | `sql/02_central_rls.sql` | "Success. No rows returned" |
| 3 | `sql/03_central_seed.sql` | "Success. No rows returned" |
| 4 | `sql/04_central_storage.sql` | "Success. No rows returned" |

> Her dosya için: SQL editöre yapıştır → sağ alttaki **"Run"** butonuna bas (veya Ctrl+Enter) → success bekle → sonraki dosyaya geç

### 2.2 Test Et — Central tarafı

SQL Editor'a şunu yapıştır ve çalıştır:

```sql
select count(*) as packages from packages;
select count(*) as admins from master_admins;
select count(*) as hotels from hotels;
```

Beklenen: `3, 3, 1` görmen lazım. Görmüyorsan bana mesaj at.

### 2.3 Demo Hotel Supabase'de (`hotelgen-demo-hotel` projesi)

1. Bu projenin SQL Editor'üne git
2. Sırayla şu 3 dosyayı çalıştır:

| Sıra | Dosya | Beklenen sonuç |
|------|-------|----------------|
| 5 | `sql/05_hotel_schema.sql` | "Success. No rows returned" |
| 6 | `sql/06_hotel_rls.sql` | "Success. No rows returned" |
| 7 | `sql/07_hotel_storage.sql` | "Success. No rows returned" |

### 2.4 Test Et — Demo Hotel tarafı

```sql
select count(*) as departments from departments;
select count(*) as tech_subs from technical_subcategories;
select extname from pg_extension where extname = 'vector';
```

Beklenen: `7, 7, vector` görmen lazım.

✅ **Adım 2 tamam → bana "Supabase SQL'ler tamam" yaz.**

---

## 📋 ADIM 3 — API KEY'LERİ TOPLA

> 🔒 **Tüm key'leri güvenli bir not defterine kaydet** (1Password, Bitwarden, en kötü ihtimalle yerel şifreli not). Bu key'leri kimseyle paylaşma, AI'ya verme, GitHub'a koyma. Vercel'e gireceğiz, başka hiçbir yere değil.

### 3.1 Supabase Key'leri (her iki proje için)

Her Supabase projesinde:
1. Sol menü → **Project Settings** (alttaki dişli)
2. **Data API** sekmesi
3. Şunları kopyala:
   - **Project URL** (örn: `https://xxxxx.supabase.co`)
   - **API Keys → anon (public)** (uzun JWT)
   - **API Keys → service_role (secret)** (uzun JWT — DİKKAT, bu kritik!)

Toplam 6 değer (3 × 2 proje):
- `CENTRAL_SUPABASE_URL`
- `CENTRAL_SUPABASE_ANON_KEY`
- `CENTRAL_SUPABASE_SERVICE_ROLE_KEY`
- `DEMO_HOTEL_SUPABASE_URL`
- `DEMO_HOTEL_SUPABASE_ANON_KEY`
- `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY`

### 3.2 Anthropic API Key

1. https://console.anthropic.com/ adresine git, hesap aç (yoksa)
2. Sol menü → **API Keys**
3. **Create Key** bas, isim ver: `hotelgen-prod`
4. Çıkan key'i hemen kopyala (`sk-ant-api03-...` ile başlıyor) — sadece bir kez gösterilir
5. Bakiye yükle: **Settings → Billing** → en az $20 (bu ayda fazlasıyla yeter)

→ `ANTHROPIC_API_KEY` olarak kaydet

### 3.3 OpenAI API Key

1. https://platform.openai.com/api-keys adresine git
2. **Create new secret key** bas
3. İsim: `hotelgen-prod`, **Create**
4. `sk-proj-...` ile başlayan key'i kopyala
5. **Settings → Billing** → en az $10 yükle

→ `OPENAI_API_KEY` olarak kaydet

### 3.4 Resend API Key

1. https://resend.com/ adresine git, hesap aç (Google ile hızlı)
2. Dashboard'da **API Keys** → **Create API Key**
3. İsim: `hotelgen-prod`, **Permission: Full access**
4. `re_...` ile başlayan key'i kopyala

→ `RESEND_API_KEY` olarak kaydet
→ `RESEND_FROM_EMAIL` için şimdilik: `onboarding@resend.dev` (test için yeterli, sonra kendi domain'ini ekleyeceğiz)

### 3.5 Telegram Bot Token (Demo için)

1. Telegram'da **@BotFather** ile sohbet aç
2. `/newbot` yaz
3. Botun adı: `Demo Resort SPA Bot`
4. Botun username: `demo_resort_spa_bot` (sonu `_bot` ile bitmeli, müsait olmayanı seçtirir)
5. BotFather sana token verir (`123456789:ABC-DEF...` formatında)

→ `TELEGRAM_BOT_TOKEN_DEMO` olarak kaydet
→ `TELEGRAM_BOT_USERNAME_DEMO` = `demo_resort_spa_bot` (yukarıda seçtiğin)

✅ **Adım 3 tamam → 9 key/değer elinde olmalı.**

---

## 📋 ADIM 4 — TERMİNAL'DE 3 GÜVENLİK ANAHTARI ÜRET

Mac/Linux/Windows (Git Bash) terminalinde sırayla şu komutları çalıştır ve çıktılarını kaydet:

```bash
# 1. Encryption master key (32 byte = 256 bit)
openssl rand -hex 32
```
→ Çıktıyı `ENCRYPTION_MASTER_KEY` olarak kaydet

```bash
# 2. Cron secret (Vercel cron'ları için)
openssl rand -hex 32
```
→ Çıktıyı `CRON_SECRET` olarak kaydet

```bash
# 3. Telegram webhook secret + ManyChat webhook secret + Admin bootstrap token
openssl rand -hex 16
openssl rand -hex 16
openssl rand -hex 32
```
→ Sırayla `TELEGRAM_WEBHOOK_SECRET`, `MANYCHAT_WEBHOOK_SECRET`, `ADMIN_BOOTSTRAP_TOKEN` olarak kaydet

> **Windows'ta openssl yoksa:** Git Bash kullan, ya da PowerShell'de şu komutla:
> ```powershell
> -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
> ```

✅ **Adım 4 tamam → 5 yeni güvenlik değeri elinde.**

---

## 📋 ADIM 5 — GITHUB'DA YENİ REPO

1. https://github.com/new
2. **Repository name:** `hotelgen-v2`
3. **Visibility:** Private (kesinlikle private!)
4. **README ekleme, .gitignore ekleme, license ekleme** → hepsi **boş** (Antigravity sıfırdan kuracak)
5. **Create repository**
6. Repo URL'ini kopyala (örn: `https://github.com/yourname/hotelgen-v2.git`)

✅ **Adım 5 tamam.**

---

## 📋 ADIM 6 — ANTIGRAVITY'YE KOD TALİMATI VER

> **DİKKAT:** Bu adımda Antigravity'ye **sadece kod talimatı** vereceksin. API key falan vermeyeceksin.

1. Antigravity'yi aç, **yeni bir workspace** oluştur (eski projeyi karıştırmayalım)
2. Boş klasör seç (örn: `~/Projects/hotelgen-v2`)
3. Repo'yu klonla:
   ```bash
   git clone https://github.com/yourname/hotelgen-v2.git .
   ```
4. **`MODUL_01_ANTIGRAVITY.md`** dosyasını Antigravity'nin chat'ine **doğrudan yapıştır**
5. Sonuna şunu yaz: `Bu dosyada yazılı adımları sırasıyla uygula. Her adımı yapıp bana "tamam" demeden sonrakine geçme. Hiçbir adımı atlama, kendi kafandan iyileştirme önerme. Kod tamamlandığında "Modül 1 tamam" diye bildir.`

Antigravity sırayla:
- Klasör yapısını oluşturacak
- `package.json` üretecek
- TypeScript kod dosyalarını yazacak
- `.env.example`, `.gitignore` koyacak
- Health check endpoint'i hazırlayacak
- Git commit yapacak

> Bittiğinde **dosya listesini ekran görüntüsü olarak bana at** — kontrol edeyim.

✅ **Adım 6 tamam → kod hazır, GitHub'a push edildi.**

---

## 📋 ADIM 7 — VERCEL'E DEPLOY ET

### 7.1 Vercel'e import

1. https://vercel.com/dashboard
2. **Add New → Project**
3. **Import Git Repository** → `hotelgen-v2` seç
4. **Configure Project** ekranı geldi:
   - Framework: Next.js (otomatik algılar)
   - Root Directory: ./
   - **DEPLOY butonuna BASMA HENÜZ!** Önce env variables ekle.

### 7.2 Environment Variables Ekle

Aynı sayfada **"Environment Variables"** bölümünü aç. Aşağıdaki **17 değişkeni** tek tek ekle:

| Name | Value |
|------|-------|
| `CENTRAL_SUPABASE_URL` | (Supabase'den kopyaladığın) |
| `CENTRAL_SUPABASE_ANON_KEY` | (Supabase'den kopyaladığın) |
| `CENTRAL_SUPABASE_SERVICE_ROLE_KEY` | (Supabase'den kopyaladığın) |
| `DEMO_HOTEL_SUPABASE_URL` | (Demo hotel Supabase'den) |
| `DEMO_HOTEL_SUPABASE_ANON_KEY` | (Demo hotel Supabase'den) |
| `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY` | (Demo hotel Supabase'den) |
| `ENCRYPTION_MASTER_KEY` | (terminal'den ürettiğin) |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `OPENAI_API_KEY` | `sk-proj-...` |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `TELEGRAM_BOT_TOKEN_DEMO` | (BotFather'dan) |
| `TELEGRAM_BOT_USERNAME_DEMO` | `demo_resort_spa_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | (terminal'den ürettiğin) |
| `MANYCHAT_WEBHOOK_SECRET` | (terminal'den ürettiğin) |
| `CRON_SECRET` | (terminal'den ürettiğin) |
| `ADMIN_BOOTSTRAP_TOKEN` | (terminal'den ürettiğin) |
| `DEFAULT_ADMIN_PASSWORD` | `AdminYonetici?=2026` |
| `NODE_ENV` | `production` |

> Her değişken için **Production, Preview, Development** kutucuklarının **üçü de işaretli** olsun.

### 7.3 Deploy

1. **DEPLOY** butonuna bas
2. ~3-5 dakika bekle
3. Yeşil tik gelirse → siteyi aç (vercel sana URL veriyor: `hotelgen-v2-xxx.vercel.app`)
4. URL'in sonuna `/api/health-check` ekle ve aç:
   ```
   https://hotelgen-v2-xxx.vercel.app/api/health-check
   ```

**Beklenen yanıt:**
```json
{
  "status": "ok",
  "timestamp": "2026-...",
  "checks": {
    "env_vars": { "ok": true, "message": "..." },
    "central_supabase": { "ok": true, "message": "..." },
    "demo_hotel_supabase": { "ok": true, "message": "..." },
    "encryption": { "ok": true, "message": "..." },
    "pgvector": { "ok": true, "message": "..." },
    "seed_data": { "ok": true, "message": "..." }
  }
}
```

Hepsi **`"ok": true`** ise → 🎉 **MODÜL 1 TAMAM!**

✅ **Adım 7 tamam → Modül 1 bitti.**

---

## ❓ Bir Yerde Takılırsan

- **SQL hata verdi:** Hatanın tamamını ekran görüntüsü olarak bana at
- **API key alamıyorum:** Hangi servisteyim ve ne hata aldığını yaz
- **Vercel deploy başarısız:** "Build logs" altındaki kırmızı satırları gönder
- **Health check kırmızı:** Hangi check fail oldu, mesajı ne — kopyala bana at

> Endişelenme, her sorun çözülür. Acele etme, kafan karışırsa dur, sor.

---

## 🎯 MODÜL 1 BİTTİĞİNDE

Bana şunu yaz: **"Modül 1 tamam, /api/health-check tüm yeşil"**

O zaman **Modül 2: Multi-tenant Köprü**'ye geçeriz:
- Bridge credentials encryption flow
- Otel açma akışı (Master Hub'dan)
- Tenant resolver canlı testleri
- İlk gerçek otel kaydı

---

**Başarılar! 💪 Acele etme, doğru yap.**
