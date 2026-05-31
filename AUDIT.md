# AUDIT.md — Kod Tabanı Denetim Raporu

**Tarih:** 2026-05-31
**Kapsam:** Güvenlik (multi-tenant izolasyon, RLS, middleware/route koruması), TypeScript/lint, error handling, Supabase sorgu/şema tutarlılığı
**Yöntem:** Salt-okunur statik analiz + `tsc --noEmit` + `next lint`. **Hiçbir dosya değiştirilmedi.**

> Şema değerlendirmesi depodaki SQL'e (`migrations/tenant/`, `migrations/central/`, `sql/`, `supabase/migrations/`) göre yapıldı. Canlı Supabase DB'sine erişilmediğinden, "hangi şemanın gerçekten uygulandığına" bağlı maddeler **[CANLI DB TEYİDİ]** ile işaretlendi.

---

## Özet Tablo (önem sırasına göre)

| # | Bulgu | Kategori | Risk | Konum |
|---|-------|----------|------|-------|
| S1 | ✅ **ÇÖZÜLDÜ** — `.env.production` canlı secret'larla diskte ve `.gitignore` kapsamı DIŞINDAYDI | Güvenlik | **KRİTİK** | repo kökü, `.gitignore` |
| S2 | JWT secret yoksa sabit `'...change-in-production'` fallback → token sahteciliği | Güvenlik | **KRİTİK** | `src/middleware.ts:34-40`, `lib/hotel-admin/auth.ts:14-17`, `lib/group-admin/auth.ts` |
| S3 | `admin-users` route'u super_admin kontrolü yapmıyor → herhangi bir admin başka otele owner hesabı açabilir | Güvenlik | **KRİTİK** | `api/admin/hotels/[id]/admin-users/route.ts:16,46` |
| S4 | ManyChat webhook secret boşsa (prod'da boş) auth tamamen atlanıyor (fail-open) | Güvenlik | **KRİTİK** | `api/webhooks/manychat/[hotelSlug]/route.ts:49-56` |
| D1 | `forwarded_messages` insert'i var olmayan kolonlarla yapılıyor → kayıt patlar | Şema | **KRİTİK** | `webhooks/telegram/[hotelSlug]/route.ts:562-572` |
| D2 | `departments` select'inde `name` kolonu yok (`display_name` olmalı) → bildirim sessizce atlanır | Şema | **KRİTİK** | `webhooks/telegram/[hotelSlug]/route.ts:518` |
| D3 | `audit_log` tablosu yok (`hotel_audit_log` olmalı) → her arşiv cron'unda gizli hata | Şema | **KRİTİK** | `api/cron/archive-checked-out/route.ts:86` |
| S5 | Hotel & group JWT'leri aynı secret, `aud`/`typ` claim'i yok → token karışması | Güvenlik | ORTA | `src/middleware.ts:34-79` |
| S6 | `safety-rules`, `knowledge/facts|sections`, `migrations/run`, `central-migrations/run` super_admin kontrolsüz | Güvenlik | ORTA | bkz. detay |
| S7 | Middleware matcher `/api/*`'ı kapsamıyor → tüm koruma route-içi kontrollere bağlı | Güvenlik | ORTA | `src/middleware.ts:246-248` |
| S8 | Webhook secret karşılaştırmaları tutarsız: telegram-manager & manychat düz `!==` (timing) | Güvenlik | ORTA | `webhooks/telegram-manager/...:45`, `manychat/...:52` |
| S9 | Ham `error.message` istemciye dönüyor (bilgi sızıntısı) | Güvenlik | ORTA | birçok route (bkz. detay) |
| H1 | Webhook POST gövdesinin bir kısmı dış try/catch dışında → throw'da 500 + Telegram retry | Error handling | ORTA | `webhooks/telegram/[hotelSlug]/route.ts` |
| H2 | SLA escalation tüm oteller için demo/boş bot token kullanıyor | Error handling | ORTA | `lib/sla/check-runner.ts:24-27` |
| D4 | Auto-archive cron yalnızca legacy `inhouse_guests` güncelliyor, `inhouse_guests_v2`'yi değil | Şema | ORTA | `api/cron/archive-checked-out/route.ts:68-73` |
| D5 | v2 ile doğrulanan misafir için legacy `inhouse_guests` tablosu v2 id ile sorgulanıyor | Şema | ORTA | `webhooks/telegram/[hotelSlug]/route.ts:705-710` |
| D6 | `handle-callback` `.single()` + var olmayan `conversations.language` kolonu | Şema | ORTA | `lib/sla/handle-callback.ts:87-91` |
| H3 | `verification_attempts` insert'i `void` (fire-and-forget) + error kontrolsüz → güvenlik logu sessizce kaybolur | Error handling | ORTA | `webhooks/telegram/[hotelSlug]/route.ts:670` |
| H4 | In-house link `update`'lerinde error kontrolü yok → sonsuz "oda sor" döngüsü riski | Error handling | ORTA | `webhooks/telegram/...:1060-1069,1114-1125`, `manychat/...:138-141` |
| H5 | `inhouse/import` `req.json()` try/catch dışında → bozuk JSON'da 500 | Error handling | ORTA | `hotel-admin/[slug]/inhouse/import/route.ts:231` |
| S10 | `staff/[sid]` PATCH mevcut satırın departmanını doğrulamadan upsert | Güvenlik | ORTA | `api/hotel-admin/staff/[sid]/route.ts:12-59` |
| S11 | `/api/manager/*` super_admin için her zaman demo-hotel DB'sine düşüyor (perplexity hep demo) | Güvenlik/mantık | ORTA | `api/manager/**`, özellikle `perplexity/discover/route.ts:19,68` |
| D7 | İki kanonik hotel şeması (`sql/05_hotel_schema.sql` vs `migrations/tenant/001`) farklı kolonlar | Şema | ORTA | bkz. detay |
| S12 | PostgREST `.or()` filtresine sanitize edilmemiş input enjeksiyonu | Güvenlik | ORTA→DÜŞÜK | `lib/ai/hotel-context.ts:243`, `[slug]/guests/route.ts:41` |
| S13 | Tüm tenant erişimi service-role key ile → RLS tamamen bypass; tek koruma kod | Güvenlik (mimari) | ORTA (bağlam) | `lib/hotel-admin/tenant.ts:69`, `get-hotel-client.ts:35` |
| L1 | `npm run lint` (`next lint`) hiç çalışmıyor — Next 16 `lint` alt komutunu kaldırmış → kalite kapısı yok | Lint | DÜŞÜK | `package.json` |
| S14 | Çeşitli düşük riskli güvenlik noktaları | Güvenlik | DÜŞÜK | bkz. detay |

**TypeScript:** `tsc --noEmit` → **0 hata.** **ESLint:** `npm run lint` (`next lint`) çalışmıyor — Next 16 `lint` alt komutunu kaldırmış (aşağıda L1) → otomatik lint kapısı yok.

> **Önceki taslaktan düzeltmeler (doğrulandı):** (a) Hotel-admin `[slug]` route'ları slug'ı **doğru şekilde** kontrol ediyor (`slug !== admin.hotel_slug → 403`); yatay tenant açığı **yok**. (b) `verification_attempts` (`migrations/tenant/001:547`) ve `pending_guest_matches` (`migrations/tenant/006:35`) **mevcut**. (c) `off_hours_behavior`/`working_hours` kolonları şemada var ve webhook'ta select ediliyor (`route.ts:1697`). Bu üç madde yanlış pozitifti, çıkarıldı.

---

## 1. Güvenlik

### S1 — `.env.production` canlı secret'larla diskte ve gitignore dışında [KRİTİK] — ✅ ÇÖZÜLDÜ (2026-05-31)

**Orijinal sorun:** `git check-ignore .env.production` → rc=1 (ignore EDİLMİYOR). Eski `.gitignore`'daki `.env*.local` deseni `.env.local`'ı yakalıyor ama `.env.production`'ı yakalamıyordu. Dosya gerçek secret'lar içeriyordu (doğrulandı, değerler gösterilmeden): `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY` (219 krk, RLS bypass), `TELEGRAM_WEBHOOK_SECRET` (64), `TELEGRAM_BOT_TOKEN_DEMO`/`TELEGRAM_MANAGER_BOT_TOKEN_DEMO`, `PERPLEXITY_API_KEY`, `CRON_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `VERCEL_OIDC_TOKEN`. Repo'nun bir GitHub remote'u var (`kemalkuyucu/hotelgendigital`), yani tek bir `git add -A` ile push edilebilirdi.

**Risk değerlendirmesi:** Gerçekleşmiş sızıntı DEĞİLDİ. `git log --all -- .env.production` boş → dosya **hiç commit'lenmemiş**; geçmişte yalnızca placeholder içeren `.env.example` şablonları izlenmiş. Bu yüzden git geçmişi yeniden yazmaya (filter-repo) gerek yoktu.

**Yapılan düzeltme:**
1. `.gitignore` güncellendi — dağınık `.env*.local` kuralları tek bloğa indirildi: `.env`, `.env.*`, `!.env.example`, `!**/.env.example`. Artık tüm `.env.*` varyantları otomatik korunuyor, yalnızca `.example` şablonları izleniyor. (Yinelenen eski `.env*.local` satırı da kaldırıldı.)
2. `.env.production` repo **dışına** yedeklendi: `C:\Users\ozgur\env-backups\.env.production.20260531_032152.bak` (git kapsamı dışı), ardından repodan silindi.
3. Doğrulandı: `git check-ignore` → `.env.production` & `.env.local` = IGNORED; `.env.example` = izlenmeye devam. `git status`'ta artık hiçbir `.env` görünmüyor.

**Açık kalan (kullanıcı kararı):** Rotasyon **şimdilik yapılmadı** — repo geçmişi temiz ve secret hiç push edilmediği için güvenli. ⚠️ Repo public yapılırsa veya `.env.production`/yedeğinin paylaşıldığından şüphelenilirse tüm secret'lar rote edilmeli (özellikle DEMO service-role key ve `TELEGRAM_WEBHOOK_SECRET`).

### S2 — JWT secret için sabit kodlu fallback [KRİTİK]
**Konum:** `src/middleware.ts:34-40`, `src/lib/hotel-admin/auth.ts:14-17`, `src/lib/group-admin/auth.ts`.
```ts
const secret = process.env.HOTEL_ADMIN_JWT_SECRET
  ?? process.env.NEXTAUTH_SECRET
  ?? 'hotel-admin-dev-secret-change-in-production'
```
Production'da bu iki env tanımlı değilse JWT'ler herkesçe bilinen literal ile imzalanır → saldırgan istediği `hotel_slug`/`role` ile geçerli `hg_hotel_session`/`group_session` üretip tam yetki alır. **`.env.production` içinde `HOTEL_ADMIN_JWT_SECRET`/`NEXTAUTH_SECRET` YOK** — deploy ortamında set edildiği teyit edilmeli. **[CANLI ENV TEYİDİ]**

**Önerilen düzeltme:** Secret yoksa production'da fail-fast (throw); literal fallback'i yalnızca `NODE_ENV !== 'production'`'da bırak.

### S3 — `admin-users` route'u super_admin guard'ı yok [KRİTİK]
**Konum:** `src/app/api/admin/hotels/[id]/admin-users/route.ts:16` (GET) ve `:46` (POST); `admin-users/[uid]/route.ts` aynı.

Yalnızca `getSessionAdmin()` çağrılıyor; `admin.role !== 'super_admin'` kontrolü **yok**. Kardeş route'lar (`save-credentials:23`, `run-migrations:30`, `create-first-admin:24`, `delete:14`, `hotel-users/*`) bu kontrolü yapıyor — bu ikisi atlamış. POST, bir tenant DB'sine bcrypt parolayla `hotel_admin_users` yazıyor → düşük yetkili bir `admin` rolü **herhangi** bir otele `[id]` vererek hotel_owner hesabı oluşturabilir/listeleyebilir. (Ayrıca bcrypt cost 10 burada, diğer yerlerde 12 — tutarsız.)

**Önerilen düzeltme:** Her iki handler'a `admin.role !== 'super_admin' → 403` ekle; bcrypt cost'u 12'ye eşitle.

### S4 — ManyChat webhook fail-open + düz karşılaştırma [KRİTİK]
**Konum:** `src/app/api/webhooks/manychat/[hotelSlug]/route.ts:49-56`
```ts
const webhookSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
if (webhookSecret) {                       // boş/undefined → blok atlanır
  const sig = req.headers.get('x-manychat-signature') ?? '';
  if (sig !== webhookSecret) return 401;   // düz !== (timing)
}
```
`.env.example`'da `MANYCHAT_WEBHOOK_SECRET=""` (boş). Boşsa `if` falsy → webhook **kimlik doğrulamasız**; herhangi biri sahte misafir mesajı/oda-eşleştirme trafiği POST'layıp AI/token maliyeti üretebilir, tenant DB'sine yazdırabilir (bugün demo ile sınırlı, bkz. `:63`). Telegram tarafı doğru (`verifyTelegramSecret` constant-time).

**Önerilen düzeltme:** Fail-closed (secret yoksa 401); `crypto.timingSafeEqual` ile karşılaştır.

### S5 — Hotel ve group token'ları aynı secret, tip claim'i yok [ORTA]
**Konum:** `src/middleware.ts:34-79` (`verifyHotelToken`/`verifyGroupToken` aynı `getJwtSecret()`). Payload yalnızca cast ediliyor; `aud`/`typ`/`iss` doğrulaması yok. Tek ayrım slug alanının varlığı (group `group_slug` bekler). Token karışması/forge riski.
**Önerilen düzeltme:** Token'lara `typ` (veya `aud`) claim'i ekle ve doğrula; ideali audience başına ayrı secret.

### S6 — Birkaç ayrıcalıklı admin route'unda super_admin kontrolü eksik [ORTA]
Yalnızca `getSessionAdmin()` ile korunan, ama global/tenant yazımı yapan route'lar (super_admin guard'ı yok):
- `api/admin/safety-rules/route.ts:8` ve `safety-rules/[id]` — **tüm** otellere uygulanan sistem güvenlik kurallarını (`system_safety_responses`) yazıyor.
- `api/admin/hotels/[id]/knowledge/facts/route.ts:17` (+`facts/[fid]`, `sections`, `sections/[sid]`) — herhangi bir otelin KB'sini yazıyor.
- `api/admin/migrations/run/route.ts:13`, `central-migrations/run/route.ts:14` (+ `status` uçları) — DDL (`exec_sql`) tetikliyor.

**Önerilen düzeltme:** Hepsine `super_admin` guard'ı.

### S7 — Middleware `/api/*`'ı korumuyor [ORTA — bağlam]
**Konum:** `src/middleware.ts:246-248` matcher yalnızca `/admin`, `/hotel-admin/:slug`, `/group-admin/:slug` **sayfa** yollarını kapsar. `/api/*` tamamen route-içi auth'a bağlı. Mevcut route'lar çoğunlukla kendi kontrolünü yapıyor, ama bu mimaride defense-in-depth yok: tek bir eksik kontrol (S3/S6) = tam açık. Ayrıca middleware `/admin/*` için cookie'yi yalnızca "var mı" diye bakıyor, doğrulamayı sayfa/route `getSessionAdmin()` yapıyor.
**Önerilen düzeltme:** Zorunlu ortak `requireAuth`/`requireTenant` yardımcısı; public uçları (webhook/health/cron) açık beyaz liste.

### S8 — Tutarsız webhook secret karşılaştırması [ORTA]
`webhooks/telegram-manager/[hotelSlug]/route.ts:45` ve `manychat/[hotelSlug]/route.ts:52` düz `!==` kullanıyor (timing). Doğru referans `src/lib/telegram/verify.ts` (constant-time) zaten mevcut.
**Önerilen düzeltme:** Üç webhook'u da `verifyTelegramSecret`/`timingSafeEqual`'a yönlendir.

### S9 — Ham `error.message` yanıtta (bilgi sızıntısı) [ORTA]
`lib/hotel-admin/auth.ts:99` (`'Sunucu hatası: ' + msg`), `hotel-admin/[slug]/inhouse/list/route.ts:122,202,233`, `guests/route.ts:50,108`, `admin/hotels/[id]/save-credentials/route.ts:65,80`, `test-connection/route.ts:76,99` vb. DB iç yapısı/host sızabilir. (Not: düz secret değeri döndüren bir yer **bulunmadı**.)
**Önerilen düzeltme:** İstemciye generic mesaj; ayrıntıyı sunucuda logla.

### S10 — `staff/[sid]` PATCH intra-hotel bütünlük açığı [ORTA]
**Konum:** `api/hotel-admin/staff/[sid]/route.ts:12-59`. PATCH mevcut satırı çekmeden gövdedeki `department_key`'e güveniyor; `upsertStaff` `sid` ile keyli olduğundan, izinli bir `department_key` beyan edip başka departmandaki bir `sid`'i ezebilir. Tenant sınırı güvenli (yalnızca kendi oteli); açık departman-içi bütünlük. (DELETE yolu doğru yapıyor — mevcut satırı çekip `allowed.includes(target.department_key)` kontrol ediyor.)
**Önerilen düzeltme:** Upsert'ten önce `sid`'in mevcut `department_key`'ini çekip `allowed` içinde doğrula.

### S11 — `/api/manager/*` super_admin için hep demo-hotel [ORTA — gizli multi-tenant kusuru]
**Konum:** `api/manager/**`. Pattern: `session.hotel_slug ? resolveTenantBySlug(...) : getDemoHotelSupabase()`. `getManagerOrHotelAdmin()` super_admin için `hotel_slug` döndürmez → tüm manager yüzeyi **yalnızca demo-hotel** üzerinde çalışır. Daha kötüsü `manager/perplexity/discover/route.ts:19,68` `getDemoHotelSupabase()`'i **koşulsuz** çağırıyor — `hotel_slug`'a sahip gerçek bir hotel-admin bile demo otelin verisini okur/yazar. Bugün çapraz sızıntı değil (demo'ya sabit), ama ikinci tenant onboard olunca manager UI hedefleyemez.
**Önerilen düzeltme:** `/api/manager/*` tenant çözümünü tek tipe getir; tenant hedefi olmayan super_admin oturumunu sessizce demo'ya düşürmek yerine reddet.

### S12 — PostgREST `.or()` filtre enjeksiyonu [ORTA→DÜŞÜK]
- `lib/ai/hotel-context.ts:243`: `query.or(\`department_code.is.null,department_code.eq.${departmentHint}\`)` — `departmentHint` sanitize edilmeden interpole. Bugün dahili (departman kodu), ham misafir girdisi değil → düşük sömürülebilirlik; yine de whitelist gerekli.
- `hotel-admin/[slug]/guests/route.ts:41` (+ admin/manager guests sayfaları): `query.or(\`room_number.ilike.%${search}%,last_name.ilike.%${search}%\`)` — `search` admin girdisi; `,`/`)` ile predikat genişletilebilir (yalnızca kendi tenant'ında, read-only). 
**Önerilen düzeltme:** `departmentHint`'i bilinen kod listesine karşı doğrula; `search`'ü sanitize/encode et veya zincirli `.ilike()` kullan.

### S13 — RLS tamamen bypass (service-role) [ORTA — mimari bağlam]
Tüm tenant erişimi service-role key ile yapılıyor (`lib/hotel-admin/tenant.ts:69`, `tenant-by-id.ts:52`, `get-hotel-client.ts:35` default `mode:'service'`); RLS hiç devrede değil. İzolasyon %100 uygulama kodunda. `get-hotel-client.ts` `mode:'anon'` destekliyor ama hiçbir çağıran kullanmıyor. Tarayıcı client'ı (`central-browser.ts`) yalnızca anon — service key tarayıcıya **sızmıyor** (doğrulandı). Sonuç: S3/S6/S10 gibi kod kontrollerinin tek savunma olması riskini büyütür.
**Önerilen düzeltme:** Defense-in-depth olarak tenant DB'lerde RLS + per-tenant policy düşün; en azından zorunlu `requireTenant` yardımcısı.

### S14 — Düşük riskli noktalar [DÜŞÜK]
- `src/middleware.ts:131`: `!pathname.startsWith('/admin/login')` → `/admin/login/<x>` korumasız sayılır; segment-bazlı eşleştirme kullan.
- `next.config.ts`: CSP/HSTS gibi güvenlik header'ları yok.
- `seed-bridge-credentials/route.ts:23`: bootstrap token düz `!==` (constant-time değil); token demo ile sınırlı ama `.env.production`'da (S1).
- Webhook genelinde misafir mesaj kesitleri ve telegram ID'leri (PII) `console.log`'lanıyor.

---

## 2. Error Handling

### H1 — Webhook POST gövdesinin bir kısmı dış try/catch dışında [ORTA]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts`. `handleMessage` try/catch'li ve hatada ön büroya "🔴 BOT HATASI" gönderiyor (iyi). Ancak öncesindeki secret kontrolü, `getHotelBySlug`, token/client çözümü, `callback_query` ve resepsiyon-reply işleyicileri bu sarmalın **dışında**; burada throw 500 döndürür → Telegram retry fırtınası (webhook daima 200 dönmeli).
**Önerilen düzeltme:** Tüm POST gövdesini try/catch'e al, işlenen update'ler için her durumda 200 dön.

### H2 — SLA escalation yanlış/boş bot token [ORTA — fonksiyonel]
**Konum:** `lib/sla/check-runner.ts:24-27`
```ts
function getBotTokenForHotel(_hotelId: string): string {
  return process.env.TELEGRAM_BOT_TOKEN_DEMO ?? '';   // tüm oteller için demo/boş
}
```
Demo dışı oteller için escalation yanlış gruba gider veya hiç gitmez. Yorumda da "production'da decrypt edilecek" yazıyor ama uygulanmamış.
**Önerilen düzeltme:** Webhook'taki gibi `getDecryptedBridge(hotelId).telegramBotToken` ile otel-başına token çöz.

### H3 — `verification_attempts` insert'i fire-and-forget + error kontrolsüz [ORTA]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts:670` — `void supa.from('verification_attempts').insert({...})`. Tablo mevcut (001:547) ama `void` + error yok → insert hatası (RLS/kolon) sessizce yutulur. Başarısız kimlik-doğrulama denemeleri güvenlik açısından kaydı önemli.
**Önerilen düzeltme:** `await` + `if (error) console.error`.

### H4 — In-house link `update`'lerinde error kontrolü yok [ORTA]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts:1060-1069, 1114-1125` (`inhouse_guests_v2.update({telegram_id})` ve `conversations.update({inhouse_match_guest_id})`); `manychat/[hotelSlug]/route.ts:138-141` aynısı. Link yazımı başarısız olursa misafir "hoş geldiniz" alır ama bağ kurulmaz → her mesajda tekrar oda sorulur (sonsuz döngü).
**Önerilen düzeltme:** `const { error }` kontrol et, başarısızsa misafire tekrar dene mesajı ver.

### H5 — `inhouse/import` `req.json()` try/catch dışında [ORTA]
**Konum:** `hotel-admin/[slug]/inhouse/import/route.ts:231` — `req.json()` try bloğundan (249) önce. Bozuk JSON → unhandled rejection → 500 + olası stack. (Aynı dosyadaki diğer işler doğru sarılmış.)
**Önerilen düzeltme:** `req.json()`'ı try/catch'e al, 400 dön.

### H6 — Sessiz/yutan catch'ler [DÜŞÜK]
- `lib/hotel-admin/auth.ts:188-190`: `getManagerOrHotelAdmin` manager-session dalı tüm hataları sessizce yutuyor; gerçek DB hatası gizlenebilir. `last_login_at` güncellemeleri de fire-and-forget.
- `inhouse/import/route.ts:459`: `catch { /* ignore */ }` — başarısızlık geçmişi yazılamazsa tamamen yutuluyor.
- `admin-users`, `documents/[id]/process|reparse`, `staff` route'larında `catch(()=>{})` audit/log "best-effort" çağrılarında — veri-yazımı değilse kabul edilebilir, ama audit yollarında `console.warn` eklenmeli.

**İyi yapılmış (referans):** Webhook ana akışı (`handleMessage` try/catch, `req.json()` korumalı, AI çağrısı try/catch, allergen-notify her gönderimde sent/failed log), `manager/login` (tam try/catch + rate-limit + generic mesaj + `.maybeSingle`/0-satır guard), `inhouse/list` `fetchLastNotifications` (graceful error→boş map).

---

## 3. Supabase Şema / Sorgu Tutarsızlıkları

> **Mimari kök neden:** İki ayrı kanonik hotel şeması var — onboarding'de elle uygulanan `sql/05_hotel_schema.sql` ile artımlı `migrations/tenant/NNN_*.sql` (runner yalnızca `migrations/tenant/`'ı okur). İkisi farklı kolonlar içeriyor (bkz. D7). Aşağıdaki KRİTİK kolon-uyuşmazlıkları bu ikilikten bağımsız olarak **her iki şemada da** hata verir.

### D1 — `forwarded_messages` insert'inde var olmayan kolonlar [KRİTİK]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts:562-572` (`notifyFrontDeskUnverified`)
```ts
await params.hotelSupabase.from('forwarded_messages').insert({
  conversation_id, department_code, target_type, target_chat_id,
  message_html, sent_at, source_department, target_department, status,
});
```
Şema (001:264-276) kolonları: `ai_intent_id, target_department, target_chat_id, telegram_message_id, status, error, created_at, is_off_hours, source_department, target_type`. **`conversation_id`, `department_code`, `message_html`, `sent_at` YOK** (doğrulandı). Insert PostgREST `PGRST204` ile patlar; çağrı await'li ve kilitli-doğrulama akışında throw eder.
**Önerilen düzeltme:** Insert'i şemaya uydur (geçersiz kolonları kaldır ya da migration ile ekle) ve try/catch'e al.

### D2 — `departments.name` kolonu yok [KRİTİK]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts:518` — `.select('telegram_chat_id, name').eq('code','front_office')`. Şemada kolon `display_name` (001 ve 05). Select hata verir → `dept` null → doğrulanmamış-misafir bildirimi yanlış nedenle atlanır. Kodun her yeri başka yerde doğru `display_name` kullanıyor (1697, handle-callback 178/199).
**Önerilen düzeltme:** `name` → `display_name`.

### D3 — `audit_log` tablosu yok [KRİTİK]
**Konum:** `api/cron/archive-checked-out/route.ts:86` — `.from('audit_log').insert(...)`. Doğru tablo `hotel_audit_log` (001:228, 05:633). Insert hata verir; dış try/catch (92) yutar → audit kaydı hiç oluşmaz, her cron çalışmasında gizli hata.
**Önerilen düzeltme:** `audit_log` → `hotel_audit_log`; kolonları (`actor_type, action, details`) şemaya uydur.

### D4 — Auto-archive cron v2'yi atlıyor [ORTA]
**Konum:** `api/cron/archive-checked-out/route.ts:68-73` — yalnızca legacy `inhouse_guests` (`is_active=false`) güncelliyor. Aktif misafir kaynağı `inhouse_guests_v2` (`status`/`check_out_date`). v2 kayıtları otomatik arşivlenmiyor → checkout sonrası v2 misafiri "active" kaldığından persistent-verify (route.ts:~1813 v2 okur) hatalı geçerli sayabilir.
**Önerilen düzeltme:** Cron'u `inhouse_guests_v2` (`status='active'→'archived'`, `check_out_date < today`) üzerinde de çalıştır.

### D5 — v2 misafir id'si ile legacy tablo sorgusu [ORTA]
**Konum:** `webhooks/telegram/[hotelSlug]/route.ts:705-710`
```ts
const { data: gRec } = await supa.from('inhouse_guests')        // LEGACY
  .select('id, first_name, last_name, room_number, language, gender')
  .eq('id', result.guestId).maybeSingle();                       // guestId v2'den geldi
```
`verifyGuest` öncelikle `inhouse_guests_v2`'den `guestId` döndürür; farklı tabloların id'leri eşleşmez → `gRec` null, `verifiedGuestRecord` boş; forward mesajında misafir adı/odası kaybolup Telegram profil adına düşer.
**Önerilen düzeltme:** guestId v2'den geldiyse `inhouse_guests_v2`'yi sorgula, ya da `verifyGuest`'in döndürdüğü kaydı doğrudan kullan.

### D6 — `handle-callback` `.single()` + var olmayan `conversations.language` [ORTA]
**Konum:** `lib/sla/handle-callback.ts:87-91` — `.from('conversations').select('telegram_chat_id, language').eq('id', ...).single()`. `conversations` şemasında `language` kolonu **yok** (doğrulandı: 001'de conversations.language tanımlı değil) → select hatası; ayrıca conversation yoksa `.single()` throw eder.
**Önerilen düzeltme:** `language`'ı kaldır; `.maybeSingle()` kullan.

### D7 — İki kanonik hotel şeması ayrışıyor [ORTA] — ✅ ÇÖZÜLDÜ 2026-06-01 (A15)
`sql/05_hotel_schema.sql` (elle bootstrap) ile `migrations/tenant/001_initial_schema.sql` aynı tabloları farklı kolonlarla tanımlıyor (ör. `departments.telegram_chat_id`/`reception_sla_minutes`/`holidays` yalnızca 001'de; `inhouse_guests` kolonları da farklı). Hangi dosyayla provision edildiğine göre kod farklı kolon-yok hatalarına düşebilir. `supabase/migrations/hotel/` altında da örtüşen ayrı bir set var (`11a_sla_setup.sql` `reception_sla_minutes`'i 5 default ile ekliyor vb.).

**ÇÖZÜM (A15, 2026-06-01):** Drift'in yalnızca DOSYA düzeyinde olduğu, CANLI DB'lerde olmadığı kanıtlandı. Salt-okunur probe (schema_migrations + OpenAPI introspection) iki canlı tenant'ta da çalıştırıldı:
- **demo-hotel** ve **green-park-test**: `departments` / `department_staff` / `document_chunks` / `conversation_summary` tablolarının tümü **001-zinciri şeklinde** (telegram_chat_id, reception_sla_minutes, holidays, department_key, conversation_id-anahtarlı summary vb. mevcut). `sql/05` şekli **hiçbir canlı DB'de yok** → **DRIFT YOK.** İkisi de `migrations/tenant/001→017` ile kurulmuş (007 skip, beklenen).
- **Aksiyon:** Tek otorite = `migrations/tenant/*`. Eski `sql/0x` hotel-tarafı dosyalar (05,06,07,09,09b,10,11,12) DB değiştirmeden başlarına DEPRECATED/ARŞİV notu eklenerek arşivlendi (silinmedi). Hiçbir runtime migration gerekmedi (additive ADD COLUMN'lar zaten no-op olurdu).
- **Tek canlı fark (D7 dışı):** `match_documents()` RPC demo-hotel'de var, green-park-test'te yok → Phase C / RAG takip maddesi (şema sorunu değil). DEVIR_NOTU'da izleniyor.

### Doğrulanan (sorun YOK)
`verification_attempts`, `pending_guest_matches`, `perplexity_discoveries`, `knowledge_sections`, `hotel_facts`, `guest_allergens`, `sla_events`, `late_checkout_notifications`, `inhouse_guests_v2`, `conversations.{verification_*, multi_match_*, inhouse_match_guest_id}` migration'larda mevcut. v2 (`guest_name/room_number/status/check_out_date/telegram_id/whatsapp_id`) ve legacy kolon kullanımları doğru. `off_hours_behavior`/`working_hours` şemada var ve `route.ts:1697`'de select ediliyor.

---

## 4. TypeScript / Lint

- **`tsc --noEmit`: 0 hata.** Aksiyon gerekmiyor.
- **`next lint`: çalışmıyor (L1)** — `package.json`'daki `lint` script'i `next lint`. Hem `npm run lint` hem `npx next lint` aynı hatayı veriyor: `Invalid project directory provided, no such directory: ...\lint`. Yani **Next.js 16 `next lint` alt komutunu kaldırmış**; `next` artık `lint` kelimesini bir proje-dizini argümanı sanıyor. Sonuç: `npm run lint` hiçbir zaman kod denetlemiyor → otomatik lint kalite kapısı yok. (`eslint` + `eslint-config-next` `package.json`'da kurulu ama bağlı bir komut yok.)
  - **Doğruluk notu:** Spesifik kural ihlalleri ölçülemedi çünkü linter hiç çalışmadı. `next.config.ts` temiz (yalnızca `serverActions.bodySizeLimit` ve `images.remotePatterns`); build sırasında lint'i atlayan bir ayar **yok**.
  - **Önerilen düzeltme:** `lint` script'ini doğrudan ESLint CLI'ya geçir (`eslint .` + flat config'de `@next/eslint-plugin-next`) ki lint gerçekten çalışsın.

---

## Öncelikli Aksiyon Sırası
1. **S1** — `.env.production`'ı `.gitignore`'a ekle + (gerçek değer varsa) tüm secret'ları rotate et.
2. **S2** — JWT secret fail-fast; literal fallback'i kaldır + deploy env'de set olduğunu doğrula.
3. **S3 / S6** — `admin-users` ve diğer ayrıcalıklı admin route'larına `super_admin` guard'ı.
4. **S4 / S8** — ManyChat webhook fail-closed + üç webhook'ta timing-safe karşılaştırma.
5. **D1 / D2 / D3** — `forwarded_messages` insert, `departments.name→display_name`, `audit_log→hotel_audit_log` kolon/tablo hizalaması (çalışmayan/sessiz patlayan yazımlar).
6. **H1 / H3 / H4** — Webhook dış try/catch; `verification_attempts` ve link update'lerinde error kontrolü.
7. **H2 / D5 / D4** — SLA token decrypt; v2 id↔tablo hizalaması; arşiv cron'u v2'ye genişlet.
8. **D7** — Şema ikiliğini gider (kalıcı drift kaynağı). ✅ ÇÖZÜLDÜ 2026-06-01 (A15): canlı probe → drift YOK; `sql/0x` arşivlendi, tek otorite `migrations/tenant/*`.
