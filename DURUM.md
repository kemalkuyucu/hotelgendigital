# DURUM — HotelGen Digital

Bu dosya **oturumlar arası devir belgesidir**: "şu an neredeyiz, neye dokunuldu,
sonraki oturum nereden devam eder". Teknik ayrıntı ve kalıcı kurallar `CLAUDE.md`
içindedir — **çelişki halinde CLAUDE.md kazanır.**

Son güncelleme: **2026-08-14 (31. oturum, deploy sonrası)**

---

## 1. Proje

Çok kiracılı (multi-tenant) otel misafir-asistanı SaaS. Misafir Telegram/ManyChat
üzerinden yazar; Claude tabanlı orkestratör otelin bilgi tabanından yanıtlar,
misafir doğrulaması yapar, eyleme dönük talepleri ilgili departmana Telegram'dan
iletir ve SLA takibi yapar. Personel/sahip yönetimi rol bazlı panellerden.

- **Central DB** (bizim) → `hotels`, `packages`, `bridge_credentials`,
  `channel_routing`, `audit_log`, `master_admins`, grup-admin tabloları.
- **Her otelin KENDİ Supabase projesi** → misafir, konuşma, talep, bilgi, SLA.
  İzolasyon `hotel_id` filtresiyle değil, **ayrı DB** ile sağlanır.
- Kod ve misafire giden tüm metinler **Türkçe**; misafir TR/EN/DE/RU/AR görür.

## 2. Yığın (package.json'dan ölçüldü)

| Katman | Sürüm / değer |
|---|---|
| Next.js | **16.3.0** (App Router) |
| React | 19.2.3 |
| TypeScript | ^5 |
| supabase-js | ^2.98.0 |
| Hosting | Vercel — `hotelgen-v2.vercel.app` |
| Sevk hedefi repo | `kemalkuyucu/hotelgendigital` (`qltydigital-hub` bir KOPYADIR, prod'u beslemez) |
| Aktif dal | `hotelgen-v4` |

## 3. Kilitli modeller (koddan ölçüldü, hafızadan değil)

| Rol | Model ID | Yer |
|---|---|---|
| Orkestratör (varsayılan) | `claude-sonnet-4-6` | `src/lib/ai/anthropic-client.ts:72` |
| Güvenlik ön-sınıflandırıcı | `claude-haiku-4-5-20251001` | `src/lib/ai/safety-classifier.ts:15` |
| OpenAI toggle (alternatif) | `gpt-5.4` / `gpt-5.4-mini` | `anthropic-client.ts:47-48` |

`AI_PROVIDER=openai` env'i sağlayıcıyı komple değiştirir (`anthropic-client.ts:38`).
**Rapor botu `@hotel_yonetici_rapor_bot` (id 8504961295) — ASLA DOKUNULMAZ.**

## 4. Sürüm durumu

| | Commit | Not |
|---|---|---|
| **HEAD** | `04db5c4` + doc | 31. oturum (`4040976` purge_hold toggle · `50b6f1d` cron secret · `f39b968` health-check · `6611198` otomatik purge KAPALI · `04db5c4` geri sayım sunumu TEK KAYNAK) |
| **PROD (deploy)** | `70c877e` | **13.08.2026**, `vercel --prod`, Ready, alias `hotelgen-v2.vercel.app` — 30 + 31. oturumun runtime kodu CANLI |
| **origin** | `49053dc` | **13.08.2026** Kemal ölçümü (iki push): 29 + 30 + 31. oturumun **ilk üç** commit'i İÇERİDE. PROD (`70c877e`) origin'in ÖNÜNDE — rollback için önce push |

**30 + 31. oturumun DEPLOY BORCU KAPANDI** (13.08.2026 → `70c877e`): panel UI,
API route'ları, cron auth, health-check ve **otomatik purge kilitlerinin ikisi de**
canlıda. `migrations/central/012` de koşuldu (**çıkarım**: panel `purge_hold`
kolonunu SELECT edip satırları render etti; `information_schema` teyidi yok).

**Kalan deploy borcu = yalnız `04db5c4`** (Commit H — migrations panelinin geri
sayım metni; canlı UAT'ta bulunan defektin düzeltmesi).

### Canlı UAT sonucu (13.08.2026, PROD `70c877e`)

| Sayfa | Sonuç |
|---|---|
| `/admin/hotels` > Silinmiş | **DOĞRU** — otomatik silme kapalı sunumu ("… gün sonra kalıcı silinebilir", nötr ton) |
| `/admin/migrations` > Silinmiş | **DEFEKTLİ** — hâlâ "30 gün kaldı" diyordu → `04db5c4` düzeltir, **canlıda doğrulanmadı** |

**Hâlâ ölçülmedi:** iki cron'un fail-closed auth yolu (`CRON_SECRET` doluluğu),
`/api/health-check`in 200'e dönüp dönmediği, `?dryRun=1` çıktısı.

### ⚠ Sonraki deploy

1. `vercel --prod` (tek runtime commit: `04db5c4`).
2. `/admin/migrations > Silinmiş` metnini **gözle doğrula**.
3. `PURGE_AUTO_ENABLED` **kasıtlı olarak boş** kalır.

**Otomatik purge KAPALI** (`vercel.json` cron yok + `PURGE_AUTO_ENABLED` unset).
Açmak için: env `true` + cron girdisini geri ekle + deploy.

**PUSH BEKLEYEN — `6611198` · `326eb85` · `70c877e` · `04db5c4` (Commit H) + bu doc commit'i.**
**DİKKAT: PROD (`70c877e`) origin'de YOK** → git üzerinden rollback şu an KAPALI; push bunu açar.

> **Kalıcı not — origin değeri bu ortamdan GÖRÜLEMEZ** (credential helper asılır).
> `git ls-remote origin hotelgen-v4` çıktısı **tek geçerli kaynaktır**; yukarıdaki
> hash Kemal'in **son bildirdiği ölçümdür** ve tarihiyle yazılır. `git status`ın
> tracking ref'i bayat kalabilir — ona bakma.

Push, Kemal'in kendi terminalinde yapılır.

## 5. Aktif görevler / bekleyen işler

**Hemen sırada (30 + 31. oturumun kapanışı):**
1. ~~**`migrations/central/012` koşulacak**~~ — **13.08.2026 KOŞULDU** (çıkarım:
   panel `purge_hold` SELECT'i satır döndürdü). Doğrudan `information_schema`
   teyidi hâlâ yok.
2. ~~**Vercel cron limiti kararı**~~ — **31. otu'da KAPANDI.** Vercel Ocak
   2026'da limiti **her planda proje başına 100**'e çıkardı; hesap **PRO**,
   `15 3 * * *` günde bir. `vercel.json` **aynen kalıyor**, piggyback gerekmez.
3. **`CRON_SECRET` Vercel env'inde dolu mu?** Cron auth FAIL-CLOSED — secret
   yoksa cron route'ları 500 döner. Deploy edildi ama **ÖLÇÜLMEDİ**.
4. ~~**Deploy**~~ — **13.08.2026 YAPILDI** (`70c877e`). Kalan tek runtime
   commit: `04db5c4`.
5. **Canlı UAT (kısmi yapıldı)** — Oteller sayfası doğru çıktı, migrations
   sayfası defektliydi (`04db5c4` düzeltir). Hâlâ açık: `"Kalıcı Sil"` akışı,
   cron `?dryRun=1`, `/api/health-check`in gerçekten 200 dönmesi.

**Devam eden borçlar (CLAUDE.md §7 tam liste):**
- verification parse kök nedeni: `ROOM_REGEX` prefix'i opsiyonel → serbest metindeki
  her 2-4 haneli sayı oda adayı (SIRADAKİ AÇIK İŞ).
- CSP canlı UAT: authed paneller, iki srcDoc aracı, `[csp-report]` prod verisi.
- 26. otu 23505 backstop dalı prod'da henüz tetiklenmedi.
- AI bütçe/harcama limiti (Anthropic + OpenAI) **kurulmadı** — Kemal'in eli.
- Tenant migration yayılımı: 030/031/032 yalnız v5 (+demo) tenant'ında.

## 6. Bu oturumun (30) kararları

- **Retention eşiği KODDA, tek kaynak:** `src/lib/hotels/retention.ts`
  (`PURGE_RETENTION_DAYS = 30`). Cron, panel rozeti ve manuel purge guard'ı
  **aynı** fonksiyonu çağırır; ikinci bir aritmetik kopyası yasak.
- **Aritmetik saf UTC ms** — takvim parçası (`setDate`) kullanılmaz, DST'de kaymaz.
- **FAIL-SAFE yön:** okunamayan `deleted_at` asla purge tetiklemez. Bu, rate-limit
  gibi kapıların fail-OPEN'ının tersi değil — orada en kötüsü fazladan mesaj,
  burada **geri alınamaz veri kaybı**.
- **Cron FAIL-CLOSED:** `CRON_SECRET` yoksa 500 ve hiçbir şey silinmez.
- **Transaction yok → mezar taşı önce:** `hotel_purge_log` satırı silmeden ÖNCE
  `note='planned'` ile yazılır; süreç yarıda kalırsa geride iz kalır.
- **`audit_log` SİLİNMEZ**, yalnız `hotel_id` NULL'lanır — denetim izi korunur.
- **Tenant Supabase projesi silinmez** (Management API işi); proje referansı
  log'a yazılır ve panelde "elle silinecek" uyarısı gösterilir.
- **Batch cap 5**, aşan slug'lar WARN loglanır + yanıtta `deferred` olarak döner
  (sessiz kırpma yasak).
- **Onboarding kitine literal tablo adı EKLENMEDİ:** `central_hardening.sql`
  katalog güdümlüdür (sweep), `hotel_purge_log`'u zaten kapsar.

## 6b. Bu oturumun (31) kararları

- **Slug onayı GERİ ALINAMAZ işlemler içindir.** `purge` `confirmSlug` ister;
  `purge_hold` toggle'ı **istemez** — yanlış basan admin aynı düğmeye tekrar
  basar. Pahalı bir onay, acil-durum freninin hiç kullanılmamasına yol açar.
- **Kilit panelden çevrilebilmeli.** Central kimlikleri yalnız prod'da; "SQL
  ile çevirirsin" demek, geri alınamaz silmenin önündeki tek freni erişilemez
  kılmaktı.
- **Hold açıkken rozet NÖTR.** Gün sayısı işlemeye devam eder (`deleted_at`'e
  dokunulmaz) ama cron atlar → kırmızı/amber "birazdan silinecek" yalan olurdu.
- **Cron auth FAIL-CLOSED ve 401 değil 500.** Eksik olan çağıranın yetkisi
  değil sunucunun yapılandırmasıdır. Bu yön rate-limit/dedup'ın fail-OPEN'ının
  tersidir (orada en kötüsü fazladan mesaj).
- **Sağlık probe'u tenant literali taşımaz.** Env'den gelir; env yoksa probe
  **atlanır** (`skipped`), FAIL üretmez. Kalıcı sarı bayrak gerçek arızayı
  maskeler.
- **Panel sunumu da TEK KAYNAK olmak zorunda.** Geri sayım metni/tonu iki
  panelde ayrı yazılmıştı; otomatik silme kapatılınca yalnız biri düzeldi ve
  `/admin/migrations` kimse silmeyecekken "30 gün kaldı" demeye devam etti
  (**canlı UAT yakaladı, tsc/build yakalayamazdı**). Karar artık ortak
  bileşende: `src/components/admin/PurgeCountdown.tsx`.
- **`demo-hotel` hardcode envanteri çıkarıldı, TEMİZLİK YAPILMADI** (16 kod
  sitesi; A-kovası "sessiz yanlış tenant fallback'i" **boş**). Ayrıntı
  CLAUDE.md §7.
- **Otomatik purge KAPALI doğar (iki bağımsız kilit).** Purge, tenant'ın
  Supabase **projesini silmiyor** → otomasyonun faydası düşük, hatası geri
  alınamaz. Geri sayım ve **elle** "Kalıcı Sil" kalır; panel kapalıyken
  "silinecek" demez, "**silinebilir**" der ve hold toggle'ını gizler.

## 7. Sonraki oturum buradan

1. `npm run doctor` koş — yeşil olmalı (31. otu sonu: tsc 0 · is8 **2190/2190,
   21 dosya** · şema 46/47 · marka 13 allowlisted / 0 unexpected).
2. **`04db5c4`'ü deploy et** ve `/admin/migrations > Silinmiş` metnini gözle
   doğrula (bu oturumun açık tek runtime borcu).
3. **Push** — PROD şu an origin'in ÖNÜNDE, git üzerinden rollback KAPALI.
4. `?dryRun=1` ile purge kuyruğunu **canlı** ölç (silme yok; otomatik purge
   kapalı olduğu için yanıt `mode:'disabled'` dönmeli — ilk gerçek kanıt bu) ve
   `/api/health-check`in artık 200 döndüğünü teyit et.
5. Sıradaki açık iş: **verification parse kök nedeni**. Onun yanında hazır
   duran ikinci iş: `demo-hotel` B-kovası (ManyChat webhook'u demo dışı her
   otelde 500 döner; `send-telegram` demo dışı token bulamaz).

**Uyarı:** Bu dosya ile CLAUDE.md ayrı commit'lerde güncellenir; biri atlanırsa
harita sessizce bayatlar (19. ve 22-23. oturumlarda yaşandı). Sevkle aynı oturumda
kapat.
