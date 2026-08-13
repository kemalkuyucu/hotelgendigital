# DURUM — HotelGen Digital

Bu dosya **oturumlar arası devir belgesidir**: "şu an neredeyiz, neye dokunuldu,
sonraki oturum nereden devam eder". Teknik ayrıntı ve kalıcı kurallar `CLAUDE.md`
içindedir — **çelişki halinde CLAUDE.md kazanır.**

Son güncelleme: **2026-08-13 (30. oturum)**

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
| **HEAD** | `2845eb2` | 30. oturum (purge panel) |
| **PROD (deploy)** | `b6ef712` | 28. oturum (CSP enforce) — `dpl_7waBxtk6bwUTtjcgkhLg7PHfE6ww` |
| **origin** | `6c6dcec` | 29. otu ölçümü; 29 + 30. oturum commit'leri **PUSH BEKLİYOR** |

**HEAD > PROD kasıtlıdır.** 29. oturum (DB-katman/araç/doc) ve 30. oturumun DB
katmanı deploy gerektirmez; 30. oturumun **API route + panel UI + vercel.json**
kısmı ise **runtime'dır ve deploy BEKLİYOR** (bu oturumda bilinçli olarak
yapılmadı).

Push, Kemal'in kendi terminalinde yapılır (bu ortamda credential helper asılıyor)
ve sonucu **`git status` ile değil `git ls-remote` ile** doğrulanır.

## 5. Aktif görevler / bekleyen işler

**Hemen sırada (30. oturumun kapanışı):**
1. **`migrations/central/012` Central PROD SQL Editor'da koşulacak** — Kemal.
   Yerelde Central kimlikleri yok, ajan koşamadı. Koşulmadan purge çalışmaz
   (`purge_hold` ve `hotel_purge_log` yok → cron 500/`db_error` verir).
2. **Vercel cron limiti kararı** — `vercel.json` artık **3 cron** taşıyor;
   Hobby planı **2** ile sınırlı. Plan Pro değilse ya plan yükseltilecek ya da
   purge, `cron/health-check` içine piggyback edilecek (SLA taramasında olduğu gibi).
3. **Deploy** — panel + cron + API route runtime'dır, `vercel --prod` gerekir.
4. **Canlı UAT** — geri sayım rozeti, "Kalıcı Sil" akışı, cron `?dryRun=1`.

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

## 7. Sonraki oturum buradan

1. `npm run doctor` koş — yeşil olmalı (30. otu sonu: tsc 0 · is8 **2143/2143,
   20 dosya** · şema 46/47 · marka 0 unexpected).
2. Kemal 012'yi koştu mu? Koştuysa `?dryRun=1` ile cron'u **canlı** ölç
   (silme yok, yalnız kuyruk raporu) — bu, purge'ün ilk gerçek kanıtıdır.
3. Cron limiti kararını uygula (plan mı, piggyback mı).
4. Deploy + canlı UAT, sonra CLAUDE.md'ye "canlı doğrulandı" satırını işle.
5. Ondan sonra sıradaki açık iş: **verification parse kök nedeni**.

**Uyarı:** Bu dosya ile CLAUDE.md ayrı commit'lerde güncellenir; biri atlanırsa
harita sessizce bayatlar (19. ve 22-23. oturumlarda yaşandı). Sevkle aynı oturumda
kapat.
