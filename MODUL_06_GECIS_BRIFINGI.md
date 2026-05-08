# HotelGen v2 — Modül 6'ya Geçiş Brifingi

**Tarih:** 07.05.2026
**Mevcut tag:** v1.0-module5
**Sıradaki tag:** v1.0-module6

---

## 1. PROJE GENEL BAĞLAMI

**Proje:** HotelGen v2 — Multi-tenant otel otomasyon SaaS
**Stack:** Next.js 16 (App Router) + TypeScript strict + TailwindCSS 4 + Supabase + Vercel (Hobby) + GitHub
**Repo:** kemalkuyucu/hotelgendigital (private)
**Vercel proje:** hotelgen-v2 (HotelGenDigital workspace, Hobby plan)
**URL:** https://hotelgen-v2.vercel.app
**AI Provider:** Anthropic Claude (model: claude-sonnet-4-6) + OpenAI (Whisper, embedding — sonraki modüller)
**Email:** Resend

**Tag geçmişi:** v1.0-module1 → v1.0-module2 → v1.0-module3 → v1.0-module4 → v1.0-module5

**Sabit kararlar (değişmez):**
- 7 departman: front_office, housekeeping, technical, fb, guest_relation, spa, animation
- 3 paket: basic, full, premium
- Memory 3 katmanlı (messages, summary, facts) — şimdilik sadece messages aktif
- Stripe/ödeme YOK (kullanıcı kararı)
- Telegram her otele ayrı bot (misafir + yönetici)
- WhatsApp + Instagram = ManyChat (ileriki modüller)
- Default Admin: AdminYonetici / AdminYonetici?=2026

---

## 2. YAPILANLAR (Modül 1-5 özet)

### Modül 1 (v1.0-module1) — Foundation Layer
- 2 Supabase projesi: hotelgen-central (9 tablo), hotelgen-demo-hotel (26 tablo)
- RLS, seed, storage buckets
- AES-256-GCM şifreleme (bridge_credentials için)
- 19 env değişkeni Vercel Production'da
- /api/health-check 6/6 yeşil

### Modül 2 (v1.0-module2) — Auth & Admin Panel
- master_admins + custom session (master_admin_sessions tablosu)
- @supabase/ssr KULLANILMIYOR (custom session)
- bcrypt login, /admin/login
- /admin (dashboard), /admin/hotels CRUD
- bridge credentials formu (AES-GCM şifreli kayıt)
- /admin/hotels/[id]/vip-managers
- audit_log her kritik işlemde
- src/proxy.ts (Next.js 16'da middleware DEĞİL)
- (protected) route group

### Modül 3 (v1.0-module3) — Bridge & Email
- decrypt-credentials helper
- getHotelClient (5dk cache)
- Bridge test + system_health insert
- "Bağlantıyı Test Et" butonu
- /admin/system-health, /admin/audit-log (filtrelenebilir)
- Resend email (hotel-welcome template)
- /api/cron/health-check endpoint (Modül 5'te scheduled aktif edildi)
- Demo Hotel Bridge Test: 7 departman, 965ms

### Modül 4 (v1.0-module4) — Telegram Misafir Bot
- Bot: @DemoHotelAnaBot_bot (token Vercel env'de)
- Webhook: /api/webhooks/telegram/[hotelSlug] (signature secret doğrulama)
- Demo Hotel slug: 'demo-hotel'
- Yeni tablolar (Demo Hotel): guests, conversations, bot_messages
- Yeni kolon (Central hotels): telegram_manager_chat_id
- /start ve düz mesaj çalışıyor (Modül 4'te echo, Modül 5'te AI cevap)

### Modül 5 (v1.0-module5) — AI Orchestrator + Yönetici Bot ✅ YENİ
**Tamamlandı: 07.05.2026**

**Yapılanlar:**
1. **Misafir bot AI yanıtı:** Echo logic'i kaldırıldı, Claude API çağrısı koyuldu. Tek çağrıda hem departman sınıflandırma hem misafire cevap üretiyor (structured JSON output).
2. **AI Intent kaydı:** `ai_intents` tablosu Demo Hotel'de oluşturuldu (13 kolon: id, conversation_id, bot_message_id, classified_department, confidence, reasoning, ai_response, model, prompt_tokens, completion_tokens, latency_ms, error, created_at).
3. **Yönetici raporlama bot'u:** @hotel_yonetici_rapor_bot, webhook /api/webhooks/telegram-manager/[hotelSlug]. Sadece Central'da kayıtlı telegram_manager_chat_id (758605940 = Özgür Özen) ile konuşuyor, başka chat'lerden gelen mesajları sessizce yutuyor.
4. **Komutlar:** /start, /help, /rapor, /durum, /aktif_konusmalar, /son_mesajlar [N]
5. **Cron aktivasyonu:** vercel.json'a cron eklendi. Hobby plan kısıtı nedeniyle `0 9 * * *` (her gün 09:00 UTC). `/api/cron/health-check` çalışacak.

**Yeni env değişkenleri (Vercel Production + Preview):**
- TELEGRAM_MANAGER_BOT_TOKEN_DEMO
- TELEGRAM_MANAGER_BOT_USERNAME_DEMO = `hotel_yonetici_rapor_bot`

**Yeni dosyalar:**
- supabase/migrations/hotel/10_module5_ai_intents.sql
- src/lib/ai/anthropic-client.ts
- src/lib/ai/system-prompts.ts
- src/lib/ai/classify-and-respond.ts
- src/lib/telegram/manager-bot-client.ts
- src/lib/telegram/commands/handle-{help,rapor,durum,aktif-konusmalar,son-mesajlar}.ts
- src/app/api/webhooks/telegram-manager/[hotelSlug]/route.ts
- vercel.json (cron config)

**Test sonuçları (production):**
- Misafir bot 4 farklı mesaja kibar AI cevabı verdi
- Sınıflandırma: 3/4 doğru (technical, fb, spa) + 1 doğru "sınıflandırılamadı" (Merhaba)
- Yönetici bot /rapor, /aktif_konusmalar, /son_mesajlar çalışıyor

**Modül 5 sırasında karşılaşılan ve çözülen sorunlar:**
- `departments` tablosunda `telegram_chat_id` kolonu yoktu → ALTER TABLE ile eklendi (Modül 4 follow-up)
- Vercel Hobby plan cron schedule limiti `*/15 * * * *` reddetti → `0 9 * * *` olarak değiştirildi
- Central `hotels.telegram_manager_chat_id` NULL idi → 758605940 ile UPDATE seed
- TELEGRAM_MANAGER_BOT_TOKEN_DEMO env'ine yanlışlıkla misafir bot token'ı yapıştırılmıştı → BotFather `/token` ile doğru token alınıp güncellendi

**Demo Hotel departments tablosu (chat_id seed):**
- front_office: -5225595171 (Demo_OnBuro)
- fb: -5195906059 (Demo_FB)
- guest_relation: -5259975165 (Demo_GR)
- housekeeping: -5192396395 (Demo_HK)
- technical: -5119371860 (Demo_TS)
- animation: -5103707132 (Demo_ANIMASYON)
- spa: -5149597537 (Demo_SPA)
- (Demo_MUTFAK grubu var: -5103089115, ama henüz routing yok — Modül 6'da karar)

---

## 3. MODÜL 5 FOLLOW-UP (Modül 6 öncesi yapılacaklar)

### 3.1 /durum komutu testi (yarın 08.05.2026, 09:00 UTC sonrası)
Vercel cron `0 9 * * *` ile `/api/cron/health-check` çalışacak. Bu çalıştıktan sonra Demo Hotel `system_health` tablosunda kayıt oluşacak. Yarın 12:00 TR (09:00 UTC) sonrası @hotel_yonetici_rapor_bot'a `/durum` yaz, son 5 health check kaydını göstermeli.

### 3.2 Kozmetik bug (Modül 6 kapsamına alınabilir)
`/rapor` komutunda "Gelen/Giden mesaj 0" görünüyor ama intent dağılımı 4 mesaj gösteriyor. Sebep: `bot_messages` count'u UTC takvim günü bazlı (`todayStart.setHours(0,0,0,0)` JS lokal saat → UTC karışıklığı). Çözüm: "son 24 saat" şeklinde değiştir veya UTC normalize et.

---

## 4. MODÜL 6 — HEDEFLER (asıl iş)

### 4.1 Ana hedef
**Sınıflandırma sonrası gerçek iletim:** Misafir mesajı sınıflandırıldıktan sonra (Modül 5'te ai_intents'a kayıt düşüyor ama hiçbir yere mesaj gitmiyor), o departmanın Telegram grubuna **gerçekten mesaj forward edilsin**.

### 4.2 Akış (yeni)
```
Misafir mesajı → webhook → AI classify → ai_intents kayıt
                                       ↓
                          [YENİ] Departman grubuna forward
                                       ↓
                          [YENİ] forwarded_messages tablosuna kayıt
```

### 4.3 Modül 6 kapsam adayları
1. **Departman grubuna mesaj forward** — Misafir mesajının formatlanmış halini (misafir adı, mesaj, AI cevabı, intent confidence) ilgili departman grubuna gönder.
2. **Off-hours behavior** — departments tablosunda `working_hours`, `off_hours_behavior` (varsayılan: forward_to_reception), `notification_channel_priority` kolonları var ama kullanılmıyor. Mesai dışı mesajları front_office'e yönlendir.
3. **Mutfak (Demo_MUTFAK) routing kararı** — Şu an fb altında. Karar: ayrı bir routing key eklensin mi yoksa fb içinde anahtar kelimeyle ayrılsın mı? (Önerim: fb altında kalsın, mutfak özel keyword'leriyle (yemek, mutfak, garson) AI prompt'a opsiyonel sub-routing eklensin.)
4. **Yeni tablo:** `forwarded_messages` (ai_intent_id, target_department, target_chat_id, telegram_message_id, status, error, created_at)
5. **Kozmetik bug fix** — Bölüm 3.2'deki rapor sayım bug'ı.
6. **(Opsiyonel) Misafir bilgisini guest groupa ek**ler (admin için): conversations.last_intent, conversations.last_forwarded_at gibi rapor için kolaylık kolonları.

### 4.4 Modül 6 kapsamı DIŞI (Modül 7+)
- WhatsApp/Instagram (ManyChat)
- Sesli mesaj transcription (Whisper)
- Memory summary ve facts katmanları
- Embedding tabanlı semantic search
- Departman grubundan misafire iki yönlü cevap (departmanın yazdığı cevabı bot misafire iletme)
- Çok dilli destek (şu an sadece Türkçe)

---

## 5. SONRAKI MODÜLLER (high-level)

| Modül | Tag | Hedef |
|---|---|---|
| 6 | v1.0-module6 | Departman grubuna forward + off-hours routing |
| 7 | v1.0-module7 | İki yönlü iletişim (departmandan misafire) |
| 8 | v1.0-module8 | WhatsApp + Instagram (ManyChat entegrasyonu) |
| 9 | v1.0-module9 | Sesli mesaj (Whisper transcription) |
| 10 | v1.0-module10 | Memory katmanları (summary + facts) + embedding |
| 11 | v1.0-module11 | Paket sistemi aktif (basic/full/premium feature gating) |
| 12 | v1.0-module12 | Production hardening (rate limit, monitoring, alerting) |

> Sıralama esnek, ihtiyaca göre değişebilir.

---

## 6. KULLANICI BİLGİSİ (önemli)

**İsim:** Kemal Kuyucu (otel projesi sahibi)
**Yönetici hesap:** Özgür Özen (telegram_user_id: 758605940)
**Deneyim:** Vercel/Supabase/GitHub'a yeni başladı, hâkim değil. Antigravity (Sonnet 4.6) ile geliştirme yapıyor.

**İletişim tarzı:**
- Kısa-net-öz açıklama ister, uzun anlatım kafa karıştırır
- Mikro adım: tek seferde tek iş
- Talimatlar kopyala-yapıştır **kod bloğu** içinde verilmeli
- Ekran görüntüsüyle iletişim kurar
- "Şuraya tıkla" derken net işaret edilmeli (kutu, yazı tam adı, vs.)
- 2-3 seçenek arasında kararsız kaldığında Claude karar versin (sorma, doğrudan ilerle)
- Onay isteme — kritik kararlar dışında doğrudan ilerle
- Token, secret gibi hassas değerler asla ekran görüntüsüne girmesin (uyarmak gerekirse uyar)

**Geliştirme akışı:**
- Claude.ai sohbeti = koordinatör/danışman/spec yazıcı (yani SEN)
- Antigravity (kullanıcının IDE'si) = kod yazıcı
- Sen Antigravity'ye paket (.md spec dosyası) hazırlayıp veriyorsun
- Antigravity kodu yazıyor, build yapıyor, commit + push + tag yapıyor
- Vercel otomatik deploy ediyor
- Sen test adımlarını yönetiyorsun

---

## 7. BİLİNEN TAKINTILI SORUNLAR (tekrar yaşamamak için)

### 7.1 Vercel
- **"Sensitive" değişkenler Edit ekranında değer GÖSTERMEZ** — boş gibi görünür ama doludur. Edit'te boş alana yapıştırıp Save'lersen değeri SİLERSİN. Çözüm: ya hiç Sensitive yapma (varsayılan), ya da Edit yerine Remove + yeniden Add kullan.
- **Vercel Sensitive değişkenler Development environment'a eklenemez** (kilitli). Production + Preview yeterli.
- **`vercel env pull` varsayılanda Production'dan çekmez** — `--environment=production --yes` flag'leri kullan.
- **Hobby plan cron limiti:** Sadece günde 1 kere çalışan cron'lara izin var (max 2 cron job). `*/15 * * * *` veya `0 */1 * * *` reddedilir, deploy build hatası verir. Çözüm: `0 9 * * *` veya benzeri günde 1 kez expression.

### 7.2 Telegram
- **Bot Privacy Mode varsayılan açık** — gruplarda sadece komutları ve mention'ları görür, düz mesajları görmez. BotFather → /setprivacy → Disable et.
- **Webhook + getUpdates aynı anda çalışmaz** — biri aktifken diğeri 409 Conflict döner. Debug için geçici olarak deleteWebhook → getUpdates → setWebhook sırası izlenmeli.
- **Token vs Username karıştırması:** API URL'sinde `bot` kelimesinden sonra TOKEN gelir (uzun, `:` içeren), username DEĞİL. Tipik hata: `https://api.telegram.org/bothotel_yonetici_rapor_bot/getMe` (yanlış, 404), doğrusu `https://api.telegram.org/bot8123:AAEH.../getMe`.
- **`/revoke` vs `/token`:** /revoke yeni token üretir + eski geçersizleşir. /token sadece mevcut token'ı gösterir, eski geçerli kalır.
- **Token sohbete ifşa olursa hemen revoke** — token = bot şifresi.

### 7.3 Supabase / Migration
- Migration "başarılı" diye Antigravity diyor ama tablolar oluşmamış olabilir — her zaman `information_schema.tables` ve `information_schema.columns` ile **doğrula**. Modül 4'te tablolar oluşmamıştı, Modül 5'te de `telegram_chat_id` kolonu yoktu.
- Migration dosyaları: Demo Hotel için `supabase/migrations/hotel/`, Central için ayrı klasör (varsa).

### 7.4 Next.js 16 / TypeScript
- TypeScript strict mode — `any` yasak, `unknown` + type guard kullan.
- Next.js 16'da middleware → `src/proxy.ts` adıyla.
- App Router dynamic params async: `context.params` Promise döner, await edilmeli.

### 7.5 Anthropic API
- Vercel Hobby function timeout 10s — Claude API çağrısı 1-3s normalde, ama uzun context veya yavaş model durumunda timeout olabilir. Pro plana geçiş veya context kısaltma çözüm.
- JSON output parse hatası: Claude bazen ```json fence ekler veya başına/sonuna açıklama yazar. Parse adımında `replace(/^```json\s*/i, '').replace(/```\s*$/, '')` ile temizle.

---

## 8. İLK KOMUT (yeni sohbete yapıştırdıktan sonra)

```
Modül 6'ya geçmek istiyorum. Brifingi okudun, durumu anladın.

Önce yarınki cron testini hatırlatman için: yarın 12:00 TR (09:00 UTC) sonrası @hotel_yonetici_rapor_bot'a /durum yazıp test edeceğim.

Şimdi Modül 6 için Antigravity'ye verilecek detaylı paket (MODUL_06_ANTIGRAVITY.md) hazırlayalım. Modül 5 paketinin tarzında olsun:
- Bağlam özeti
- Modül 6 hedefleri (departman grubuna forward + off-hours behavior + Mutfak kararı + kozmetik bug fix)
- Schema değişiklikleri (forwarded_messages tablosu)
- Mimari ve akış
- Dosya listesi
- Detaylı implementation referansı (kod örnekleri)
- Test adımları
- Build / commit / tag
- Riskler ve notlar

Hazırla, dosyayı bana ver, sonra tartışacağız.
```

---

## 9. DESTEKLEYİCİ KAYNAKLAR

**Vercel proje URL:** https://hotelgen-v2.vercel.app
**GitHub repo:** https://github.com/kemalkuyucu/hotelgendigital
**Central Supabase proje:** hotelgen-central
**Demo Hotel Supabase proje:** hotelgen-demo-hotel
**Misafir bot:** @DemoHotelAnaBot_bot
**Yönetici bot:** @hotel_yonetici_rapor_bot
**Yönetici Telegram chat_id:** 758605940 (Özgür Özen)

---

**Brifing sonu. Modül 6'ya hazırız.**
