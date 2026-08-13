# DURUM — HotelGen Digital

Bu dosya **oturumlar arası devir belgesidir**: "şu an neredeyiz, neye dokunuldu,
sonraki oturum nereden devam eder". Teknik ayrıntı ve kalıcı kurallar `CLAUDE.md`
içindedir — **çelişki halinde CLAUDE.md kazanır.**

Son güncelleme: **2026-08-13 (31. oturum)**

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
| **HEAD** | `6611198` + doc | 31. oturum (`4040976` purge_hold toggle · `50b6f1d` cron secret · `f39b968` health-check · `6611198` otomatik purge KAPALI) |
| **PROD (deploy)** | `b6ef712` | 28. oturum (CSP enforce) — `dpl_7waBxtk6bwUTtjcgkhLg7PHfE6ww` |
| **origin** | `6c6dcec` | 29. otu ölçümü; 29 + 30 + 31. oturum commit'leri **PUSH BEKLİYOR** |

**HEAD > PROD kasıtlıdır.** 29. oturum (DB-katman/araç/doc) ve 30. oturumun DB
katmanı deploy gerektirmez; 30 + 31. oturumun **API route'ları + panel UI +
vercel.json + cron auth + health-check** kısmı ise **runtime'dır ve deploy
BEKLİYOR** (bilinçli olarak yapılmadı).

### ⚠ Deploy sırası (31. otu — bağlayıcı)

1. **Central'da `migrations/central/012` koş.** Aksi halde `/admin/hotels`
   sayfası `purge_hold`'u SELECT ettiği için **boş liste** gösterir.
2. **Vercel env'de `CRON_SECRET` dolu mu, teyit et.** Cron auth artık
   **FAIL-CLOSED**: secret yoksa **üç cron da 500** döner.
3. İsteğe bağlı: `HEALTHCHECK_TENANT_SLUG` (yoksa otel probe'u atlanır — bu
   zaten 503'ü kapatan davranış).
4. **`PURGE_AUTO_ENABLED` KASITLI OLARAK BOŞ BIRAKILIR** — otomatik silme
   kapalı doğsun.
5. Ancak bundan sonra `vercel --prod`.

**Otomatik purge KAPALI** (`vercel.json` cron yok + `PURGE_AUTO_ENABLED` unset).
Açmak için: env `true` + cron girdisini geri ekle + deploy.

Push, Kemal'in kendi terminalinde yapılır (bu ortamda credential helper asılıyor)
ve sonucu **`git status` ile değil `git ls-remote` ile** doğrulanır.

## 5. Aktif görevler / bekleyen işler

**Hemen sırada (30 + 31. oturumun kapanışı):**
1. **`migrations/central/012` Central PROD SQL Editor'da koşulacak** — Kemal.
   Yerelde Central kimlikleri yok, ajan koşamadı. Koşulmadan purge çalışmaz
   (`purge_hold` ve `hotel_purge_log` yok → cron 500/`db_error` verir) **ve
   `/admin/hotels` boş liste gösterir**.
2. ~~**Vercel cron limiti kararı**~~ — **31. otu'da KAPANDI.** Vercel Ocak
   2026'da limiti **her planda proje başına 100**'e çıkardı; hesap **PRO**,
   `15 3 * * *` günde bir. `vercel.json` **aynen kalıyor**, piggyback gerekmez.
3. **`CRON_SECRET` Vercel env'inde dolu mu?** Cron auth artık FAIL-CLOSED —
   secret yoksa üç cron da 500 döner. **Önce env, sonra deploy.**
4. **Deploy** — panel + cron + API route'lar + health-check runtime'dır,
   `vercel --prod` gerekir.
5. **Canlı UAT** — geri sayım rozeti, `purge_hold` toggle'ı, "Kalıcı Sil"
   akışı, cron `?dryRun=1`, `/api/health-check`in gerçekten 200 dönmesi.

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
2. Kemal 012'yi koştu mu? Koştuysa `?dryRun=1` ile cron'u **canlı** ölç
   (silme yok, yalnız kuyruk raporu) — bu, purge'ün ilk gerçek kanıtıdır.
3. **Önce `CRON_SECRET` env teyidi, sonra deploy** (fail-closed).
4. Deploy + canlı UAT, sonra CLAUDE.md'ye "canlı doğrulandı" satırını işle.
5. Sıradaki açık iş: **verification parse kök nedeni**. Onun yanında hazır
   duran ikinci iş: `demo-hotel` B-kovası (ManyChat webhook'u demo dışı her
   otelde 500 döner; `send-telegram` demo dışı token bulamaz).

**Uyarı:** Bu dosya ile CLAUDE.md ayrı commit'lerde güncellenir; biri atlanırsa
harita sessizce bayatlar (19. ve 22-23. oturumlarda yaşandı). Sevkle aynı oturumda
kapat.
