# CLAUDE.md — HotelGen Digital

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 0. ONCE OKU
- Bu dosya her oturumda okunur. Talimat disina cikma.
- Teshis ve karar Claude'da (sohbet tarafinda). Sen talimati uygularsin.
- Talimatta olmayan "iyilestirme" YAPMA. Gordugun bozuklugu RAPORLA, duzeltme.
- Bu dosya **27. oturum sonrasi** durumu yansitir; sohbet tarafindaki
  **DEVIR + MASTER (v41)** ile hizalidir.
- **27. OTURUM — DB-KATMAN HARDENING (RLS defense-in-depth) (ozet).** SALT-OKUMA
  recon **CANLI bir acik** buldu: tenant DB'lerinde `anon` anahtari **45 tabloda
  tam CRUD** (RLS yok + anon/authenticated'e blanket grant) yapabiliyor VE
  `exec_sql` (SECURITY DEFINER, owner=postgres) **anon/authenticated'e acik**
  oldugu icin anon anahtariyla **postgres-yetkili KEYFI SQL** kosulabiliyordu.
  **Kok neden:** Supabase'in `public` semada anon+authenticated'e otomatik verdigi
  **default-privilege grant'lari**; bootstrap'in `REVOKE ... FROM PUBLIC`u bu iki
  AYRI grant'i temizlemiyor. **CANLI KANIT (demo anon key):** `inhouse_guests_v2`
  ONCE **20 satir okundu** -> SONRA **permission denied**; `exec_sql('SELECT 1')`
  ONCE **CALISTI** -> SONRA **42501**. Cozum: **migration 032** (tenant) +
  **central-011** (Central) — `REVOKE ALL ... FROM PUBLIC, anon, authenticated`
  (tablo+sequence+fonksiyon) + `GRANT ... TO service_role` (geri ver) +
  `ALTER DEFAULT PRIVILEGES ... REVOKE` (gelecek grant'lari kes) +
  **RLS ENABLE her public tabloda** (policy yok -> anon/auth **sifir satir**;
  service_role `rolbypassrls=true` -> app ETKILENMEZ). **INVARIANT:** app runtime +
  tsql YALNIZ service_role kullanir (recon: user-JWT yolu YOK, `mode:'anon'` HIC
  cagrilmiyor, `central-browser` anon = olu kod) -> app BOZULMAZ.
  **UYGULAMA:** 032 -> v5 + demo tenant (`apply-hardening`, exec_sql/postgres-definer,
  preflight owner-assert = 0 non-postgres tablo); **central-011 -> hotelgen-central
  PROD SQL Editor'den CANLI** (`anon_bridge=false`, `anon_hotels=false`, `rls_off=0`,
  `svc_ok=true`). `tsql.js` (untracked) patch'lendi: `exec_sql_json` her kurulumdan
  sonra **service_role-only** birakilir (Supabase `CREATE OR REPLACE`'te default-grant'i
  geri acar). **DB-KATMAN DEPLOY DEGILDIR** — grant/RLS canli DB'de yasar, runtime
  kod degismez; bu yuzden **HEAD > PROD KASITLI** (asagida). Tam liste §7'de.
- **26. OTURUM — #3 DAR-GUVENLI BACKSTOP (ozet).** `sla_events` cift-kayit icin
  **DAR-GUVENLI 23505 backstop** kuruldu + prod deploy (`9dcf48a`) +
  **migration 031 partial-unique CANLI** (v5). Naive "temizle + dogal-anahtar
  UNIQUE" **REDDEDILDI**: DB UNIQUE = **tam esitlik**, app dedup = **bulanik**
  (Jaccard 0.5, 3 dk, acik kayit) -> constraint dedup'i **taklit EDEMEZ**, ancak
  onun **dar alt kumesi** olabilir. Canli olcum: 62 + 20 fazla satirin **~%60'i
  MESRU tekrar** (1 saat - 9 gun araliklarla) -> silmek **imha**, kor bloklamak
  **23505 sessiz kaybi** olurdu. Cozum: **acik-kayit partial unique** (o alt
  kumede dup **0** -> SIFIR temizlik) + `insertSlaEvent` **tek-kaynak** (4 site) +
  **23505 -> `notifyDuplicateRequest`**. `room_service_orders`'a guvenli bir
  statik constraint YOK -> onun yerine **2 defekt duzeltildi**. Tam liste §7'de.
- **HEAD = `3409a0e` (27. oturum) · PROD(deploy) = `9dcf48a` (26. oturum) —
  HEAD > PROD KASITLI.** Aradaki iki commit (`3409a0e` tenant-032 kaydi +
  bu doc-sync) **RUNTIME KOD DEGISTIRMEZ** — 032/central-011 birer **DB-katman
  migration KAYDIDIR** (grant/RLS canli DB'de uygulandi; Vercel bundle'i AYNI).
  Bu yuzden bir sonraki `vercel --prod` bunlari tasisa da davranis degismez;
  DB-katman deploy'a BAGLI DEGIL, zaten CANLI. **26. oturum PROD dokunulmadi:**
  deploy hala `dpl_GDKd8CqbR6nUBVi5gAr6TjBnqXP2` (target=production, READY; alias
  `hotelgen-v2.vercel.app` `vercel inspect` AYNI dpl id).
  Saglik: `/` 200 · webhook GET 405 · webhook POST secret'siz 401.
  Muhur (27.otu): `npm run doctor` YESIL (tsc 0 · test:is8 **2031/2031, 18 dosya** ·
  sema 46/47 · marka 0 unexpected) — **hardening kodu BOZMADI**; katalog dogrulamasi
  service_role INSERT/exec_sql = true. **CANLI BOT UAT YOK** (26.otu 23505 dali +
  27.otu hardening sonrasi uctan-uca forward zinciri) — bkz. §7.
- **ONCEKI PROD (25. oturum): `1da42a9` — GUVENLIK KAPANISI.** Tam bir guvenlik
  denetimi kosuldu, bulgular kapatildi ve git gecmisine sizmis `service_role`
  anahtarlari **ROTE EDILDI**. En agir bulgu **CROSS-TENANT YAZMA** idi:
  `/api/hotel-admin/[slug]/departments/[code]/sla` URL'deki slug'i oturumdaki
  otelle KARSILASTIRMIYORDU -> A otelinin admin'i B otelinin SLA esigini
  YAZABILIYORDU (`resolveTenantBySlug` service_role client doner, RLS tamamen
  BYPASS; middleware bu yolu kapsamaz, matcher'i `/api/...` disinda). Slug kapisi
  `8cf4e95`, rol kapisi `1da42a9`. Batch'in geri kalani: istemciye donen
  `error.message` sizintilari (**125 site**) · xlsx CVE (SheetJS resmi CDN
  0.20.3) · **KALICI rate-limit** (denial-of-wallet, migration 030) · log PII
  maskeleme · backlog #4/#9/#10/#20. Tam liste §7'de.
  **DIKKAT — o deploy IKI commit tasidi:** 24. oturumdan branch'te bekleyen
  `df38583` ile `1da42a9` prod'a BIRLIKTE gitti. (`dpl_` deployment id'si bu
  dosyaya ISLENMEDI — bkz. §7.)
- **ONCEKI PROD (24. oturum): `df38583`** — `front_office` chat_id lookup'i tek
  kaynaga baglandi (backlog #6): `getFrontOfficeChatId(supa)`
  (`src/lib/telegram/front-office.ts`) — **HAM string** dondurur, `Number()` coerce
  **CAGRI YERINDE** kalir. 6 canli site + olu `:865` bagli. Davranis-KORUYUCU saf
  refactor oldugu icin deploy o oturumda BILINCLE ertelenmisti; 25. oturumda
  `1da42a9` ile birlikte prod'a gitti.
- **ONCEKI PROD (23. oturum, SEVK B): `0bac2ad`** — alerjen dogrulamasinda **SESSIZ
  YUTMA KAPANDI**: 3 basarisiz oda+isim denemesinden sonra state temizlenip
  misafire "on buroya basvurun" deniyor ama **personel HIC haberdar edilmiyordu**
  (bildirilen alerji kimseye ulasmadan kayboluyordu — §3 SESSIZ YUTMA YASAGI,
  guvenlik-kritik). Artik state temizliginden ONCE on buro grubuna TR kart duser.
  Deploy `dpl_2rqqDg6C9Uo7HLRX9MZACP8YJ24v` (target=production, READY; hem
  deployment URL'i hem alias UZERINDEN `vercel inspect` AYNI dpl id'yi cozdu).
  Saglik: `/` 200 · webhook GET 405 · webhook POST secret'siz 401.
- **ONCEKI PROD (23. oturum, SEVK A): `1b529f2`** — isim-eslesme **SITE 7
  `[allergen-verify-gate]`** tek kaynaga baglandi (alerjen kapisi kendi
  `toLowerCase`'ini kullanip **yalniz SOYADA** bakiyor ve `find()` ile ilk adayi
  aliyordu). Deploy `dpl_AevDr9o2s8CxiHFViqY5S8Ebi6WQ` (alias teyitli).
- **ONCEKI PROD (22. oturum): `e36bf65`** — **backlog #6 KAPANDI**: isim-eslesmenin
  kalan iki sitesi (site 5 `reception-approval` GUARD B + site 6 `route.ts`
  re-verify) `match-guest-name.ts`e baglandi; modul 2 yeni SAF export kazandi
  (`sameGuestByText`, `sameLastName`). Deploy `dpl_2G5Rwuh1q3WZQz7XNuBFkc7XKPQa`.
- **ONCEKI PROD (21. oturum): `9e46fdf`** — misafir **isim eslesmesi TEK KAYNAK +
  TAM KELIME** (backlog #13): ad/soyad UC AYRI yerde inline ve SUBSTRING
  karsilastiriliyordu; artik `src/lib/verification/match-guest-name.ts` TEK karar
  verir. Deploy `dpl_8bMJpYxVmY4gYn3EgacSWD9FAks7`.
- **ONCEKI PROD (20. oturum): `92edccb`** — oda-prefix **TEK KAYNAK `ROOM_PREFIXES`**
  (backlog #5 **KOK**): ayni 8 prefix UC AYRI yerde elle yaziliydi; artik regex
  alternasyonu + strip regex + STOP_WORDS tek diziden URETILIR.
  Deploy `dpl_FCKu2qhQww4bazAhHoFLxBMBzcDH` (target=production, READY; alias
  `vercel inspect` ile TEYITLI). **`f5a56a7` + `92edccb` BIRLIKTE deploy edildi.** Zincir:
  `1cc5efb` (13. otu prod) -> `631d2a1` (docs) -> `6c30f6f` + `3d9e593`
  (15. otu, oda-no parse + RU/AR) -> `73d92ae` (16. otu, IS 2 M1+M2)
  -> `d5b9408` (17. otu, M2 kapisi; deploy `dpl_7ejoCZTRfzvYeYFLvUK3GbDGur9X`)
  -> `df3f6b5` (18. otu; deploy `dpl_JBrt8hqMoHx9ruxR4M3kXLsTgXL2`)
  -> `48ea1ea` (19. otu, backlog #5 **SEMPTOM**: AR prefixi strip listesine eklendi)
  -> `f5a56a7` + `92edccb` (20. otu, **KOK**)
  -> `9e46fdf` (21. otu, backlog #13)
  -> `e36bf65` (22. otu, backlog #6)
  -> `1b529f2` (23.a, site 7) -> `0bac2ad` (23.b, sessiz yutma)
  -> `df38583` (24. otu, backlog #6 chat_id helper — o oturumda deploy YOK)
  -> `4114d07` + `8cf4e95` + `cf961d0` + `6778749` (25. otu guvenlik on-hazirligi:
     next/ws CVE · **cross-tenant SLA slug kapisi** · postgrest filtre + header +
     timeout + PII + prompt guard · AR codePoint + cancel claim)
  -> `1da42a9` (25. otu, guvenlik kapanisi; `df38583` ile BIRLIKTE deploy edildi)
  -> `9dcf48a` (26. otu, backlog **#3 dar-guvenli 23505 backstop** — **PROD BURADA
     DURUYOR**; deploy `dpl_GDKd8CqbR6nUBVi5gAr6TjBnqXP2`, migration **031** ayri
     adimda CANLIYA uygulandi).
  Yedek tag: `pre-tier2-20260728`.
- **DOKUMAN GECIKMESI (20. otu tespiti, 23. otu TEKRARLANDI):** 19. oturum sevki
  (`48ea1ea`) bu dosyaya DOKUNMADI — CLAUDE.md v32/18. oturumda kalmisti. AYNI SEY
  22-23'te de oldu: `e36bf65` / `1b529f2` / `0bac2ad` sevk edildi, dosya v35'te
  kaldi (backlog #6'yi ACIK, site 7'yi YOK gosteriyordu). Bu senkron 22+23'u
  BIRLIKTE tasir. Ders: kod sevki ile doc sevki ayri commit'ler; biri atlanirsa
  doc sessizce bayatlar (kod dogru, harita yanlis) — sevkten sonra doc senkronunu
  AYNI oturumda kapat. **24. otu bunu UYGULADI:** `df38583` (kod) ve o senkron
  (doc) ayni oturumda, ayri commit'ler olarak kapatildi. **25. otu da UYGULADI:**
  `1da42a9` (kod) ve o senkron (doc) ayri commit'ler. **26. otu da UYGULADI:**
  `9dcf48a` (kod) ve bu senkron (doc) ayri commit'ler.

## 1. CALISMA PRENSIPLERI
- **Reconnaissance-first:** Edit'ten once ilgili dosyalari OKU. Varsayimla kod yazma.
- **Canli kanit tek gercek:** "type-check gecti" / "deploy ready" KANIT DEGILDIR.
  Kanit = gercek bot davranisi, Vercel log satiri, SQL sonucu.
- **Kok neden:** Semptomu bastirma. Neden oldugunu bulamadiysan DUR ve raporla.
- **Kucuk yuzey:** Her fix cerrahi. Ilgisiz refactor YASAK.
- **Emin degilsen DEBUG log koy**, tahmin etme.

Asagidaki uzun-form prensipler yukaridaki 5 maddenin gerekcesidir; ihlal noktalarini
somutlastirir — koru:

**Think before coding.** Don't assume — if a request is ambiguous, surface interpretations or ask; don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and name it.

**Simplicity first.** Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible cases. If 200 lines could be 50, rewrite it.

**Surgical changes.** Touch only what the request requires — every changed line must trace to the task. Don't "improve" adjacent code, comments, or formatting; match existing style. Remove only orphans YOUR change created; never delete pre-existing dead code unless asked (mention it instead).

**Debug by root cause, not symptom.** NO FIX WITHOUT ROOT-CAUSE INVESTIGATION FIRST — a symptom patch is a failure. Read errors fully, reproduce, check recent git changes. In multi-layer flows (webhook -> AI -> DB) add diagnostic logging at each boundary and gather evidence showing WHERE it breaks before proposing a fix. Form ONE hypothesis, make the SMALLEST change to test it, verify, then continue — never bundle multiple fixes. If 3+ fixes fail, stop and question the architecture; don't attempt fix #4.

**Verify with live evidence — never self-report success.** "type-check passed" or "it should work" is NOT proof. Proof = live bot behavior, Vercel logs, SQL results, real Telegram tests. Verify DB schema live via information_schema (migration status can show a false green). This agent EXECUTES the given instructions only: no self-initiated diagnosis, no added scope, no "while I'm here" edits — decisions come from the human/orchestrator.

**HotelGen commit & output rules.** Run `npm run type-check` before every commit (no test suite exists; type-check + build + manual UAT are the gates). Commit messages ASCII only (conventional `fix:`/`feat:`/`chore:`); guest-facing strings use full Turkish characters (Agustos -> Ağustos, kisi -> kişi) — never ASCII approximations. Migrations are per-tenant, idempotent, runtime-applied; never edit an applied migration — add a new numbered file. NEVER touch the manager report bot (`@hotel_yonetici_rapor_bot`, id 8504961295).

---

## 2. MIMARI HARITASI

### Ne insa ediyoruz (What this is)

**HotelGen v2** — a multi-tenant hotel guest-assistant SaaS built on **Next.js 16 (App Router) + TypeScript + Supabase**. Guests message a hotel over **Telegram** (and ManyChat = WhatsApp/Instagram); an AI orchestrator (Claude) answers from the hotel's knowledge base, runs guest verification, and forwards actionable requests to the right hotel department over Telegram, with SLA escalation. Staff/owners manage everything through role-based admin panels.

Telegram webhook retry'ini **webhook-girisinde** engeller (`update_id` dedup — 18. otu): ayni update'in tekrar teslimi hicbir dispatch dalina ulasmadan 200 ile kapanir.

**Misafir KIMLIGI (ad/soyad) tek bir saf modulden karara baglanir** (`match-guest-name.ts` — 21/22/23. otu): kimligi olculen **YEDI** cagri yerinin (17.c oda eslesmesi, 17.7-B coklu aday, `verifyGuest` v2, reception-approval GUARD B, re-verify tetigi + re-send guard, alerjen dogrulama kapisi) hicbiri kendi karsilastirmasini yazmaz. Alerjen akisi bu kapinin hem eslesme hem **basarisizlik** tarafini kapatir: 3 denemede dogrulanamayan bir alerji bildirimi sessizce dusmez, on buro grubuna duser (23. otu).

The codebase and all guest-facing strings are **Turkish**. Guests are served in TR/EN/DE/RU/AR (+FR/IT in some prompts). Work is organized into numbered "Modüller" (M1–M22); commit messages and code comments reference them.

### Komutlar (Commands) — package.json'dan dogrulandi

```bash
npm run dev            # next dev --port 3000
npm run build          # next build
npm start              # next start
npm run lint           # eslint .   (eslint 9)  — NOT "next lint"
npm run type-check     # tsc --noEmit  ← run this to validate TS
npm run test:is8       # IS 8 kanonik korpus (bayrak seviyesi, ag/LLM cagrisi YOK)
npm run doctor         # TEK KOMUT saglik: [A]tsc [B]test:is8 [C]tenant-sema [D]sabit-marka; YEREL, prod'a deploy EDILMEZ

npm run seed:demo-knowledge   # tsx scripts/seed-demo-knowledge.ts (needs DEMO_HOTEL_SUPABASE_* env)
npm run create-admin          # node scripts/create-admin.mjs (master admin bootstrap)
npm run seed-departments      # node scripts/seed-department-users.mjs
```

- **CI test suite YOK — ama IS 8 korpusu COMMIT'LI ve kosulabilir.** `npm run test:is8`
  (`scripts/is8-run-all.mjs`, `scripts/is8-*-test.ts` dosyalarini otomatik bulup kosar).
  Kapsam: soru/sikayet kapilari, sikayet->tip/adet zinciri, oda-link tazeligi, import damga
  tasima. Hepsi **gercek modulleri import eder** (kopya fonksiyon YASAK — kopya yesil doner,
  canli davranisla celisir; bu tuzak bir kez yasandi) ve **ag/LLM cagrisi yapmaz**, API
  anahtari gerektirmez. Yeni bir kapi/karar eklersen korpusa vaka EKLE.
  Bayrak seviyesi olduguna dikkat: Telegram butonu / gercek forward karti / misafire giden
  LLM metni burada dogrulanamaz — onlar canli UAT konusudur.
- **`npm run doctor` (scripts/doctor.mjs) = TEK KOMUT saglik kontrolu.** [A] tsc + [B] test:is8 (26. oturum sonu **2031/2031**, **18 dosya**; 1651 (13. otu, 10 dosya) -> 1693 (15. otu `is8-verify-parse-test.ts`, 42 vaka) -> 1734 (16. otu `is8-duplicate-guard-test.ts` 31 vaka + guest-lang'e dedup metni kapsami 10 vaka) -> 1747 (17. otu, YENI DOSYA YOK: `is8-duplicate-guard` 31->36 §8 M2 kapisi, `is8-pending-order` 20->28 §g `isStructuredOrder`) -> 1775 (18. otu `is8-update-dedup-test.ts`, 28 vaka §u1-u10) -> 1781 (19. otu, YENI DOSYA YOK: `is8-verify-parse` 42->48 §8 AR prefix strip) -> 1819 (20. otu §9 regex+strip tek kaynak, 38 vaka) -> 1827 (20. otu §10 STOP_WORDS, 8 vaka; `is8-verify-parse` toplam **94**)
  -> 1872 (21. otu **YENI DOSYA** `is8-match-guest-name-test.ts`, **45 vaka**)
  -> 1898 (22. otu, YENI DOSYA YOK: `is8-match-guest-name` 45->71, §6 `sameGuestByText` 11 + §7 `sameLastName` 8 + §8 eski normalizer oracle'i 7)
  -> 1913 (23. otu, YENI DOSYA YOK: `is8-match-guest-name` 71->**86**, §9 site-7 15 vaka)
  -> 1913 (24. otu — DEGISMEDI, bilincli: `getFrontOfficeChatId` salt IO, icinde saf
  karar YOK; davranis-koruyucu bir IO refactorunun muhru is8 DEGIL, **doctor +
  diff-esdegerlik okumasi**. is8'e vaka ZORLAMA — sahte kapsam uretir)
  -> **1997 (25. otu, UC YENI DOSYA / +84 vaka):** `is8-mask-pii-test.ts` (**33** —
  cekirdek iddia "HAM AD CIKTIDA GECMEZ") · `is8-allergen-tr-line-test.ts` (**14** —
  `needsTurkishLine`, LLM'i SARMALAYAN IO degil SAF karar test edilir) ·
  `is8-nonlatin-word-test.ts` (**37** — gercek cagri yerlerinden, eski-substring
  oracle'i CIFT YONLU). 25. oturumun geri kalani (SLA rol kapisi, error.message
  sizintilari, xlsx, rate-limit, #10, #20) korpusa vaka EKLEMEDI: hepsi IO ya da
  yapilandirma, saf karar iceren yalniz bu uc modul)
  -> **2031 (26. otu, YENI DOSYA `is8-pg-error-test.ts`, 34 vaka):**
  `isUniqueViolation` — vaka listesi SABIT ve ELLE yazili (kaynaktan TURETILMEZ,
  yoksa test kendini dogrular) + §3 elle yazilmis `legacyInlineCheck` ikizi ile
  cift-yonlu karsilastirma + "oracle KOR DEGIL" sayaci. **HARNESS-BITE olculdu:**
  `1a` ters cevrilince **33/34** + `17/18 dosya` + `DUSEN: is8-pg-error-test.ts` +
  exit 1 KIRMIZI dondu, geri alininca YESIL. `insertSlaEvent`'in kendisi korpusa
  vaka EKLEMEDI (salt IO — §4 "davranis-koruyucu IO refactorunun muhru is8 DEGIL";
  onun muhru doctor + payload SHA256 esdegerligi + sahte-client probe'u oldu) +
  [C] tenant sema/migration butunlugu (canli information_schema; tenant.env yoksa WARN-skip;
  26. otu sonu **GEREKLI 46 / MEVCUT 47 — DEGISMEDI**: migration **031** yalnizca
  bir INDEX yaratir, `CREATE TABLE` icermez, bu yuzden [C]'nin "GEREKLI" sayisi
  ARTMAZ. **[C] index'leri HIC gormez** — 031'in canliya uygulandigi
  `pg_indexes` ile AYRI dogrulanir. Bir kosuda gecici
  `fetch failed` WARN'i gorulebilir; host ayakta olsa bile olur, TEKRAR KOS) +
  [D] sabit-marka taramasi (src/**, dosya-bazli allowlist; 26. otu sonu **13 allowlisted /
  0 unexpected — DEGISMEDI**: yeni moduller (pg-error, insert-sla-event) hicbir
  id/marka HARDCODE ETMEZ). Yesil/kirmizi, FAIL -> exit 1. YEREL arac,
  PROD'a deploy EDILMEZ. "Bir sey bozuldu mu?" -> once bunu kos.
- Kalan dogrulama yine `npm run type-check` + `npm run build` + manuel/UAT. Repo kokundeki
  `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` dosyalari tek
  kullanimlik teshis scriptleridir — test degil; referans alma, yenisini ekleme.
- **Migrations do NOT run via npm.** They run from inside the app (admin UI / API routes) per-hotel. See *Migrations* below.
- Node 20+. Deployed on **Vercel** (`hotelgen-v2.vercel.app`); env vars live in the Vercel dashboard, locally in `.env.local`.
- **Bagimlilik durumu (25. otu):** `next` **16.1.6 -> 16.3.0** ve `ws` 8.20.1 -> 8.21.2
  (CVE, `4114d07`). `xlsx` npm'de **0.18.5**'te DONMUS ve prototype-pollution + ReDoS
  advisory'si `fixAvailable: false` idi; **resmi SheetJS CDN'ine** tasindi:
  `package.json` -> `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (**0.20.3**
  CDN'deki EN GUNCEL surum; 0.20.4+ 404). AYNI kutuphane, AYNI API — 10 cagri yerinin
  tamami `read/write/writeFile/utils.*/SSF.parse_date_code` kullanir, hepsi mevcut.
  `npm audit` 6 -> 5, `fixAvailable:false` olan tek yuksek risk dustu.
  **TAKAS:** build artik `cdn.sheetjs.com`a baglidir — CDN kesintisi build'i DUSURUR
  (saticinin resmi kurulum yolu, `exceljs`e GECME).
  Perplexity cagrisina **30 sn `AbortSignal.timeout`** eklendi (`cf961d0`); oncesinde
  asili bir istek Vercel fonksiyonunu 300 sn'ye kadar tutabiliyordu.
- **Izin ayari (15. oturum): `.claude/settings.local.json`** — git'te TAKIPSIZ (yalniz
  `.claude/skills/**` takipli), yani commit gate'inde GORUNMEZ. `defaultMode: acceptEdits`;
  `vercel`/`npx vercel` **ask** listesinde (deploy her defasinda acik onay ister — §3
  DEPLOY kuralinin arac tarafindaki karsiligi), `.env*` okumasi ve `git push --force`
  **deny**. Yeni bir komut reddedilirse once bu dosyaya bak, tahmin etme.
- **SEVK HEDEFI — DOGRU REPO (25. otu, teyitli):** Vercel projesi
  **`kemalkuyucu/hotelgendigital`** reposundan deploy eder (Vercel Settings -> Git
  ile TEYIT EDILDI). Ortamda gorulen **`qltydigital-hub`** bir KOPYADIR ve prod'u
  BESLEMEZ — oraya push etmek canliya hicbir sey tasimaz. Deploy oncesi hedefi
  varsayma, Settings -> Git'ten dogrula.
- **GIT PUSH KIMLIGI — ONCE `git remote -v` TEYIT ET (26. otu guncellemesi):**
  ilk is hedefi dogrulamaktir; **`origin` DOGRU repoyu gosteriyorsa PAT GEREKMEZ.**
  26. oturumda olculdu: `origin = kemalkuyucu/hotelgendigital` idi ve duz
  `git push <url> hotelgen-v4` **exit 0** dondu — credential yardimcisi dogru
  kimligi tasiyordu. Komutu **`GIT_TERMINAL_PROMPT=0`** ile kos: yardimci
  basarisizsa asili kalmaz, ANINDA hata verir (bu ortamda interaktif prompt'a
  cevap YAZILAMAZ).
  **PAT yolu YEDEKTIR** (25. otu): yardimci yanlis hesabi (403) tasirsa
  `git -c credential.helper= push https://github.com/kemalkuyucu/hotelgendigital.git hotelgen-v4`
  — sorulunca **username = `kemalkuyucu`**, **password = PAT**. PAT'i komut satirina
  ya da URL'e GOMME (shell gecmisine ve log'a duser); prompt'a yaz.
- **SERVICE_ROLE ENV ADLARI (rotasyon yuzeyi, 25. otu):** kodda **iki** ad okunur —
  `CENTRAL_SUPABASE_SERVICE_ROLE_KEY` (5 yer: `supabase-client.ts:29`,
  `supabase/central-server.ts:8`, `tenant/get-hotel-by-slug.ts:19`,
  `telegram-manager/[hotelSlug]/route.ts:32`, `scripts/create-admin.mjs:22`) ve
  `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY` (11 yer). **Diger otellerin service_role
  anahtarlari env'de DEGIL** — Central `bridge_credentials` icinde AES-256-GCM
  sifreli; onlarin rotasyonu Vercel env degil, **admin panelinden yeniden girme**
  isidir. `anon` anahtar **TARAYICIYA GITMEZ**: `NEXT_PUBLIC_CENTRAL_SUPABASE_*`
  yalniz `src/lib/supabase/central-browser.ts`te gecer ve o dosyanin **cagirani
  YOKTUR** (olu kod, hicbir client bundle'ina inline edilmez).
- **SECRET ROTASYON DESENI (25. otu, kesintisiz):** (1) Supabase'de **YENI**
  `sb_secret` uret · (2) yeni degeri Vercel env'e **ve** `hg-scratch/tenant.env`e yaz ·
  (3) **deploy et** (env degisikligi ancak yeni deploy'da etkinlesir) · (4) canli
  TEST et (`/` 200 · webhook GET 405 · gercek bot mesaji) · (5) **ANCAK O ZAMAN**
  eski/legacy anahtari Supabase'de disable et. Sirayi bozup once disable edersen
  bot ANINDA duser.
- **Vercel CLI self-upgrade "npm ENOENT" uyarisi ZARARSIZ (25. otu):** CLI kendini
  guncellemeye calisirken `npm` bulamayip hata basabilir; deploy'in kendisi etkilenmez.
  Deploy sagligini bu satira gore degil, `vercel inspect` + `/` 200 ile olc.
- **UYARI — IKI AYRI health-check, KARISTIRMA:** `/api/health-check` (asagidaki 503'lu
  TESHIS endpoint'i) ile `/api/cron/health-check` (gunluk CRON: bridge testi +
  `runSlaCheck` + cevre kesfi + **`processed_telegram_updates` TTL supurmesi**) AYRI
  dosyalardir. TTL supurmesi CRON tarafindadir; 503'lu olan onu ETKILEMEZ.
- **`/api/health-check` PROD'da 503 doner — BOZUK DEGIL.** 6 kontrolden 5'i yesil
  (env vars / Central / demo-hotel Supabase / encryption / pgvector); tek kirmizi
  `seed_data`: Central `hotels`'ta `slug='demo-resort-spa'` YOK. Bu, Modul 1 doneminden
  kalma bir bootstrap seed beklentisi (route'a son dokunus `4e592ec`, 2026-05-05);
  `allOk=false` oldugu icin endpoint 503 uretir. Deploy sagligi icin olcut DEGIL —
  gercek olcut: `/` 200 + webhook GET 405 + `vercel inspect` alias teyidi.

### Housekeeping akisi
| Dosya | Sorumluluk |
|---|---|
| src/lib/ai/department-brains.ts | pattern listesi + matchHousekeepingItems + extractQtyBefore + brain + **isInfoQuestion / isHousekeepingComplaint** |
| src/lib/ai/classify-and-respond.ts | **hk-gate 3 DAL** (sikayet / bilgi / talep) + bagaj override + shouldForward kapisi |
| src/app/api/webhooks/telegram/[hotelSlug]/route.ts | hkItems + **hkComplaint** -> state kurulumu + advanceHousekeeping / askHousekeepingComplaintConfirm + callback dispatch |
| src/lib/sla/handle-housekeeping-callback.ts | hk:s / hk:q / **hk:c** + advanceHousekeeping (pax lookup, butonlar, kuyruk) |
| src/lib/sla/housekeeping-forward.ts | DEDUP + sla_events + kart + rollback + pax esigi + opsiyonel `note` |
| src/lib/sla/notify-duplicate.ts | dedup tekrar bildirimi (acik kartin altina reply) |

### Soru / sikayet kapilari (IS 8 — deterministik, LLM DEGIL)

**`isInfoQuestion(text)`** — capraz-departman **TEK dedektor** (department-brains.ts'te export;
housekeeping beyni + bagaj override ayni fonksiyonu cagirir, ikinci dedektor YASAK).
Cok dilli (TR/EN/DE/FR + Kiril/Arap kokler), paylasilan `normalizeTr`.
**Yalin "?" bilgi TETIKLEMEZ** — karar POZITIF interrogative sinyaline baglidir (ne zaman/
kacta/nasil/when/where/wann/quand...). Sebep: "havlu getirir misiniz?" gibi KIBAR TALEPLER
soru isareti tasir; yalin-"?" kurali onlari bilgiye dusurup talebi YUTUYORDU.
**Bias: supheliyse TALEP** (kayip talep, yanlis bilgiden kotudur).

**`isHousekeepingComplaint(text)`** — esya VAR **VE** problem sinyali VAR
(degismedi/degistirilmedi/yenilenmedi/gelmedi/temizlenmedi/-memis formlari, yok, eksik,
kirli, pis, lekeli, degil, hala ayni). Esya sarti forward kartinin esyayi adlandirabilmesi
icin de gerekli.

**hk-gate ONCELIGI (classify-and-respond.ts) — sira BAGLAYICIDIR:**
1. **SIKAYET** (esya + problem) → ozur + onay butonlari
2. **BILGI sorusu** (problem yok) → KB/bilgi akisi, forward KESILIR
3. diger → normal TALEP akisi (tip/adet butonlari)

Hem soru hem sikayet olan mesaj ("havlu neden degismedi?") **SIKAYET** dalina gider —
bilgi dalina duserse misafir KB cevabi alir, yasanan aksaklik kimseye iletilmez.

**Sikayet akisi:** bot ozur diler + tek soru sorar → `[Evet, simdi]` / `[Simdi degil, sonra]`.
"Evet" **DOGRUDAN FORWARD ETMEZ**: normal cozum zincirini baslatir (ambiguous ise TIP → ADET →
forward) — odada 3-4 kisi olabilir, adet VARSAYILMAZ. State'teki `cm` bayragi zincirin
sonundaki forward'a `note='sikayet/yenileme'` tasir. "Sonra" → forward YOK. Otomatik onay YOK.
Yeni buton sistemi KURULMADI: mevcut hk_pending state + `v` damgasi + hkStampAccepts + `hk:`
dispatch aynen kullanilir; onayda state KAPATILMAZ (zincir surer), cift-tik korumasi damgadan
gelir (ilk basim v'yi artirir → eski onay butonu RED).

**Bagaj (Option-A):** bagaj keyword'u + `isInfoQuestion` → BILGI, forward kesilir, departman
ZORLANMAZ. Bagaj TALEBI eskisi gibi on-buroya forward.

Sevkler (hotelgen-v4): `de363f8` · `57e7d5d` · `0591864` · `532a2d5` · `b31e9e0`.

### Misafir-oda eslesmesi (kart "Oda bilinmiyor" ise buraya bak)

Kart/pax cozumu **TEK yoldan** gider:
`conversations.telegram_chat_id` → `inhouse_guests_v2 WHERE telegram_id = <chat_id> AND status='active'`
(housekeeping-forward.ts, handle-order-callback.ts, handle-housekeeping-callback.ts).
**`verified_inhouse_guest_id` ve isim eslesmesi kart tarafindan HIC okunmaz** — orayi
duzeltmek karti duzeltmez. Damgayi yazan yerler: 17.c oda eslesmesi ve dogrulama basarisi.

| Dosya | Sorumluluk |
|---|---|
| src/lib/verification/inhouse-link.ts | `isInhouseRowLinkable` (C1 bayat-link) + `planTelegramCarryOver` (C2 damga tasima) — saf, IO yok |
| src/lib/verification/match-guest-name.ts | `matchesGuestName` + `matchesGuestNameFromText` + `sameGuestByText` + `sameLastName` — isim eslesmesinin TEK KAYNAGI, **4 export / 7 cagri yeri** (21-23. otu, asagidaki bolum); saf, IO yok |

**KIRILMA (canli, 2026-07-19):** import anahtari `room_number::check_in_date`. Ayni misafir
yeni check-in ile yuklenince anahtar degisir → eski satir **arsivlenir**, YENI id acilir ve
`telegram_id` NULL kalir. Damga arsivde kalinca kart "Oda bilinmiyor" der, pax okunamaz.

- **C1 (`47eef98`) — bayat-link self-heal:** "bagli mi?" karari artik isaretcinin DOLULUGUNA
  degil, isaret edilen SATIRIN durumuna bakar (`status='active'` + `check_out_date` gecmemis).
  Bayat → **bagsiz** sayilir → 17.c yeniden eslestirir/damgalar. DB sorgu hatasinda ESKI
  davranis korunur (bagli say) ki gecici hata dogrulanmis misafire oda no sordurmasin.
- **C2 (`459656c`) — import damgayi TASIR:** arsivleme sonrasi damga + konusma isaretcileri
  (`inhouse_match_guest_id`, `verified_inhouse_guest_id`) yeni satira gecer.
  **GIZLILIK: yalniz AYNI oda + AYNI isim + TEK-ANLAMLI eslesme.** 0/coklu eslesme, bir hedefe
  iki talep, ayni damganin iki hedefe gitmesi → **hicbiri tasinmaz**. Ayni odaya gelen YENI
  misafir hicbir sey devralmaz (yoksa baskasinin odasini/taleplerini gorur); oksuz kalan arsiv
  damgasi zararsizdir.
- **Veri onarimi deseni (tek-damga invaryanti):** Tam id-tabanli 3 adim — ONCE eski satirdan
  `telegram_id=NULL` (id ile), SONRA aktif satira damga (id ile), sonra konusma isaretcileri
  (`inhouse_match_guest_id`/`verified_inhouse_guest_id`, eski-deger WHERE ile) — **import route 4b**'de
  (`src/app/api/hotel-admin/[slug]/inhouse/import/route.ts` ~450-480, `planTelegramCarryOver` planindan).
  `reception-approval.ts` (`src/lib/verification/` altinda — glob teyitli) GUARD A ise daha BASIT bir
  tek-damga temizligidir: `telegram_id`+`status='active'` ile NULL'la, sonra YENI satir INSERT
  (pending misafirin inhouse kaydi olmadigindan konusma-isaretcisi tasima adimi YOK). Her iki yolda da
  WHERE'siz UPDATE YOK. Dogrulama: kart sorgusunun BIREBIR aynisini kosur.

### Misafir ismi eslesmesi TEK KAYNAK — `match-guest-name.ts` (backlog #13 + #6 + site 7) · sevkler `9e46fdf` (21) + `e36bf65` (22) + `1b529f2` (23.a)

**KOK SORUN:** ad/soyad karsilastirmasi UC AYRI yerde inline yaziliydi ve ucu de
**SUBSTRING** calisiyordu — ismin bir PARCASI kimlik kaniti sayiliyordu. Somut
kirilma: oda 102'de "Ayse Akin" kayitliyken misafir "102 Mehmet Ak" yazar; 'akin'
icinde 'ak' gectigi icin eslesir, odada tek aday oldugu icin `length === 1`
korumasini da gecer -> `telegram_id` **YANLIS KISIYE** damgalanir (§3 KIMLIK/LINK
TASIMA ihlali: misafir baskasinin odasini/taleplerini gorur). Ustelik 17.7-B kendi
yerel `normalise`'ini kullaniyordu -> "Sahin" yazan misafir ORADA "Şahin" kaydiyla
eslesMEZken site 1/3'te esleSIYORdu (ayni soru, iki farkli gercek).

**KARAR — "DENGELI":** ad + soyad **TAM KELIME** eslesir, **orta isimler IKI TARAFTA
da yok sayilir**. Tam-dize esitligi cok kati olurdu (PMS/pasaport kaydinda orta isim
var/yok farki yaygin, gercek misafiri kilitler); substring ise cok gevsek.

| Uretim | Yer | Not |
|---|---|---|
| `matchesGuestName(dbName, firstName, lastName)` | `match-guest-name.ts` | PARSE EDILMIS giris; ad = ILK token, soyad = SON token; ikisi de DB adinin token'lari icinde TAM olmali |
| `matchesGuestNameFromText(dbName, typedText)` | ayni dosya | HAM metin; **en az 2 kelime** tabani + ilk token = ad, son token = soyad |
| `sameGuestByText(nameA, nameB)` (22. otu) | ayni dosya | IKI TAM ISIM ayni misafir mi? ilk token=ad, son token=soyad; bos taraf -> false. Site 5 |
| `sameLastName(lastA, lastB)` (22. otu) | ayni dosya | IKI SOYAD ayni mi? son token — "Al Saleh"~"Saleh" gereksiz farkliligi onler. Site 6 |
| `tokenize` (dahili, export DEGIL) | ayni dosya | `normalizeTr` + `\s+` bolme; **ikinci normalizer YOK** |

- **TEK-ANLAMLILIK BU MODULDE DEGIL:** fonksiyonlar tek bir aday icin "esliyor mu?"
  sorusuna cevap verir. "Kac aday esledi?" karari CAGIRANA aittir — her uc cagri
  yerinde de damga YALNIZCA **tek** eslesmede atilir.
- **Cagri yerleri (7 site — 23. otu itibariyle TAMAMI BAGLI, inline karsilastirma KALMADI):**
  - **SITE 1** — `route.ts` `[17c-rn]` (~:1527): `gn.includes(ad soyad) || gn.includes(soyad)`
    KALKTI (soyad TEK BASINA yetiyordu). `rnMatches.length === 1` korumasi AYNEN duruyor.
  - **SITE 2** — `route.ts` 17.7-B (~:1694): yerel `normalise` + substring + **`find()`**
    KALKTI -> `filter` + `nameMatches.length === 1 ? [0] : null`. `find()` coklu adayda
    ILK sirayi aliyordu, oysa bu dal tanimi geregi odada BIRDEN FAZLA misafir varken
    calisir. **DAVRANIS DEGISTI:** 0 ya da >1 eslesme -> eslesme YOK, deneme sayaci
    isler (3 denemede on buro bildirimi). Bilincli: yanlis damga > fazladan soru.
  - **SITE 3** — `verify-guest.ts` v2 dali (~:311): AND sarti KORUNDU, degisen yalniz
    substring -> TAM KELIME ("Ak" artik "Akin" kaydina uymaz).
  - **SITE 4** — `inhouse-link.ts` (~:93): zaten TAM ESITLIK'ti, DOKUNULMADI.
  - **SITE 5 (22. otu)** — `reception-approval.ts` GUARD B: kendi
    `toLocaleLowerCase('tr')` normalizer'i + TAM-DIZE **esitsizligi** KALKTI ->
    `!sameGuestByText(...)`. Mantik NEGASYON ("eslesmeyen kayit bul") oldugu icin
    duz swap DEGILDI; davranis KORUNDU: yalniz `roomNameConflict` UYARISI uretir,
    INSERT'i ENGELLEMEZ.
  - **SITE 6a (22. otu)** — `route.ts` re-verify tetigi (~:3267): soyad tam-dize
    esitsizligi -> `!sameLastName(...)`. "Al Saleh" yazan misafir "Saleh" kaydinda
    artik gereksiz re-verify TETIKLEMEZ.
  - **SITE 6b (22. otu)** — `route.ts` re-send guard (~:3423-3424): `sameLastName`
    + **oda karsilastirmasi artik `normalizeTr`'den GECER** (eskiden ham `===` idi;
    6a ile asimetrikti — ayni soru iki farkli gercek).
  - **SITE 7 (23. otu, `1b529f2`)** — `route.ts` `[allergen-verify-gate]` (~:2259):
    `toLowerCase` + **yalniz SOYAD** + `find()` **ilk-alma** KALKTI ->
    `filter(matchesGuestName(row.guest_name, avParsed.firstName, avLastName))` +
    `avCandidates.length === 1 ? [0] : undefined`. **KRITIK CAGRI-YERI GARANTISI:**
    `parseVerificationInput` `firstName` ve `lastName`i **BIRLIKTE** doldurur
    (`tokens.length >= 2` sarti) — format kapisi `!avRoom || !avLastName` ile
    gectiyse `firstName` de GARANTI doludur, fallback GEREKSIZ.
    **DAVRANIS DEGISTI (fail-safe):** 0 ya da >1 aday -> eslesme YOK; ayrica
    tek-token PMS kaydi ("Akin") artik hic eslesmez. Yon bilincli: yanlis kisiye
    alerji yazmaktansa eslesmeme (ve on buro uyarisi, bkz. asagidaki bolum).
  - **Site 5/6/7 damga YAZMAZ** — uyari / tetik / skip uretirler; site 1/2/3
    `telegram_id` damgalar. Ikisini karistirma: birincilerde risk "gereksiz soru",
    ikincilerde "baskasinin odasi".
- **is8 kilidi:** `is8-match-guest-name-test.ts` **86 vaka** (45 -> 71 -> 86).
  **CIFT-YONLU NEGATIF KONTROL — her sitenin kendi ELLE yazilmis oracle'i var,
  hicbiri test edilen modulden TURETILMEZ** (oz-dogrulama tuzagi):
  §5 `legacySubstringMatch` (site 1) + `legacyFromTextMatch` (site 2) ·
  §8 `legacySame` (site 5, `toLocaleLowerCase('tr')` tam-dize) ·
  §9 `legacyAllergenMatch` (site 7, son-kelime + `toLowerCase`).
  Her oracle "eski TRUE / yeni FALSE" **ve** "oracle KOR DEGIL" (gercek pozitifte
  ikisi de TRUE) ciftiyle assert edilir.
  **HARNESS-BITE OLCULDU (23. otu):** `9b` beklentisi gecici `true` yapilinca korpus
  **1912/1913** + `13/14 dosya` + exit 1 KIRMIZI dondu, geri alininca 1913 YESIL —
  yani vakalar dekoratif degil, gercekten assert ediliyor.
- **is8 modulu kilitler, CAGRI YERINI KILITLEMEZ:** site 7'nin `filter` +
  `length === 1` mantigi IO'lu webhook handler'i icinde oldugu icin hicbir testte
  KOSMAZ — o taraf yalniz `tsc` + prod build ile dogrulandi.
- **CANLI BOT UAT'i BEKLIYOR (uc sevkin de):** kanit saf-karar seviyesinde; gercek
  Telegram mesajiyla olculmedi. Olculecekler: (i) "102 Mehmet Ak" -> damga
  ATILMAMALI, (ii) gercek misafir normal baglanmali, (iii) 17.7-B'de belirsiz isim
  3 denemede on buroya dusmeli, (iv) GUARD B uyarisi ayni odada FARKLI kiside
  dusmeli / ayni kiside (orta isim/diyakritik farkiyla) DUSMEMELI, (v) "Al Saleh"
  soyadli dogrulanmis misafir gereksiz re-verify'a dusmemeli, (vi) ayni odada iki
  aile uyesi varken alerji YANLIS ada yazilmamali.

### Alerjen dogrulama kapisi — max-denemede ON BURO UYARISI · sevk `0bac2ad` (23. otu, SEVK B)

**KOK SORUN (sessiz yutma, guvenlik-kritik):** misafir alerji bildirir ama oda no
bilinmiyorsa `allergen_verify_pending=true` kurulur ve bot oda+isim ister. 3 denemede
dogrulanamazsa kapi state'i TEMIZLER ve misafire `allergen_verify_failed_max`
("...on buromuza ulasabilirsiniz") gonderirdi — **personele HICBIR sey gitmezdi.**
`guest_allergens` satiri `status='reported'` + `allergen_text` DOLU / `room_number`
NULL kalir, `allergen_asked=true` oldugu icin akis bir daha TETIKLENMEZ ->
**bildirilen alerji kimse gormeden kaybolurdu.** Normal dogrulama akisi ayni yerde
`createReceptionApproval` ile on buroyu UYARIYORDU; alerjen akisi uyarmiyordu.

**COZUM (`route.ts`, else/eslesmeme dali ~:2347, state temizliginden ONCE, +39/-0):**
`guest_allergens` (`platform_user_id = String(userId)`, `is_active`) -> `allergen_text`
+ `departments` (`code='front_office'`) -> `telegram_chat_id`; ikisi de varsa
`tg.sendMessage` ile **TR plain-text** kart: beyan edilen oda + ad-soyad
(`avParsed.firstName` + `avLastName`) + bildirilen alerji + "manuel bulup dogrulayin".

- **FAIL-SAFE:** blogun TAMAMI `try/catch` icinde. Bildirim hatasi ya da eksik
  `chat_id` akisi KIRMAZ — misafir mesaji ve state temizligi AYNEN devam eder.
  Loglar: `[allergen-verify-gate] Max deneme — on buro uyarildi (room=...)` ·
  `front_office chat_id yok — on buro uyarilamadi` · `on buro uyari HATASI:`.
- **`Number(avFailChatId)` COERCE SART:** `departments.telegram_chat_id` **bigint**;
  supabase-js bunu **string** dondurur (canli mühür: `"-5366737876"`). Coerce
  kozmetik degil, tip uyumunu o saglar (`allergen-notify.ts:143` ile ayni desen).
- **Alerji metni bu kartta CEVRILMEZ.** `sendAllergenNotifications` mutfak/GR
  kartinda `translateToTurkish` + "TURKCE:" satiri ekler; bu kart HAM metni basar
  (RU/AR bildirimde personel okuyamayabilir — §7 acik borc).
- **Butonsuz + `sla_events` YOK** — M4 spec'iyle tutarli (alerji yolunda SLA
  takibi YASAK), ama "manuel kontrol edildi mi" de IZLENMEZ (§7 acik borc).
- **MUHUR (salt-IO fix'in kaniti):** `tsc` 0 + `npm run doctor` YESIL + **tsql canli
  SELECT** (`departments.code='front_office'` -> chat_id DOLU) + fail-safe okumasi.
  **is8 vakasi EKLENMEDI** — blokta saf karar YOK, hepsi IO.
- **`departments` lookup deseni ARTIK HELPER'DA (24. otu, `df38583`):** bu blok
  `getFrontOfficeChatId(supa)` cagirir; `Number(avFailChatId)` coerce'u YERINDE
  kaldi (helper HAM string doner). Bkz. asagidaki *On buro chat_id TEK KAYNAK*.

### On buro chat_id TEK KAYNAK — `getFrontOfficeChatId` + `getFrontOfficeRow` (backlog #6 + #20) · sevk `df38583` (24. otu) + `1da42a9` (25. otu) — **IKISI DE PROD**

**KOK SORUN:** ayni dort satir (`departments` -> `.eq('code','front_office')` ->
`telegram_chat_id` -> null guard) ALTI ayri yerde ELLE tekrarlaniyordu. Kopyalarin
hepsi AYNI davranisi uretiyordu (o yuzden sessiz risk DEGILDI), ama yedincisi
yazildiginda biri sessizce kayardi — §3 *tekrarlanan karar tek kaynakta*.

| Uretim | Yer | Not |
|---|---|---|
| `getFrontOfficeChatId(supa)` (**TEK KAYNAK**) | `src/lib/telegram/front-office.ts` (**YENI dosya**) | `Promise<string \| null>`; **HAM string** doner, coerce YAPMAZ |

- **DONUS HAM STRING, coerce CAGRI YERINDE:** `telegram_chat_id` **bigint**,
  supabase-js **string** dondurur. Cagri yerlerinin bir kismi Telegram'a
  `Number(...)` ile gonderiyor, bir kismi ham degeri kullaniyor — donusumu cagirana
  birakmak mevcut davranisi BIREBIR korur. Helper'a `Number()` koymak bir yerde
  davranis kaydirirdi.
- **FALSY KATLAMASI HELPER'DA:** `raw ? String(raw) : null`. Cagri yerlerinin tamami
  zaten `if (!chatId)` ile dalleniyordu; `0` / `''` de null'a katlanir ki eski guard
  ile sonuc AYNI kalsin. **`error` OKUNMAZ/LOGLANMAZ** ve **try/catch YOK** —
  kopyalarin hicbiri okumuyordu; fazladan log ya da yutma DAVRANIS DEGISIKLIGI olurdu.
- **BAGLI 6 CAGRI YERI:** `reception-approval.ts:109` (**ham kullanim**, coerce yok) ·
  `route.ts` 17.7-C `:539` · 17.7 `:1594` · 17.7-B `:1742` ·
  `[allergen-verify-gate]` `:2359` (dorduncu de `Number(...)` yapar) ·
  olu `notifyFrontDeskUnverified` `:865` (desen birebir ayniydi, tutarlilik icin
  baglandi; oradaki `as number` cast'i runtime **no-op**'tu — deger zaten string'di).
- **SAYIM DUZELTMESI — envanter yaniltiyordu:** §7 bu borcu "**6 kopya**" diye
  tasiyordu; canli tarama (`eq('code', 'front_office')`) **9** lookup buldu. Son iki
  site (`check-runner`, `handle-callback`) listede HIC YOKTU. Ders §4'te.
- **BACKLOG #20 KAPANDI (25. otu, `1da42a9`) — COK-KOLONLU 3 SITE de baglandi.**
  24. oturumda bu ucu disarida BIRAKMISTIK cunku ayni satirdan **BASKA kolon da**
  cekiyorlar ve `getFrontOfficeChatId`e cevirmek TEK sorguyu IKIYE bolerdi. Cozum
  ikinci bir helper:

| Uretim | Yer | Not |
|---|---|---|
| `getFrontOfficeRow<T>(supa, columns, opts?)` | ayni dosya | lookup'in SEKLINI (tablo · `code='front_office'` · `maybeSingle` · `error` okumama) tek kaynakta toplar, **KOLON SECIMINI cagirana birakir** -> tek sorgu TEK KALIR |

  Bagli 3 site: `route.ts` `[reverify-forward]` (`telegram_chat_id, sla_minutes`) ·
  `sla/check-runner.ts` (`reception_sla_minutes`) · `sla/handle-callback.ts`
  (`display_name`).
  **`enabledOnly` OPSIYONEL ve VARSAYILANI `false` — bu KOZMETIK DEGIL:** uc siteden
  yalniz `handle-callback` `.eq('is_enabled', true)` filtresini tasir, yani
  `is_enabled=false` bir on buroda O site digerlerinden FARKLI davranir. Bu
  BUGUNKU CANLI DAVRANISTIR; varsayilani `true` yapmak sessiz bir davranis
  degisikligi olurdu. `getFrontOfficeChatId` de artik bu helper uzerinden gider.
  **Repoda kalan TEK `eq('code','front_office')` helper'in KENDI icindedir** —
  9/9 lookup tek kaynakta.
- **MUHUR:** `npm run doctor` YESIL — tsc 0 · **test:is8 DEGISMEDI** (24. otu 1913,
  25. otu #20 icin de vaka EKLENMEDI — saf karar yok, salt IO) · marka 0 unexpected.
  Circular import YOK: dosya yalnizca `SupabaseClient` **type**'ini import eder —
  ham non-ASCII de tasimaz (RTL riski YOK). **CANLI BOT UAT'i BEKLIYOR:** dokuz
  bildirim yolunun hicbiri gercek Telegram mesajiyla olculmedi.

### 25. oturum GUVENLIK modulleri · sevkler `8cf4e95` · `cf961d0` · `1da42a9` — **PROD**

Bu bolum 25. oturumda EKLENEN/DEGISEN guvenlik yuzeylerini tek yerde toplar.
Hicbiri bir karar akisini degistirmez; her biri bir **giris yolunu kapatir**.

| Modul / yer | Sorumluluk |
|---|---|
| `src/lib/utils/postgrest-filter.ts` | `sanitizeOrFilterValue` — `.or()` bir **FILTRE IFADESIDIR**, baglanan parametre DEGIL; misafir aramasindaki `,` `(` `)` `.` AYIRAC olarak parse edilip **hangi satirlarin dondugunu** yonlendirebiliyordu. Kesme isareti KASTEN korunur ("O'Brien" aranabilir kalmali) |
| `src/lib/utils/mask-pii.ts` | `maskName` — log'a giden misafir adini `#<8 hex>/<uzunluk>` damgasina cevirir. Hash paylasilan **`normalizeTr`**den gecer (ikinci normalizer YOK) -> ayni misafir log satirlari arasinda KORELE olur, ismi tasimadan. **Oda no MASKELENMEZ** (teshisin omurgasi, tek basina kimlik degil) |
| `src/lib/utils/nonlatin-word.ts` | `matchesNonLatinWord` / `matchesAnyNonLatinWord` — Unicode kelime siniri (`(?<!\p{L})X(?!\p{L})`, `u` bayragi). JS `\b` ASCII `\w` tabanli oldugu icin Kiril/Arap'ta OLU; bu yuzden substring'e mahkum kalan uyeler vardi |
| `src/lib/telegram/rate-limit.ts` + `migrations/tenant/030` | `claimRateLimit` — KALICI (cross-instance) rate limit, per-chat **ve** per-hotel. **FAIL-OPEN** |
| `src/lib/telegram/allergen-notify.ts` | `resolveAllergenTurkish` (IO) + **`needsTurkishLine` (SAF)** — alerjen ceviri satiri karari, IKI kart icin TEK KAYNAK |
| `hotel-admin/[slug]/departments/[code]/sla/route.ts` | **slug kapisi** (`8cf4e95`) + **rol kapisi** (`1da42a9`) |
| `src/lib/ai/system-prompts.ts` | misafir mesaji **VERIDIR, TALIMAT DEGIL** guard'i + kurallarini/modelini/mimarisini ifsa etmeme, baska persona benimsememe |
| `next.config.ts` | HSTS · `X-Frame-Options: DENY` · `nosniff` · Referrer-Policy · Permissions-Policy · `poweredByHeader: false` |

- **KALICI RATE LIMIT — neden gerekliydi:** tek koruma `route.ts`teki MODUL-SEVIYESI
  `_rateLimitMap`ti. Vercel'de her invocation AYRI instance olabilir -> sayac cold
  start'ta SIFIRLANIR ve instance'lar birbirini GORMEZ; yeterli paralellikte sinir
  pratikte YOK sayilir. Ustelik yalniz chat basinaydi: N sahte hesap otelin AI
  butcesini (Anthropic + Whisper) tuketebilirdi — **otel capinda tavan YOKTU**.
  Sayac artik tenant DB'de; `rate_limit_hit()` chat ve otel sayacini **TEK deyimde**
  (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) artirir -> okuma-sonra-yazma
  yarisi YOK (M1 atomik claim ile ayni gerekce), ve **TEK RPC** ile iki sayac.
  Esikler: chat **10/60 sn** (in-memory ile AYNI — amac siniri SIKILASTIRMAK degil,
  instance'lar ARASINDA gecerli kilmak), otel **600/60 sn** (bilincli YUKSEK; mesru
  trafigi kesmemeli. **Bu esik OLCUME DEGIL TAHMINE dayanir**, dusurmeden once
  gercek zirve olcun).
- **FAIL-OPEN — YONU TERSINE CEVIRME:** sayac okunamazsa (migration kosmamis tenant,
  DB hatasi, timeout) istek **GECER**. Hatada bloklamak bir DB kesintisinde TUM
  misafirleri susturur — §3 SESSIZ YUTMA'nin en agir hali. In-memory gate KALDI ve
  bunun ONUNDE durur (bedava, bariz floodu DB'ye hic gitmeden keser).
- **CANLI OLCULDU, varsayilmadi:** gercek modulle probe — 10'a kadar gecti, **11.
  cagride red** (`scope=chat`, `hits=11`), farkli chat hala izinli, sayaclar
  chat=12 / chat=1 / hotel=13. **FAIL-OPEN'in KENDISI de** bozuk client'la
  kosturuldu -> `allowed=true, degraded=true`. Probe sentetik slug kullandi (canli
  otelin sayacina DOKUNMADI) ve hemen SILINDI.
- **TTL:** `rate_limit_counters` 24 saatlik supurmesi `cron/health-check` icinde,
  `processed_telegram_updates` supurmesinin YANINDA ve KENDI try/catch'inde.
- **ISTEMCIYE HATA DETAYI DONMUYOR (125 site):** 64 dogrudan (`{ error: err.message }`,
  `detail: String(err)`) + **61 DOLAYLI** — mesaj once bir yerele atanip
  (`const msg = err instanceof Error ? err.message : ...`) sonra donuluyordu, ilk
  grep bunlari KACIRMISTI. Istemci artik sabit metin alir; detay `console.error`a
  gider ve o log **75 sitede HIC YOKTU**. `detail` alaninin tek tuketicisi
  (`DepartmentManagementTab`) zaten `json?.detail ?? json?.error` fallback'i yapiyor.
- **ALERJEN TR SATIRI — karar tek kaynak, BICIM cagri yerinde:** mutfak/GR karti
  HTML, on buro max-deneme karti PLAIN-TEXT. Ortak olan KARARDIR (`needsTurkishLine`),
  bicim degil. Yalniz GERCEK metin cevrilir — `'(belirtilmemis)'` yer tutucusu LLM'e
  GITMEZ. `translateToTurkish` throw ETMEZ -> basarisizlikta HAM satir (raw-fallback).
- **`день` / `зал` GERI EKLENDI (backlog #9):** ikisi de substring yanlis-pozitifi
  yuzunden listeden CIKARILMISTI (`деньги`=para · `сказал`/`вокзал`/`показал`).
  Artik AYRI kelime-siniri listelerinde; **mevcut substring listelerine DOKUNULMADI**
  (RU cekim eki kapsami kaybolmasin). Salon halleri ACIKCA yazilir ve DAR tutulur ki
  `залив`/`залог` eslesmesin.
- **`order:noop` DIL HARDCODE'u KALKTI (backlog #10):** IS 10'un son bilincli `'tr'`
  istisnasiydi; RU/AR misafir pasif butona basinca TURKCE toast goruyordu. Artik
  `telegram_chat_id` ile TEK sorgu (`created_at` ASC + `limit(1)` — PGRST116 deseni).
  Her miss'te `'tr'` fallback = ESKI davranis, yani toast KAYBOLAMAZ.

### Oda-no parse disqualifier (backlog #1) · sevk `6c30f6f` + `3d9e593` (15. otu)

`ROOM_REGEX` (`verify-guest.ts:131`) prefix kismi ARTIK TEK KAYNAKTAN gelir (20. otu,
asagidaki bolum) ama **prefix ZORUNLU DEGIL** — `(?:...)?` opsiyoneldir, yani serbest
metindeki HER 2-4 haneli sayi hala oda no adayidir ("40 kisilik dugun..." -> oda "40").
Iki sevk kok nedeni DEGIL, **yanlis-pozitifi** kapatti:

- **`6c30f6f` — yalin sayi oda SAYILMAZ:** prefixli sayi ("oda 312") her zaman oda;
  **prefixsiz** sayi yalniz etkinlik/miktar baglami YOKKEN oda olur
  (`wasPrefixed || !disqualifiedAsRoom`, verify-guest.ts:190). `isPureIdentityClaim`
  de ayni sarti tasir (:249) -> event mesaji re-verify'a DUSMEZ.
- **`3d9e593` — RU/AR kapsami:** `disqualifiedAsRoom` (verify-guest.ts:181-184) artik
  **3 OR** — `hasEventKeyword(norm) || QUANTITY_UNIT_RE.test(norm) ||
  QUANTITY_UNITS_NONLATIN.some(u => norm.includes(u))`.

| Sabit | Yer | Not |
|---|---|---|
| `EVENT_KEYWORDS_NONLATIN` | `src/lib/ai/event-contact-gate.ts:62` | RU/AR etkinlik kokleri; **TEK KAYNAK `hasEventKeyword` icinde yasar** — ikinci liste YASAK |
| `QUANTITY_UNITS_NONLATIN` | `src/lib/verification/verify-guest.ts:153` | `QUANTITY_UNIT_RE`nin non-latin ikizi (kisi/gece/gun/misafir/cocuk...) |

- **SUBSTRING > REGEX (tuzak):** JS `\b` ASCII `\w` tabanlidir; Kiril/Arap harfi `\w`
  SAYILMAZ -> `\bчеловек` HICBIR ZAMAN eslesmez (sessiz olu kod). Bu yuzden non-latin
  setler `includes` ile taranir; RU cekim eklerini de kapsar.
- **`normalizeTr` non-latin'i KORUR** (yalniz TR diyakritigini katlar + toLowerCase),
  bu yuzden kontrol normalize edilmis metin uzerinde calisir. Latin metnini
  etkilemez -> TR/EN/DE regresyonu yok.
- **Fail-safe yon:** yanlis-pozitif olsa bile sonuc "oda formatini tekrar sor"dur,
  YANLIS DAMGA atilmaz. (`'den'` = gun TEKIL listeden CIKARILDI: "dengi" icinde
  substring yanlis-pozitifi veriyordu; cogul `'дней'` kaldi.)
- Parse'in KOK NEDENI hala acik (bkz. §7) — prefix'i OPSIYONEL `ROOM_REGEX` +
  `requestStopWords` `\b` kalibinin cekim eklerini kacirmasi.

### Oda-prefix TEK KAYNAK — `ROOM_PREFIXES` (backlog #5 KOK) · sevk `f5a56a7` + `92edccb` (20. otu)

**KOK SORUN:** ayni 8 oda-prefixi (`oda` / `room` / `zimmer` / `номер` / <AR gurfa> /
`no` / `numara` / `number`) **UC AYRI yerde** elle yaziliydi. Ikizler kayinca AR prefixi
strip listesinde EKSIK kaldi -> "<AR oda> 312 <talep>" mesajinda oda DOGRU okunuyor
(ROOM_REGEX AR'i taniyor) ama prefix kelimesi TALEP metnine sizip **personel kartina**
dusuyordu. 19. otu (`48ea1ea`) SEMPTOMU kapatti (AR'i strip listesine ekledi);
20. otu KOK'u kapatti: uc kopya -> tek dizi.

| Uretim | Yer | Not |
|---|---|---|
| `ROOM_PREFIXES` (**TEK KAYNAK**) | `verify-guest.ts:67` | 8 eleman, **sira BAGLAYICI**; AR girisi `String.fromCodePoint(0x063a,0x0631,0x0641,0x0629)` |
| `escapeForRegex` + `ROOM_PREFIX_ALT` | `:119` / `:123` | alternasyon TEK yerde kurulur; regex-ozel karakterler kacirilir |
| `ROOM_REGEX` | `:131` | yalniz **prefix kismi** diziden; sayi grubu / `#?` / ayrac / bayrak AYNEN korundu |
| `ROOM_PREFIX_STRIP_RE` | `:141` | `gi` — **yalniz `.replace()`** |
| `STOP_WORDS` | `:85` | `new Set<string>([...ROOM_PREFIXES, ...kalan 102 kelime])` |

- **`AR_ROOM_PREFIX` ayri sabiti KALKTI** — diziye tekillestirildi.
- **`ROOM_PREFIXES` blogu STOP_WORDS'un USTUNDE durmak ZORUNDA:** STOP_WORDS onu spread
  eder; `const` TDZ'si nedeniyle asagi tasinirsa tsc **TS2448** verir (runtime'da
  ReferenceError). Blok sirasi kozmetik DEGIL.
- **`ROOM_REGEX`e `g` EKLEME:** `.match()` ile kullanilir; global regex'te
  `String.prototype.match` **capture group DONDURMEZ** -> `roomMatch[1]` undefined olur ve
  `parseVerificationInput`in **5 cagri yeri** (route.ts **996 / 1508 / 2224 / 2727 / 3248**)
  oda numarasini kaybeder. `ROOM_PREFIX_STRIP_RE` ise `g` TASIR -> `.test()` / `.exec()`
  YASAK (lastIndex cagrilar arasi tasiyip bir esini sessizce kacirir).
- **Davranis-KORUYUCU oldugu OLCULDU, varsayilmadi:** iki regex'in `.source`'u refactor
  ONCESI elle yazilmis literallerle **BIREBIR** ayni (is8 §9 byte-esdegerlik vakasi);
  STOP_WORDS kumesi degismedi — uyeler codePoint'e cevrilip **SHA256** alindi:
  **110 -> 110**, hash AYNI (`9aaced4981...`), 0 fark. Eski ham AR girisi de olculdu ve
  codePoint'liyle BIREBIR ayniydi (yoksa birlestirme kumeyi kaydirirdi).
- **is8 kilidi:** §9 (38 vaka) her prefix icin "miktar baglaminda oda OKUNUR" + "prefix
  talebe SIZMAZ" + iki `.source` byte-esdegerligi + bayrak muhru (`i` / `gi`);
  §10 (8 vaka) `ROOM_PREFIXES.every(p => STOP_WORDS.has(p))` + `size === 110` + kritik
  non-prefix stop-word'ler. **NEGATIF KONTROL KOSULDU:** `zimmer` gecici cikarilinca
  `9g[2]` (oda okunamadi) ve `9i[2]` (prefix TALEBE SIZDI) KIRMIZI dondu — vakalar
  gercekten baglayici. Dongu **SABIT** beklenen listeden surulur: kaynaktan turetilseydi
  prefix dusunce dongu de kisalir ve test **kendini dogrulardi** (ilk denemede bu tuzaga
  dusuldu, duzeltildi).
- **RTL (20. otu):** bu dosyadaki **son ham AR oda-prefix literali KALKTI**. Kalan ham
  non-ASCII: `QUANTITY_UNITS_NONLATIN` AR uyeleri (`:162` — acik borc, bkz. §7) ve
  `номер` Kiril literali (`:71` — LTR, ters-gorunum riski YOK).

### Room-service akisi
| Dosya | Sorumluluk |
|---|---|
| src/lib/menu/parse-order.ts | parseOrder regex kod+adet, extractOrderNote (DIKKAT: src/lib/ai/ ALTINDA DEGIL) |
| src/lib/menu/pending-order.ts | `order_pending_text` ZARFI: `buildPendingText` / `readPendingText` (matematik self-heal) / `orderStampAccepts` / `formatOrderSummary` / **`isStructuredOrder`** (M2 kapisi) / `bumpPendingOrder` (TEK yazma yolu) |
| src/lib/sla/handle-order-callback.ts | damga kapisi -> **M1 atomik claim** -> **M2 dedup (yalniz yapili siparis)** -> **`insertSlaEvent`** + room_service_orders INSERT (**id tutulur**) -> kart; kart basarisizsa **IKISI DE rollback** |
| src/lib/sla/duplicate-guard.ts | **SAF** `isDuplicateRequest` — normalize + Jaccard; pencere/aday/bildirim YOK (cagirana ait) |
| src/lib/sla/insert-sla-event.ts (26. otu) | `sla_events` INSERT'inin **TEK KAYNAGI** + **23505 backstop**: `insertSlaEvent` / `notifyOpenDuplicate` (**FACTORY**) / `findOpenConflict` (dahili) |
| src/lib/utils/pg-error.ts (26. otu) | **SAF** `isUniqueViolation(error)` — SQLSTATE `23505`; cagri yerinde `err.code === '23505'` YAZILMAZ |

(`parsePendingOrder` KALKTI — yerini `readPendingText` aldi; zarf ici `raw` sayesinde
personel kartina ham JSON blob sizmaz.)

### RS-siparis DEDUP + cift-kayit korumasi (IS 2) · sevk `73d92ae` (M1+M2) + `d5b9408` (M2 kapisi)

**KOK SORUN:** tek koruma `conversations.order_pending` BOOLEAN'iydi ve bu bir
OKUMA-SONRA-YAZMA kapisiydi: SELECT ile UPDATE arasi atomik degil. Es zamanli iki
callback (hizli cift tik / Telegram retry) iki AYRI Vercel invocation'da kosar,
ikisi de `order_pending=true` OKUR, ikisi de AYNI damgayi tasidigi icin damga
kapisini gecer -> **cift `sla_events` + cift `room_service_orders` + cift kart**.
Damga (`v`) bunu YAKALAMAZ: o BAYAT buton korumasidir, es zamanlilik degil.

**IKI KATMAN — ayri problemler, ayri cozumler:**

- **M1 ATOMIK CLAIM** (`handle-order-callback.ts`, confirm dali): bayrak temizleme
  artik compare-and-swap — `.update({order_pending:false, order_pending_text:null})
  .eq('id', convId).eq('order_pending', true).select('id')`. Donen dizi BOS ise
  satiri baska invocation almistir -> `replyAlreadyProcessed` + return, INSERT'lerden
  ve alerjen LLM'inden ONCE. **`claimErr` (DB hatasi) "baskasi aldi" SAYILMAZ** —
  o dalda ESKI davranis (devam et) korunur, yoksa siparis sessizce yutulurdu.
  Yerel state guvende: `structured`/`orderText`/`requestText` claim'den ONCE okundu,
  kolonu null'lamak INSERT'leri etkilemez.
- **M2 DEDUP** (INSERT'lerden once, **yalniz YAPILI siparis** — bkz. M2 KAPISI): son
  **3 dk** + **ACIK** (`responded_at` ve `closed_at` NULL) F&B `sla_events` adaylari
  cekilir, `isDuplicateRequest(requestText, [aday], {threshold: 0.5,
  minTokenLength: 1})` ile karsilastirilir. Tutarsa **her iki INSERT ATLANIR**, YENI
  KART ACILMAZ, `sla_events`'e DOKUNULMAZ (SLA saati + eskalasyon korunur); acik
  kartin ALTINA `notifyDuplicateRequest` reply'i duser (HK ile ayni desen) ve
  misafire `order_duplicate_recent` gider.

**M2 KAPISI — bulanik dedup YALNIZ yapili sipariste (17. otu, `d5b9408`):**

`handle-order-callback.ts` confirm dalinda M2 blogunun TAMAMI (aday sorgusu dahil)
`if (isStructuredOrder(structured))` icindedir; else dalinda tek satir log dusup akis
**normal INSERT yoluna** devam eder. Esik `0.5` / `minTokenLength 1` AYNEN korundu —
identik yapili ozet hala 1.0 ile tekrar sayilir. `duplicate-guard.ts` (jenerik),
`housekeeping-forward.ts` (HK cagri yeri) ve `route.ts` DEGISMEDI.

- **KOK SORUN:** serbest metinde Jaccard esige TAM oturuyordu — "bir kahve daha
  istiyorum" {bir,kahve,daha,istiyorum} vs "kahve istiyorum" {kahve,istiyorum} =
  kesisim 2 / birlesim 4 = **0.500** >= esik -> GERCEK ikinci siparis tekrar sanilip
  ILETILMIYORDU. Yon FAIL-SAFE'in TERSI (kayip talep).
- **`isStructuredOrder(structured)`** (`pending-order.ts`, SAF): zarfta `lines` dolu
  mu? YAPILI = `parseOrder` `menu_items` katalogunda en az bir KOD eslestirmis
  (karsilastirilan metin kalem+adet+FIYAT ozeti, ayrisma net). SERBEST = kod yok ya
  da kod katalogda yok -> karsilastirilan metin misafirin ham cumlesi.
- **Serbest metinde koruma M1'dedir:** ayni kartin cift tiki / Telegram retry'i atomik
  claim'de durur. Kapali olan yalniz AYRI akis tekrarinin bulanik yakalanmasidir.
- **BULGU — freeform yol GERCEK, olu kod DEGIL** (17. otu kod okumasi): serbest-metin
  siparis onay karti canli bir yoldur. Zincir: `route.ts:3858`
  `inMenu = hasCodes ? true : await isOrderInMenu(text, supa)` -> urun menude VARSA
  erken return YOK -> `:3899` `structured = hasCodes ? {...} : null` -> `:3902`
  `bumpPendingOrder(..., null)` -> `:3911` **`order_confirm_prompt_freeform`** karti
  (`guest-text.ts`, 5 dilde dolu) + normal `order:confirm` butonlari. Yani backlog #1
  savunma guard'i degil, ERISILEBILIR bir bug idi. `isOrderInMenu` fail-safe TRUE
  (menu bos / Haiku suphede / hata -> var say) oldugundan menusu yuklenmemis tenant'ta
  HER serbest-metin siparis bu yoldan gecer.
- **TEST TUZAGI:** serbest-metin testi icin urun MENUDE OLMALI. Menude olmayan urun
  (`kahve`) `isOrderInMenu`=false doner -> `menu:show` kademeli oneri dalina duser,
  onay karti HIC cikmaz -> callback'e ulasilmaz. Dogru test girdisi: **menudeki bir
  urunu KODSUZ istemek** (canli mühürde `cay`).
- **CANLI CIFT MUHUR (`dpl_7ejo`, 17. otu UAT):** *Test A* serbest `cay` x2 -> **2 ayri
  kart** acildi, log `[order-confirm] DEDUP atlandi: serbest-metin siparis` x2.
  *Test B* yapili `RS03` x2 -> dedup tetiklendi, `INSERT atlandi`, ikinci kart YOK.

**PARAMETRELER — neden HK'den FARKLI:**
| | housekeeping | F&B siparis |
|---|---|---|
| pencere | 10 dk | **3 dk** (siparis tekrari mesru: "bir kahve daha") |
| `minTokenLength` | 3 (varsayilan) | **1** |

`minTokenLength` **kritik**: varsayilan 3, tek haneli miktar rakamlarini ELER —
"2 cay" ile "3 cay" AYNI kume olur. HK'de bu bugunku canli davranistir (korundu);
F&B'de MIKTAR gercek bir siparis farkidir, ayni sayilirsa misafirin eline yanlis
adette urun gider. Kod-bazli sipariste fiyat da degistigi icin ayrisma net
(`• Kahve × 2 = 100 TL...` vs `× 3 = 150 TL...` -> 0.43 < 0.5).

**KONUM KARARI:** M2, `sla_events` INSERT'inden once ama **inhouse ve alerjen
sorgularindan da ONCE**. Dup dalinda kart GONDERILMEDIGI icin oda/isim ve alerji
uyarisi kullanilmaz; alerjen dalindaki `translateToTurkish` bosa bir LLM cagrisi
olur ve callback'i uzatarak Telegram retry riskini buyutur.

**LOG SATIRLARI (canli UAT olcutu):** `[order-cb] RED atomik claim` (M1 kaybeden
invocation) · `[order-confirm] DEDUP: INSERT atlandi, yeni kart acilmadi` (M2 tuttu) ·
**`[order-confirm] DEDUP atlandi: serbest-metin siparis`** (M2 kapisi KAPALI, akis
INSERT'e devam etti) · `[dup-notify] gonderildi` (personel reply'i dustu).

**KAPSAM DISI (bilincli):** `cancel` dali claim ALMAZ (cift iptal zararsiz);
**serbest metinde bulanik dedup YOK** — ayni cumle 2 kez onaylanirsa 2 kart acilir
(fazladan kart, kayip talepten iyidir; bkz. §7).
(GUNCELLEME 18. otu: "webhook seviyesinde `update_id` dedup'i YOK" kaydi ARTIK
GECERSIZ — giriste gate var, bkz. §2 *Webhook-girisi update_id dedup*. M1 yine de
gerekli: gate retry'i keser, M1 cift-tik'i.)
(**GUNCELLEME 26. otu:** "`sla_events`/`room_service_orders` uzerinde DB UNIQUE
constraint YOK" kaydi **KISMEN GECERSIZ** — `sla_events`'te artik **ACIK KAYIT**
partial unique VAR (`031`, bkz. asagidaki bolum). `room_service_orders`'ta hala
YOK ve BILINCLI olarak yok. M1 yine de gerekli: constraint yalniz **tam metin
esitligini** yakalar, M1 ise ayni kartin es zamanli iki callback'ini.)

### sla_events cift-kayit DAR-GUVENLI BACKSTOP (backlog #3 — UNIQUE) · sevk `9dcf48a` (26. otu) — **PROD + migration 031 CANLI**

**NUMARA CAKISMASI — DIKKAT:** bu "#3", 18. oturumun "#3 update_id dedup"undan
**AYRI** bir borctur (o KAPANDI, bkz. asagidaki bolum). Buradaki #3 = §7'nin
"B) VERI BUTUNLUGU — UNIQUE constraint" maddesi.

**KOK SORUN:** `sla_events` INSERT'i **DORT ayri yerde** elle yaziliydi ve cift-kayit
korumasi **akis-basina + BULANIK**ti: F&B'de M1 claim + M2 Jaccard (3 dk, yalniz
yapili), HK ve genel forward'da 10 dk'lik ayni bulanik kapi, `[reverify-forward]`
yolunda ise **HIC dedup YOK**. Yeni bir INSERT noktasi acilirsa garantiyi otomatik
ALMIYORDU; repoda `sla_events` yolunda **hicbir 23505 yakalama** da yoktu.

**NEDEN NAIVE COZUM REDDEDILDI (karar gerekcesi — tekrar acilmasin):**
- **DB UNIQUE = TAM ESITLIK; app dedup = BULANIK.** Constraint, Jaccard 0.5'i
  taklit EDEMEZ. En fazla onun **dar bir alt kumesi** olabilir.
- **Zaman penceresi index'te IFADE EDILEMEZ.** `created_at >= now() - 3 dk` bir
  UNIQUE index'e yazilamaz; pencerenin index karsiligi **"kayit hala ACIK mi"**
  yaklasimidir (personel karta bastiginda satir index'ten DUSER).
- **Canli veri naive anahtari TUTMUYOR (25+26. otu olcumu):** `sla_events`
  (conversation_id, department_code, request_text) uzerinde **21 grup / 62 fazla
  satir**, en buyuk grup **14**; `room_service_orders` (conversation_id, items)
  **7 grup / 20 fazla satir**. Fazla satirlarin **~%60'i (37/62) 1 SAATTEN uzun**
  arali, en uzunu **9 gun** -> bunlar yaris DEGIL, **misafirin gercekten yeniden
  istedigi seyler**. "Temizle sonra UNIQUE kur" = **veri imhasi**; kosulsuz UNIQUE
  = mesru ikinci talebin **sessiz 23505 kaybi**.
- **Ölçüm ayrimi:** ≤3 dk'lik 4 tekrarin **hepsi** M1/M2 sevkinden (`73d92ae`,
  2026-07-31) ONCE olusmus; sonrasinda kisa-arali tekrar YOK.

**COZUM — UC PARCA:**

| Parca | Yer | Not |
|---|---|---|
| `isUniqueViolation(error)` | `src/lib/utils/pg-error.ts` (**YENI**, SAF) | `error?.code === '23505'`. **Mesaj metni OLCUT DEGIL** (surum/lokalizasyon ile degisir); tip KATI (sayi `23505` -> false) |
| `insertSlaEvent(supa, row, onDuplicate?)` | `src/lib/sla/insert-sla-event.ts` (**YENI**) | happy-path `.insert(row).select('id').single()` — eski 4 sitedeki zincirin **BIREBIR aynisi**. Donus: `{ok:true,id}` / `{ok:false,duplicate:true}` / `{ok:false,duplicate:false,error}` |
| `031_sla_events_open_unique.sql` | `migrations/tenant/` | **partial** UNIQUE: `(conversation_id, department_code, md5(request_text))` WHERE `responded_at IS NULL AND closed_at IS NULL` |

- **`notifyOpenDuplicate` bir FACTORY'dir — CAGRI ANINDA IS YAPMAZ.** Senkron
  fonksiyondur (`async` DEGIL), tek `return async (existing) => {...}` tasir;
  cagri yerinde `insertSlaEvent(supa, row, notifyOpenDuplicate(botToken, chatId,
  text))` yazmak yalnizca closure uretir. **OLCULDU** (sahte-fetch probe'u):
  factory cagrisinda fetch **0**, donen fn cagrilinca fetch **1**. Amaci 23505
  bildirimini TEK KAYNAKTA tutmak — 4 sitede `notifyDuplicateRequest` cagrisi
  kopyalanmaz, her site yalniz kendi baglamini (botToken + **kendi fallback chat
  id'si** + tekrarlanan metin) verir.
- **`md5()` NEDEN:** `request_text` uzun olabilir, btree anahtar boyu sinirlidir
  (~2704 byte). Karar semantigi metin ESITLIGIDIR; md5 onun kisaltilmis anahtari.
  `findOpenConflict` ise PostgREST filtrede fonksiyon cagiramadigi icin **tam metin
  esitligi** kullanir — AYNI satir kumesini secer.
- **CAGRI YERI DAVRANISI KORUNDU (4 site, her biri KENDI dedup dalini tekrarlar):**
  F&B -> M2 dup dalinin AYNISI (misafire `order_duplicate_recent` + kart etiketi +
  toast) · HK -> `{ok:true, duplicate:true}` · genel forward -> `continue` ·
  `[reverify-forward]` -> log-only (o yolda bulanik dedup zaten YOKTU).
- **DAVRANIS-KORUYUCU OLDUGU OLCULDU, varsayilmadi:** dort payload blogu ONCE/SONRA
  cikarilip **SHA256** alindi -> `01acaad816ff1546` · `53faa48fb1974484` ·
  `d7a975c22646d07f` · `47b1e438d20203e0`, **4/4 AYNI, 0 fark**. Ayrica sahte-client
  probe'u: happy-path izi tam olarak `from('sla_events').insert(row).select('id')
  .single()` — **EK DB CAGRISI YOK**, `onDuplicate` cagrilmaz, Telegram'a gidilmez.
- **`room_service_orders` — 2 DEFEKT duzeltildi (constraint YERINE):**
  (a) **oksuz satir**: kart gonderilemedigi dalda `sla_events` siliniyor ama rso
  satiri KALIYORDU -> artik INSERT `.select('id').single()` ile id tutar ve AYNI
  dalda o da silinir. (b) **sessiz hata**: rso INSERT hatasi yalnizca duz bir
  `console.error`di -> artik `[order-confirm] RSO INSERT FAILED` markeri + `code`.
  **Kart BLOKLANMAZ** (misafir servisi kesilmez) — kayit IKINCILDIR.
- **LOG SATIRLARI (canli UAT olcutu):** `[sla-insert] 23505 UNIQUE — yeni kart
  acilmadi` (backstop tuttu; `conversationId` + `dept` + `openConflictId`) ·
  `[sla-insert] cakisan acik kart sorgusu hatasi:` · `[sla-insert] onDuplicate
  hatasi:` · `[order-confirm] RSO INSERT FAILED` · `[order-confirm] RSO ROLLBACK
  OK` / `RSO ROLLBACK FAILED — oksuz siparis kaydi kalabilir` · `[dup-notify]
  gonderildi` (personel reply'i dustu).
- **SIRA BAGLAYICIYDI: ONCE kod (olu dal) deploy, SONRA constraint.** `9dcf48a`
  deploy edildiginde 031 henuz uygulanmamisti -> `isUniqueViolation` asla true
  donmuyordu, davranis gecis oncesiyle BIREBIR ayniydi. Index ayri bir adimda,
  **fail-safe gate** (acik alt kumede cakisma sorgusu -> **BOS**) gecildikten sonra
  uygulandi. Ters sira, 23505'i YAKALAYAN kod prod'a cikmadan once sessiz kayip
  penceresi acardi.
- **CANLI BOT UAT'i BEKLIYOR:** index'in VARLIGI `pg_indexes` ile kanitli, ama
  "ikinci INSERT gercekten reddediliyor ve personele reply dusuyor" zinciri
  UCTAN UCA olculmedi. `[sla-insert] 23505 UNIQUE` satiri prod'da HENUZ gorulmedi.

### Webhook-girisi update_id dedup (backlog #3) · sevk `df3f6b5` (18. otu)

**KOK SORUN:** Telegram, yaniti gec/hatali gorurse **AYNI update'i TEKRAR gonderir.**
Koruma bugune kadar akis-basinaydi: `order:` akisinda M1 atomik claim, `note:` / `hk:`
akislarinda YALNIZ damga (`v`). Damga BAYAT BUTON korumasidir — ayni damgayi tasiyan bir
RETRY'i memnuniyetle gecirir. Yani note:/hk:/duz-mesaj yolunda retry korumasi **YOKTU**.

| Dosya | Sorumluluk |
|---|---|
| src/lib/telegram/update-dedup.ts (**YENI**) | `extractUpdateId` (SAF, is8 §u1-u10) + `claimTelegramUpdate` (IO, upsert `ignoreDuplicates`) |
| .../webhooks/telegram/[hotelSlug]/route.ts | **:341 gate** — body parse SONRASI, TUM dispatch dallarindan ONCE |
| src/app/api/cron/health-check/route.ts | per-hotel dongude 24 saatlik TTL supurmesi (ayri try/catch) |
| migrations/tenant/029_processed_telegram_updates.sql | tablo: `(hotel_slug, update_id)` PK + `idx_ptu_seen_at` |

- **M1 ile ILISKI — TAMAMLAYICI, ikisi de kalir.** M1 = misafirin hizli **CIFT TIK**'i
  (IKI FARKLI `update_id`) -> bu kapi onu GECIRIR. Bu gate = **ayni update'in tekrar
  teslimi** (ayni `update_id`) -> M1 bunu yalniz siparis akisinda yakalardi. M1'e
  DOKUNULMADI.
- **ANAHTAR `(hotel_slug, update_id)`:** `update_id` **BOT BAZINDA** artar, global
  DEGIL. Slug olmasa bir otelin update'i digerini susturabilirdi (canli probe ile
  dogrulandi: ayni id + farkli slug -> `true`).
- **ATOMIKLIK okuma-sonra-yazma DEGIL:** karar PRIMARY KEY catismasindan gelir.
  `upsert(..., {ignoreDuplicates:true}).select()` catismada **BOS DIZI** doner ->
  `.insert()` + `error.code==='23505'` fallback'ine **GEREK KALMADI** (canli probe
  kaniti; tahminle birakilmadi).
- **GATE'IN YERI:** hotel/token/tenant-client cozumunden SONRA, cunku update govdesi
  ancak orada parse ediliyor. Sonuc: bir retry uc okumayi yine oder — **yan etki
  uretmez** ama "sifir maliyet" degildir (bkz. §7).
- **KAPSAM DISI (bilincli):** `telegram-manager` webhook'u — `src/lib/telegram/commands/*`
  altinda `.insert(`/`.update(`/`.upsert(`/`.delete(` **HIC YOK**, komutlar yalniz rapor
  uretir; retry en fazla ayni raporu tekrar gonderir. ManyChat'e dokunulmadi.
- **`telegram/types.ts:42` `update_id` artik OKUNUYOR** (eskiden tanimliydi ama hicbir
  yerde kullanilmiyordu — o kayit ARTIK GECERSIZ).
- **LOG SATIRLARI (canli teshis):** `[update-dedup] first-seen update_id=... slug=...`
  (normal trafik) · `[update-dedup] skip duplicate update_id=... slug=...` (retry
  kesildi) · `[update-dedup] no update_id, dedup atlandi` (kimlik okunamadi) ·
  `[update-dedup] claim-error, devam` (DB hatasi, fail-safe).

### Misafir dili (IS 10 — KALICI DIL) · sevk `1cc5efb`

**KOK SORUN:** callback turunda (misafir butona basti) ortada MESAJ METNI YOKTUR →
dil tespit edilemez. Bu yuzden `handle-order-callback` / `handle-note-callback`
`lang='tr'` HARDCODE tasiyordu (en/de dallari OLU KOD) ve RU/AR misafir tum
siparis/not/housekeeping akisinda Turkce cevap aliyordu. Telegram arayuz dili
(`language_code`) olcut DEGILDIR: arayuzu Turkce olan misafir Rusca yazar (IS 17).

**COZUM:** dil, GUVENILIR bilindigi anda konusmaya YAZILIR; callback'ler ORADAN okur.

| Dosya | Sorumluluk |
|---|---|
| src/lib/i18n/guest-text.ts | **TEK KAYNAK.** `guestText(key,lang,params)` 5-dil sozluk (tr/en/de/ru/ar) + `resolvePreferredLang` / `readPreferredLang` / `withPreferredLang` / `ALL_GUEST_TEXT_KEYS` / `PREFERRED_LANG_METADATA_KEY`. SAF: IO yok |
| route.ts ~2766 | **YAZMA** — `withPreferredLang` MERGE, yalniz DEGISINCE, `[lang-persist]` log |
| route.ts ~1322 | `persistedLang` — classify ONCESI dallarin dili |
| handle-order/note/housekeeping-callback.ts | **OKUMA** — `conv.metadata` -> resolver |

- **Depo: `conversations.metadata.preferred_language` (jsonb) — MIGRATION YOK.** Kolon
  eklemek migration ister; lead akisi (lead-capture.ts) ayni metadata'yi zaten
  kullaniyor. Yazma MERGE'dir: `lead_capture` EZILMEZ (kor UPDATE YASAK).
- **`resolvePreferredLang` sirasi BAGLAYICI: `detected` > `stored` > `interfaceLang`.**
  `detected` = O TURUN classify tespiti (taze) — route.ts `advanceHousekeeping`'e
  `guestLang` gecer, bu ARAYUZ dili DEGILDIR, bu yuzden `detected` slotuna verilir.
  Yanlis slot = bayat kalici dil taze tespiti EZER (bir kez yasandi, `d22cc5e`).
  Ilk DOLU aday kazanir ve `normalizeGuestLang`den gecer: destek disi kod ('fr')
  -> 'en', ALTTAKI adaya DUSMEZ (yoksa Fransiz'a gecmisten kalma Rusca giderdi).
- **`readPreferredLang` kayit yoksa `null` doner** ('en' DEGIL): "kayit yok" ile
  "kayitli dil en" ayni sey degildir, fallback'i cagiran isletir.
- **Callback fallback'i `'tr'`** (guest-text varsayilani 'en' DEGIL): bu sevkten
  ONCE acilmis konusmalarda kalici dil yoktur ve o botlar Turkce konusuyordu.
- **classify ONCESI dallar `persistedLang` kullanir:** B4 alerjen cevabi, not
  yakalama, 17.7-B isim eslesmesi, spa iletisim, AI fallback. (classify SONRASI
  olcut `guestLang`dir — daha tazedir.)
- **ISTISNA — `order:noop` (route.ts:399) BILINCLI `'tr'`:** callback_data convId
  TASIMAZ (64-byte siniri) ve o dalda conversation YUKLU DEGIL; dil ancak ek bir
  `telegram_chat_id` sorgusuyla okunurdu. Yol nadir (pasif butona ikinci basim),
  gerekce cagri yerinde yazili. Metin yine guest-text.ts'te.
- **RTL/Arapca — GOZ KARARI YASAK.** ar metinleri relay/diff'te TERS gorunur;
  dogrulama `is8-guest-lang-test.ts` §12'de: beklenen KOK **kod noktasindan** kurulur,
  metinde ARANIR ve TERS yazimi BULUNMAMALIDIR. 38/38 Tier-2 anahtari kapsanir,
  `12z` sayaci kapsam disi anahtar eklenirse kirmiziya doner. §6'nin noktalama
  tripwire'i yalniz '؟' ile BITEN cumleleri yakalar — duz cumle reversal'ini
  ancak §12 yakalar. Cekim eki degisebilir: KOK aranir ("ملاحظتك" icinde "ملاحظ").
  **Ayni kural KAYNAK KODU icin de gecerli (20. otu):** AR sabitleri kaynaga LITERAL
  yazilmaz, `String.fromCodePoint`ten kurulur; verify-guest.ts'in son ham AR
  oda-prefix literali bu yuzden kalkti (bkz. *Oda-prefix TEK KAYNAK*). Bir ham AR
  literalini SILMEDEN once codePoint'ini OLC — goz karariyla "ayni" deme.
- **Ceviri unutma kapisi:** §11 `ALL_GUEST_TEXT_KEYS`i (sozlukten TURER, elde liste
  YOK) gezer; her anahtar 5 dilde DOLU ve `ru != tr`, `ar != tr` olmak zorunda.

### Ortak
| Dosya | Sorumluluk |
|---|---|
| src/lib/ai/anthropic-client.ts | callAI wrapper, AI_PROVIDER env toggle (anthropic <-> openai) |
| src/lib/ai/translate-to-turkish.ts | personel karti TR ceviri |
| src/lib/ai/hotel-context.ts | buildHotelContext / formatContextForPrompt -> prompt bilgi tabani blogu (DIKKAT: src/lib/knowledge/ ALTINDA DEGIL) |

### src/lib/ai/ tam dosya listesi (13. oturumda canli dizinle karsilastirildi — 20 dosya)
`social-intent-override.ts`, `safety-classifier.ts`, `verification-intents.ts`,
`message-types.ts`, `system-prompts.ts`, `anthropic-client.ts`, `parse-stay-query.ts`,
`detect-room-detail-intent.ts`, `detect-price-intent.ts`, `barboon-live.ts`,
`room-price-tool.ts`, `translate-to-turkish.ts`, `enforce-reply-language.ts`,
`hotel-context.ts`, `classify-and-respond.ts`, `department-brains.ts`,
`event-contact-gate.ts`, `spa-context.ts`, `fallback-texts.ts`, `script-guard.ts`

Onceki "16 dosya" kaydi EKSIKTI; asagidaki 4'u tasimiyordu (hepsi SAF/yardimci):
| Dosya | Sorumluluk |
|---|---|
| event-contact-gate.ts | IS 13/17 etkinlik-iletisim karari: `decideEventContactForward`, `shouldFireFalsePromiseGuard` + **fiyat/re-verify kapilarinin negatif guard'i `preferEventOverPrice`** |
| spa-context.ts | `isSpaContext` — spa mesajini canli fiyat kapisindan muaf tutan deterministik guard (`preferEventOverPrice`in ikizi) |
| fallback-texts.ts | `NO_INFO_FALLBACK_TR` — "bilgi yok" cevabinin TEK sabiti (beyinler yalan vaat uretmesin) |
| script-guard.ts | Alfabe kapisi — cevabin yabanci alfabeye kaymasini yakalar (`enforce-reply-language` ile birlikte) |

### src/lib/i18n/ tam dosya listesi (13. oturumda eklendi — 1 dosya)
| Dosya | Sorumluluk |
|---|---|
| guest-text.ts | **Misafire donuk SABIT metinlerin TEK KAYNAGI.** 5-dil sozluk (tr/en/de/ru/ar) + `guestText(key,lang,params)`; IS 10 kalici dil: `resolvePreferredLang` (detected>stored>interfaceLang), `readPreferredLang` (kayit yoksa null), `withPreferredLang` (metadata MERGE), `ALL_GUEST_TEXT_KEYS` (is8 kapsam kilidi), `PREFERRED_LANG_METADATA_KEY`. SAF: IO/ag/LLM YOK |

### src/lib/lead/ tam dosya listesi (13. oturumda eklendi — 1 dosya)
| Dosya | Sorumluluk |
|---|---|
| lead-capture.ts | IS 18 etkinlik lead akisi (SAF): `startLeadCapture` / `advanceLead` / `isLeadAbandon` / `decideLeadNotify` / `buildLeadFinalCard` + `conversations.metadata.lead_capture` state okuma-yazma (`readLeadCapture` / `withLeadCapture` / `clearLeadCapture`) |

### src/lib/sla/ tam dosya listesi (16. oturumda canli dizinle TEYIT EDILDI — 12 dosya, eksik yok)
`handle-reception-reply.ts`, `check-runner.ts`, `handle-callback.ts`,
`handle-menu-offer-callback.ts`, `send-forward-with-buttons.ts`, `handle-order-callback.ts`,
`handle-note-callback.ts`, `handle-housekeeping-callback.ts`, `housekeeping-forward.ts`,
`notify-duplicate.ts`, **`duplicate-guard.ts`** (16. otu — IS 2),
**`insert-sla-event.ts`** (26. otu — backlog #3 backstop)

### Multi-tenant architecture (the core mental model)

There is **one Central Supabase DB** ("ours") and **one separate Supabase DB per hotel**. Hotel data (guests, conversations, requests, departments, knowledge, SLA events) lives in the *hotel's own* DB — never in Central.

- **Central DB** holds: `hotels`, `packages`, `channel_routing`, `bridge_credentials`, `master_admins`, `master_admin_sessions`, `system_safety_responses`, group-admin tables. Accessed via `getCentralSupabase()` (`src/lib/supabase-client.ts`) or `getCentralServerClient()` (cookie-aware, `src/lib/supabase/central-server.ts`). Uses `CENTRAL_SUPABASE_URL` + `CENTRAL_SUPABASE_SERVICE_ROLE_KEY`.
- **Each hotel's Supabase URL + service/anon key + Telegram bot token** are stored **encrypted** in Central's `bridge_credentials` table. Encryption is **AES-256-GCM** (`src/lib/encryption.ts`, `encryptCredential`/`decryptCredential`), keyed by `ENCRYPTION_MASTER_KEY` (64 hex chars). Format: `base64(iv[12] || authTag[16] || ciphertext)`.
- **Resolving a tenant → a hotel-DB client** happens two ways:
  - By **channel id** (inbound messages): `resolveTenant(channelType, channelId)` in `src/lib/tenant-resolver.ts` → looks up `channel_routing` → decrypts bridge creds → returns a `SupabaseClient` for that hotel's DB.
  - By **slug** (admin panels, webhooks, migrations): `getHotelBySlug()` (`src/lib/tenant/get-hotel-by-slug.ts`), `resolveTenantBySlug()` (`src/lib/hotel-admin/tenant.ts`), `getHotelClient(hotelId)` (`src/lib/tenant/get-hotel-client.ts`), `getDecryptedBridge()` (`src/lib/tenant/decrypt-credentials.ts`).
- All tenant resolvers keep a **5-minute in-memory cache** (per Vercel instance). When `bridge_credentials` change, call `invalidateTenantCache` / `invalidateSlugCache` / `clearHotelClientCache`.
- **`demo-hotel` is special-cased**: it reads creds straight from env (`DEMO_HOTEL_SUPABASE_URL`, `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN_DEMO`) instead of `bridge_credentials`. Look for `if (slug === 'demo-hotel')` branches when touching tenant/token resolution.

**Implication:** almost every server action/route first resolves the hotel, then does all data work through that hotel's `SupabaseClient`. Never query hotel data on the Central client.

### Inbound message pipeline (Telegram guest webhook)

Entry point: `src/app/api/webhooks/telegram/[hotelSlug]/route.ts` (~2600 lines — the heart of the guest flow). `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. Sibling webhooks: `manychat/[hotelSlug]` (WhatsApp/Instagram via ManyChat; returns ManyChat's `{version:'v2', content:{messages}}` shape) and `telegram-manager/[hotelSlug]` (the manager bot — slash commands like `/durum`, `/rapor`, handled by `src/lib/telegram/commands/*`).

Order of processing in the guest webhook (each is an early-return gate):
1. **Secret check** — header `x-telegram-bot-api-secret-token` vs `TELEGRAM_WEBHOOK_SECRET` (`verifyTelegramSecret`).
2. **Resolve hotel** by slug; resolve bot token + hotel DB client.
2b. **`update_id` gate (:341)** — body parse SONRASI, TUM dispatch dallarindan ONCE: `extractUpdateId` + `claimTelegramUpdate` (`src/lib/telegram/update-dedup.ts`). Tekrar teslim -> `{ok:true}` 200, YAN ETKI YOK. Kimlik okunamaz ya da DB hatasi -> dedup ATLANIR, mesaj ISLENIR (fail-safe).
3. **`callback_query`** → SLA inline-button handlers (`handleSlaCallback`).
4. **Group reply to an SLA escalation** → `handleReceptionReply`.
5. In `handleMessage`: **rate limit** (10 msg / 60 s per user, in-memory), **voice** (Telegram audio → `downloadTelegramAudio` → `whisperTranscribe` (OpenAI Whisper)), **non-audio media filter**, **URL filter** (regex, blocks links), `/start` & `/help`.
6. **In-house matching gate (Module 17.c)** — links the Telegram user to a row in `inhouse_guests_v2` by room number (and name if a room has multiple guests). Unmatched → notifies the front-office group.
7. **AI classify + respond** (see below).
8. **Verification flow** (`handleVerificationFlow`) — personal/operational intents require the guest to prove identity (room + first + last name) against `inhouse_guests_v2` (falls back to legacy `inhouse_guests`). Max attempts then locks and alerts front office.
9. **Forward to department(s)** for actionable intents; reply to guest.

The webhook always returns `{ ok: true }` (HTTP 200) even on internal error, and on a thrown error it posts a "🔴 BOT HATASI" alert to the front-office Telegram group — Telegram must never see a non-200 or it retries.

### AI layer (`src/lib/ai/`)

Two-stage, both Anthropic but different models:
- **Safety pre-classifier** (`safety-classifier.ts`) runs first with **Haiku** (`claude-haiku-4-5-20251001`) against active rules from Central `system_safety_responses`. A match short-circuits with a focused safe reply; the department classifier never runs.
- **Orchestrator** (`classify-and-respond.ts`) calls the **default Claude model** (`anthropic-client.ts` `DEFAULT_MODEL`), `temperature: 0.3`. The system prompt is built by `system-prompts.ts` (`buildOrchestratorSystemPrompt`) + the full hotel context injected by `hotel-context.ts`. The model must return **strict JSON** (`reply_text`, `intents[]`, `confidence`, `reasoning`, `answered_from_knowledge`); code strips ```json fences and parses it.
- **Intent → department routing** is rule-based in `routeIntentToDepartment` (`classify-and-respond.ts`): `NON_FORWARDING_INTENTS` (greeting/chitchat/knowledge_query…) never forward; `OPERATIONAL_INTENTS` go to their own dept (`room_service`→`fb`); `PERSONAL_INTENTS` (allergy/billing/lost_and_found) → `front_office`; `complaint` → `guest_relation`. `social-intent-override.ts` and `verification-intents.ts` further gate behavior.
- **Hard rule encoded throughout the prompt:** the bot answers ONLY from the hotel context/knowledge — **never invent** hours/prices/capacity, and never deflect to reception when the info IS present.

### Hotel context & knowledge (`src/lib/ai/hotel-context.ts`, `src/lib/knowledge/`, `src/lib/perplexity/`)

`buildHotelContext()` assembles the AI's grounding from the hotel DB: `hotel_settings` (name, address, phone, check-in/out, wifi, `meeting_rooms`/`meeting_equipment` JSONB), `hotel_facts`, `hotel_documents` (delivery policy: `auto_text`/`auto_file`/`manual_only`), `location_info`, and `perplexity_discoveries`. Safety rules come from Central. A **knowledge summary** is cached 5 min (`src/lib/knowledge/cache.ts`, `getCachedSummary`) — **every knowledge CRUD endpoint must call `invalidateSummary(hotelId)`** or the bot serves stale info for up to 5 min. **Perplexity** is on-demand "discovery" of nearby places keyed by an interest tag from `detectInterestTag()` (multilingual keyword map) and surfaced as `perplexity_discoveries` rows; managers trigger discovery from the panel (`/api/manager/perplexity/discover`). Uploaded documents (PDF/DOCX/XLSX) are parsed in `src/lib/documents/parser.ts` and summarized by `ai-summarizer.ts`.

### Department forwarding & SLA (`src/lib/telegram/`, `src/lib/sla/`)

- `forward-to-department.ts` posts the request to the department's Telegram group **and** DMs on-shift staff (`getActiveStaffNow`), writing `forwarded_messages` rows. `off-hours.ts` (`resolveTargetDepartment`) reroutes to reception when a department has `off_hours_behavior='forward_to_reception'` and is outside `working_hours` (Europe/Istanbul time).
- SLA flow (Module 11): forwards can be sent with inline buttons (`send-forward-with-buttons.ts`); button presses → `handle-callback.ts`; reception replying to an escalation message → `handle-reception-reply.ts`.
- `src/lib/sla/check-runner.ts` (`runSlaCheck`) scans each hotel's `sla_events`: overdue dept events → escalate to front office and set a reception deadline; overdue reception → auto-close as `no_response`.

### Cron jobs (`vercel.json`, `src/app/api/cron/`)

Two Vercel Cron jobs, both daily at 00:00 (`vercel.json`), authed by `Authorization: Bearer ${CRON_SECRET}`:
- `/api/cron/health-check` — bridge health check for all active hotels **and** runs `runSlaCheck` (SLA scan is piggybacked here to stay within the Vercel Hobby 2-cron limit; the comment says "her dakika" but the schedule is currently daily — adjust the schedule if you need minute-level SLA). 18. otu: ayni per-hotel donguye **`processed_telegram_updates` 24 saatlik TTL supurmesi** eklendi (kendi try/catch'inde — tablosu migrate edilmemis tenant SLA taramasini BOZAMAZ).
- `/api/cron/archive-checked-out` — archives checked-out guests.

### Migrations (`src/lib/migrations/`, `migrations/`)

Versioned, idempotent SQL applied **per hotel DB at runtime** — not a CLI step.
- Tenant migrations live in `migrations/tenant/NNN_*.sql` (3-digit, idempotent, each wrapped in BEGIN/COMMIT; never edit an applied file — add a new one). **En yuksek numarali dosya (27. otu): `032_db_hardening_revoke_anon_rls.sql`** — DB-KATMAN HARDENING: `public` semada anon/authenticated/PUBLIC'ten tablo+sequence+fonksiyon yetkilerini REVOKE eder, service_role'e GRANT geri verir, `ALTER DEFAULT PRIVILEGES REVOKE` ile gelecek grant'lari keser ve **her public tabloda RLS ENABLE** eder (policy yok -> deny-by-default; service_role bypass). **v5 + demo tenant'a UYGULANDI** (`exec_sql`/postgres-definer, preflight owner-assert=0), katalog ile teyit (`anon_*=false`, `rls_kapali=0`, `svc_*=true`). Central ikizi **`migrations/central/011_db_hardening_revoke_anon_rls.sql`** — hotelgen-central PROD SQL Editor'den CANLI (`anon_bridge=false`, `rls_off=0`, `svc_ok=true`). **DIKKAT — `schema_migrations`'a DUSMEDI** (dogrudan exec_sql / SQL Editor — 029/030/031 ile ayni yol). Tablo/kolon/veri DEGISTIRMEZ (yalniz grant/RLS). Onceki: **`031_sla_events_open_unique.sql`** (26. otu) — `sla_events` uzerinde **partial UNIQUE index** (`conversation_id, department_code, md5(request_text)` WHERE `responded_at IS NULL AND closed_at IS NULL`). Tablo/kolon YARATMAZ, veri DEGISTIRMEZ; **v5 tenant'a UYGULANDI** ve `pg_indexes` ile teyit edildi. **DIKKAT — `schema_migrations`'a DUSMEDI:** `exec_sql` RPC'si DOGRUDAN cagrildi (runMigrations akisi degil), o yuzden kayit satiri yazilmadi. Bu YENI bir tutarsizlik DEGIL: canli tabloda en yuksek kayit **"020"** (toplam 19 satir) — 021..031 arasi HICBIRI kayitli degil, 029/030 da ayni yoldan uygulanmisti. Pratik etki: panelden migration kosulursa 031 "uygulanmamis" gorunup TEKRAR kosar; `CREATE UNIQUE INDEX IF NOT EXISTS` sayesinde **no-op**, zararsiz. Onceki: **`030_rate_limit_counters.sql`** (25. otu) — yeni tablo + `rate_limit_hit()` fonksiyonu, ADDITIVE ve GUVENLI (mevcut kolon/veriye dokunmaz). Dollar-quote etiketi BILINCLI olarak `$rate_limit_hit$`: dosya runner tarafindan `exec_sql(sql text)` icine PARAMETRE olarak gecer ve `exec_sql`in kendi govdesi `$$` kullanir. Onceki: `029_processed_telegram_updates.sql` (18. otu). **IKISI DE YALNIZ v5 tenant'a uygulandi**; her YENI tenant'ta calistirilmasi gerekir. Kosulmazsa iki koruma da fail-safe/fail-open yonde SESSIZCE devre disi kalir: `claimTelegramUpdate` `true` doner (dedup yok), `claimRateLimit` `allowed=true, degraded=true` doner (limit yok). Davranis eskisiyle ayni, bozulma yok — ama koruma da yok. (Not: `021_*` yok — numaralandirma 020'den 022'ye atliyor; bu bilinen bir bosluk, sorun degil. Onceki kayit "027" idi, 028 zaten mevcuttu — duzeltildi.) Central migrations in `migrations/central/`. `loadMigrations` skips `000_*` (bootstrap, creates the `exec_sql` RPC — chicken-and-egg) and skips `007_drop_deprecated.sql` unless `includeDestructive`.
- `runMigrations({ hotelSlug })` (`runMigrations.ts`) decrypts the hotel bridge, builds a tenant client, ensures `schema_migrations`, and runs unapplied files via the **`exec_sql` RPC** (SQL executed through a Postgres function, not the JS query builder).
- Triggered from admin UI / API: `/api/admin/migrations` (tenant), `/api/admin/central-migrations`, `/api/admin/hotels/[id]/run-migrations`, with a `migrations` admin page. Also `seedBaseline` / `runBootstrap`.
- **Single source of truth for tenant schema = `migrations/tenant/*`.** The legacy `sql/0x` hotel-side files (`05_hotel_schema` … `12_*`) are DEPRECATED/archive only — pre-migration manual "Supabase SQL Editor" bootstrap; never re-run them. (A15/AUDIT D7, resolved 2026-06-01: a read-only probe of both live tenants — demo-hotel + green-park-test — confirmed **no schema drift**; both are pure 001-chain. Only live difference: `match_documents()` RPC present on demo, absent on green-park → a Phase-C/RAG follow-up, not a schema conflict.)

### Auth, roles & route structure

Three independent auth systems, three cookies, enforced in `src/middleware.ts` (file MUST be named `src/middleware.ts` — renaming it disables all protection; the file header documents a prior incident where it was `proxy.ts` and `/admin/*` was unprotected):

| User | Login | Cookie | Mechanism | Routes |
|------|-------|--------|-----------|--------|
| Master admin / manager | `/admin/login`, `/manager/login` | `hg_admin_session`, `hg_manager_session` | Opaque token, **SHA-256 hash stored in Central `master_admin_sessions`** (`src/lib/auth/session.ts`, `manager-session.ts`). Roles `super_admin`/`admin` only. | `/admin/*`, `/manager/*` |
| Hotel admin (owner + dept managers) | `/hotel-admin/[slug]/login` | `hg_hotel_session` | **JWT (jose, HS256)** signed with `HOTEL_ADMIN_JWT_SECRET`, verified against hotel DB `hotel_admin_users` (bcrypt). `src/lib/hotel-admin/auth.ts` | `/hotel-admin/[slug]/*` |
| Group admin | `/group-admin/[slug]/login` | `group_session` | JWT (jose), same secret. `src/lib/group-admin/auth.ts` | `/group-admin/[slug]/*` |

- Middleware also does **per-role path gating** for hotel admins via `PATH_ROLE_MAP` (e.g. `front-office` segment → only `hotel_owner` + `front_office_manager`). Add a new protected hotel-admin section → update that map.
- `getManagerOrHotelAdmin()` (dual-auth) lets routes accept either the manager session or a hotel-admin JWT.
- App Router groups: `src/app/admin/(protected)/*`, `src/app/hotel-admin/[slug]/*`, `src/app/group-admin/[slug]/*`, `src/app/manager/*`, plus the public landing (`src/components/landing/*`). API under `src/app/api/{admin,hotel-admin,manager,group-admin,webhooks,cron,auth,health-check}/`.

## 3. KALICI KARARLAR (IHLAL EDILEMEZ)
- **#3 DETERMINISTIK KAPI:** Sayisal/esik/yonlendirme kararlari KODDA.
  LLM'e uygun: dil tespiti, intent etiketi. LLM'e YASAK: forward karari,
  esikler, esya/adet, alerjen karari, onay, **update-kimlik-cikarimi
  (`extractUpdateId`)**, **isim/kimlik eslesmesi (`match-guest-name.ts` — 4 export;
  MISAFIR KIMLIGI hicbir kosulda LLM'e sorulmaz)**.
- **SESSIZ YUTMA YASAGI:** Bir talep herhangi bir kapida dusuruluyorsa
  (dedup/gate/filtre) personel veya misafir MUTLAKA haberdar edilir.
  Sessiz continue/return = kayip. **Bir SIKAYET'i bilgi cevabiyla kapatmak da
  sessiz yutmadir** — aksaklik bildiren misafire KB metni donup kimseye
  iletmemek yasak (IS 8 sikayet dali bunun icin var).
  **DOGRULAMA BASARISIZLIGI DA BIR KAPIDIR (23. otu):** max-denemede state'i
  temizleyip misafire "on buroya basvurun" DEMEK, personeli haberdar etmek
  DEGILDIR — misafirin yuruyecegi varsayilamaz, kayit DB'de oksuz kalir.
  Deneme sayaci biten her akis, kapanmadan ONCE ilgili gruba dusmek zorunda
  (alerjen kapisi `0bac2ad` ile boyle kapandi). **24. otu chat_id refactoru bu
  korumalarin ICINE DOKUNMADI** — altisinin da null-guard'i (`warn` + skip / return)
  ve dallanmasi AYNEN korundu; degisen yalniz lookup'in NEREDE yasadigi.
  **FAIL-SAFE YONU (18. otu):** bir dedup kapisi KARAR VEREMIYORSA mesaji
  ISLER, atmaz. Kimlik okunamaz -> `[update-dedup] no update_id, dedup atlandi`;
  DB hatasi -> `[update-dedup] claim-error, devam`. Ikisi de akisi SURDURUR
  (fazladan islem, kayip talepten iyidir) ve iz birakir.
- **SAHTE VAAT YASAGI:** Forward'i kesen bir kapi, metni ureten LLM'i de
  susturmak ZORUNDA. Bilgi-sorusu dalinda TALEP beyninin metni KULLANILAMAZ —
  "talebiniz alindi, getirecegiz" deyip kimseye iletmemek yalan vaattir.
  Kapi eklerken sor: bu dalda cevabi KIM yaziyor?
- **OTOMATIK ONAY YASAGI:** SLA zincirini otomatik "cevaplanmis" saymak YASAK.
  responded_at'i sistem dolduramaz. Ihmal gorunur kalmali.
- **ESIK-ARAYUZ BIRLIKTELIGI:** Bir esigi degistirirken misafirin o esige
  ULASABILDIGINI dogrula. Buton araligi esigin altindaysa esik olu koddur.
- **PROMPT CAKISMA KONTROLU:** Kod esigi degistiginde prompt'ta ayni konuyu
  anlatan satir var mi TARA. Celisiyorsa duzelt.
- **GECMIS TARANMAZ:** Housekeeping esya kararlari SADECE guncel mesajdan.
- **hkItems dalinda LLM cevabi KULLANILMAZ** (replyText:''). Ayni kural
  hkComplaint dali icin de gecerli.
- **KIMLIK/LINK TASIMA:** Bir Telegram damgasini/oturumu otomatik tasiyan her
  islemde varsayilan **TASIMA YOK**; yalniz TEK-ANLAMLI ayni-kisi kanitinda
  tasi. Yanlis tasima = misafirin baskasinin odasini gormesi.
- **DEPLOY AYRI VE ACIK ONAYLIDIR:** talimatta **acikca `vercel --prod` YAZMIYORSA
  DEPLOY ETME.** Is bitince commit + rapor'da DUR; onayi bekle. "Kapat", "sevk et",
  "bitir" gibi ifadeler deploy izni SAYILMAZ. Commit ve push da ayni disiplinle
  yalniz istendiginde yapilir. **Saf/davranis-koruyucu bir refactor SEVK EDILIP
  DEPLOY EDILMEDEN birakilabilir** (24. otu `df38583` boyle); o zaman branch HEAD
  prod'un ONUNDEDIR — bir sonraki deploy ikisini BIRLIKTE tasir, bunu bilerek sevk et.
- **MISAFIRE DONUK SABIT METIN TEK KAYNAKTA:** yeni bir misafir metni (mesaj, buton
  etiketi, kart etiketi, callback toast'i) `src/lib/i18n/guest-text.ts`'e 5 dille
  eklenir; dosya icine inline literal YAZILMAZ. Ikinci kopya = biri degisince
  digerinin sessizce kaymasi. Dil `resolvePreferredLang` ile cozulur.
- **TEKRARLANAN KARAR/CEVAP TEK KAYNAKTA:** ayni karar ya da ayni misafir cevabi
  ikinci bir yerde YENIDEN YAZILMAZ — ortak bir SAF fonksiyona/yardimciya cekilir.
  Iki kopya = biri degisince digerinin SESSIZCE kaymasi. Bugunku TEK-KAYNAK kayitlari:
  - **dedup benzerligi** -> `src/lib/sla/duplicate-guard.ts` `isDuplicateRequest`
    (housekeeping-forward + handle-order-callback AYNI fonksiyonu cagirir; inline
    Jaccard kopyasi 16. oturumda KALDIRILDI)
  - **"siparis YAPILI mi" karari** -> `src/lib/menu/pending-order.ts`
    `isStructuredOrder` (M2 kapisi; cagri yerinde `structured != null` YAZILMAZ)
  - **update kimligi + "bu update islendi mi"** -> `src/lib/telegram/update-dedup.ts`
    `extractUpdateId` (SAF) + `claimTelegramUpdate` (IO). Kimlik cikarimi route'a
    inline YAZILMAZ; ikinci bir webhook girisine gate gerekirse AYNI ikili cagrilir.
  - **"bu siparis zaten islendi" cevabi** -> `handle-order-callback.ts`
    `replyAlreadyProcessed` (bayrak-kapali dali + M1 claim RED'i ayni yardimci)
  - **misafire donuk sabit metin** -> `guest-text.ts` (ustteki madde)
  - **"bilgi yok" cevabi** -> `fallback-texts.ts` `NO_INFO_FALLBACK_TR`
  - **soru/sikayet dedektoru** -> `department-brains.ts` `isInfoQuestion` (capraz-departman TEK)
  - **non-latin etkinlik kokleri** -> `hasEventKeyword` (`event-contact-gate.ts`)
  - **oda-prefix (oda/room/zimmer/номер/AR/no/numara/number)** ->
    `verify-guest.ts` **`ROOM_PREFIXES`** (20. otu). `ROOM_REGEX`in prefix
    alternasyonu, `ROOM_PREFIX_STRIP_RE` ve `STOP_WORDS` UCU DE bu diziden
    URETILIR; dorduncu bir kopya YAZILMAZ. Yeni prefix eklemek DAVRANIS
    degisikligidir (bkz. §7 acik borc), doc-only senkron degil.
  - **isim-eslesme (ad/soyad ayni kisi mi?)** -> `verify-guest.ts` DEGIL,
    **`match-guest-name.ts`** — **4 export, 7 cagri yeri, TAMAMI BAGLI** (21-23. otu):
    `matchesGuestName` (parse edilmis ad/soyad — site 1/2/3/7) ·
    `matchesGuestNameFromText` (ham metin) · `sameGuestByText` (iki tam isim — site 5) ·
    `sameLastName` (iki soyad — site 6a/6b). **Inline `includes` / `toLowerCase` /
    `toLocaleLowerCase('tr')` karsilastirmasi YAZILMAZ**; ihtiyac duyulan varyant
    yoksa modul'e **BESINCI export** eklenir, cagri yerine kopya YAZILMAZ.
    **Tek-anlamlilik (0/1/>1 aday) modulde DEGIL, CAGIRANDA:** damga yalnizca TEK
    eslesmede atilir (`length === 1`), `find()` ilk-alma YASAK.
  - **on buro (`front_office`) grup chat_id'si** -> `src/lib/telegram/front-office.ts`
    **`getFrontOfficeChatId(supa): Promise<string | null>`** (24. otu, `df38583`).
    Inline `departments` + `.eq('code','front_office')` sorgusu YAZILMAZ. **HAM string**
    doner (`raw ? String(raw) : null` — eski `if (!chatId)` falsy-guard'i ile BIREBIR);
    **coerce CAGRI YERINDE** kalir (`Number(...)` kimi sitede var, kimisinde ham deger
    gider — helper'a coerce KOYMA). **6 canli site + olu `:865` BAGLI.**
    **25. otu (`1da42a9`): kalan 3 cok-kolonlu site de baglandi (backlog #20 KAPANDI)
    -> 9/9 lookup TEK KAYNAKTA**; repoda kalan tek `eq('code','front_office')`
    helper'in KENDI icindedir.
  - **on buro satiri COK KOLONLU okunacaksa** -> `front-office.ts`
    **`getFrontOfficeRow(supa, columns, opts?)`** (25. otu, `1da42a9`). Inline
    `departments` sorgusu YAZILMAZ. `enabledOnly` varsayilani **`false`** —
    `handle-callback`in `is_enabled` filtresi O SITEYE OZGUDUR, genellestirme.
  - **non-latin TAM KELIME eslesmesi** -> `src/lib/utils/nonlatin-word.ts`
    `matchesNonLatinWord` / `matchesAnyNonLatinWord` (25. otu). Unicode
    lookaround (`(?<!\p{L})X(?!\p{L})`, `u`). Substring listelerinin YERINI ALMAZ;
    yalniz yanlis-pozitif yuzunden disarida kalmis uyeler icindir. **Kendi
    lookaround'unu yazma**, bu ikiliyi cagir.
  - **log'a giden misafir adi** -> `src/lib/utils/mask-pii.ts` `maskName`
    (25. otu). Ham ad `console.*`a YAZILMAZ. Oda no maskelenmez.
  - **PostgREST `.or()` filtresine giden kullanici girdisi** ->
    `src/lib/utils/postgrest-filter.ts` `sanitizeOrFilterValue`
  - **alerjen ceviri satiri gerekli mi** -> `allergen-notify.ts`
    `needsTurkishLine` (SAF) / `resolveAllergenTurkish` (IO) — mutfak/GR karti da
    on buro karti da AYNI karari cagirir, bicimi kendi yazar
  - **UNIQUE ihlali (SQLSTATE 23505) karari** -> `src/lib/utils/pg-error.ts`
    `isUniqueViolation` (26. otu). Cagri yerinde `err.code === '23505'` YAZILMAZ;
    `error.message` metnine BAKILMAZ (surum/lokalizasyon ile degisir, kod degismez).
  - **`sla_events` INSERT'i + 23505 backstop'u** -> `src/lib/sla/insert-sla-event.ts`
    `insertSlaEvent` (26. otu, `9dcf48a`). Inline `.from('sla_events').insert(...)`
    YAZILMAZ — **4/4 site bagli** (F&B onay · HK forward · genel forward ·
    `[reverify-forward]`). Duplicate bildirimi `notifyOpenDuplicate` **FACTORY**'si
    ile verilir (cagri aninda is YAPMAZ); `notifyDuplicateRequest` cagrisi cagri
    yerine KOPYALANMAZ. "Dup olunca ne yapilacagi" (misafire ne denecek, `continue`
    mi return mi) CAGIRANA aittir — helper onu genellestirmez.
  - **TR normalize** -> `normalize-tr.ts` `normalizeTr` (ikinci normalizer YASAK)
- **27. OTURUM DB-KATMAN KARARLARI (IHLAL EDILEMEZ):**
  - **(a) IZOLASYON PER-DB'DIR, `hotel_id` FILTRESI DEGIL.** Her otel AYRI Supabase
    projesi; tenant tablolarinda `hotel_id`/`tenant_id` kolonu YOK. Guvenlik "dogru
    DB'ye baglan"maya dayanir -> kod yanlis tenant client'i secerse hicbir sahiplik
    kolonu yakalamaz. Bu yuzden `[slug]` kapisi (§25-otu) + DB-katman (RLS) BIRLIKTE
    gerekli.
  - **(b) `REVOKE ... FROM PUBLIC` TEK BASINA YETMEZ.** Supabase public-semada
    anon+authenticated'e **AYRI** default-privilege grant'i koyar; revoke daima
    `FROM PUBLIC, anon, authenticated` olmali. Ayrica `ALTER DEFAULT PRIVILEGES ...
    REVOKE` ile GELECEK grant'lar da kesilmeli. (Canli delik tam buydu — bootstrap
    yalniz PUBLIC'i revoke ediyordu, anon ACIK kaliyordu.)
  - **(c) SIRA: fonksiyon/grant REVOKE ONCE -> RLS SONRA.** `exec_sql`
    (SECURITY DEFINER, postgres) anon'a acik kaldigi surece anon o fonksiyon
    uzerinden RLS'i BYPASS eder (postgres `rolbypassrls`). Once anon/auth'tan
    EXECUTE cekilir, SONRA RLS anlam kazanir. Tersi sirada RLS olu koddur.
  - **(d) RLS ENABLE'DAN ONCE OWNER-ASSERT (fail-loud).** `ALTER TABLE ... ENABLE
    RLS` yalniz tablo sahibince yapilir; non-postgres sahipli bir public tablo varsa
    DO bloğu patlar. Uygulamadan once `count(*) WHERE tableowner <> 'postgres'`
    kosulur, >0 ise DUR. (central-011 per-tablo `EXCEPTION WHEN OTHERS -> RAISE
    NOTICE skip` ile ayni korumayi migration ICINDE tasir.)
  - **(e) service_role DOKUNULMAZ + GRANT GERI VERILIR.** REVOKE'lar app'i (yalniz
    service_role kullanir) BOZMAMALI: her REVOKE blogunun yaninda `GRANT ... TO
    service_role` olmali. Dogrulama: `has_*_privilege('service_role', ...)=true`.
  - **(f) DB-KATMAN DEPLOY DEGILDIR.** Grant/RLS canli DB'de yasar, Vercel bundle'ini
    degistirmez. Migration KAYDI commit'lenir ama `vercel --prod` GEREKMEZ; HEAD > PROD
    olmasi bu yuzden KASITLIDIR, bir sevk borcu DEGIL. `schema_migrations`a dusmez
    (dogrudan exec_sql / SQL Editor).
- **26. OTURUM VERI-BUTUNLUGU KARARLARI (IHLAL EDILEMEZ):**
  - **(a) DB UNIQUE, BULANIK dedup'i TAKLIT EDEMEZ.** Constraint tam esitliktir;
    app dedup'i Jaccard 0.5'tir. Bir constraint ancak dedup'in **DAR ALT KUMESI**
    olabilir — "app dedup'ini DB'ye tasiyalim" diye baslama.
  - **(b) ZAMAN PENCERESI INDEX'TE IFADE EDILEMEZ.** `created_at >= now() - 3 dk`
    bir UNIQUE index'e yazilamaz. Pencerenin index karsiligi **"kayit hala ACIK
    mi"**dir (`responded_at IS NULL AND closed_at IS NULL`); personel karta
    bastiginda satir index'ten DUSER ve sonraki ayni talep serbestce yazilir.
  - **(c) NAIVE "temizle + dogal-anahtar UNIQUE" REDDEDILDI.** Mevcut fazla
    satirlarin ~%60'i mesru tekrardir (1 saat - 9 gun) -> silmek **imha**;
    kosulsuz UNIQUE ise mesru ikinci talebi **sessiz 23505 kaybina** cevirir.
  - **(d) UNIQUE'DEN ONCE CANLI ACIK-DUP OLC — FAIL-LOUD birak.** Uygulamadan
    hemen once acik alt kumede `GROUP BY ... HAVING count(*)>1` kosulur; **BOS
    donmeli**. Satir donerse DUR ve cakismayi incele. Migration `IF NOT EXISTS`
    tasir ama cakismada PG **PATLAR** — bu ISTENEN davranistir (sessizce yarim
    uygulanmasindansa dusmeli).
  - **(e) SIRA: ONCE kod (olu dal) deploy -> SONRA constraint.** 23505'i YAKALAYAN
    kod prod'da OLMADAN index uygulanirsa sessiz kayip penceresi acilir. Ters
    sirada kod, constraint yokken zaten olu kod olarak kosar (zararsiz).
  - **(f) 23505 SESSIZ YUTULMAZ** -> `notifyDuplicateRequest` ile cakisan ACIK
    kartin altina reply duser (§3 SESSIZ YUTMA YASAGI'nin DB tarafi).
  - **(g) `sla_events` INSERT'i TEK KAYNAKTAN** (ustteki tek-kaynak maddesi).
  - **(h) `room_service_orders`'a GUVENLI bir statik constraint YOKTUR.** Dogal
    anahtar (conversation_id, items) mesru tekrar siparisi bloklar; `status` ayirt
    etmez (canlida 33/33 satir `'confirmed'`, iptal DB'ye HIC yazilmaz). Bu yuzden
    constraint yerine **2 defekt** duzeltildi (oksuz-satir rollback + hata markeri).
- **25. OTURUM GUVENLIK KARARLARI (IHLAL EDILEMEZ):**
  - **URL'DEKI `slug` SALDIRGAN GIRDISIDIR.** `[slug]` tasiyan HER admin/API
    route'u, is yapmadan ONCE `slug !== admin.hotel_slug -> 403` kontrolunu
    yapmak ZORUNDA. `resolveTenantBySlug` **service_role** client doner ve RLS'i
    BYPASS eder; `middleware.ts` bu yolu KORUMAZ (matcher `/hotel-admin/:slug/:path*`,
    `/api/...` DISARIDA). Bu kontrol atlanirsa izolasyonun TEK katmani duser
    (canli ornek: SLA route'u, `8cf4e95`).
  - **SLUG KAPISI "HANGI OTEL"i coz er, "HANGI ROL"u COZMEZ.** Ikisi AYRI kapidir;
    yazma yapan route ROL kapisini de tasimak zorunda (`1da42a9`).
  - **TENANT SECIMINI LLM YAPMAZ.** Hangi otelin DB'sine gidilecegi, hangi
    departmana forward edilecegi ve yetki kararlari KODDA — bu, §3 #3'un
    (deterministik kapi) guvenlik tarafidir.
  - **RATE LIMIT / DEDUP KAPILARI FAIL-OPEN.** Sayac ya da dedup KARAR VEREMIYORSA
    istek GECER. Hatada bloklamak bir DB kesintisinde tum misafirleri susturur.
  - **HATA DETAYI ISTEMCIYE DONMEZ.** Istemciye sabit/generic metin; `error.message`,
    `err.stack`, `JSON.stringify(error)` yalniz **server-side log**. Bir hata dali
    eklerken sor: bu metni KIM okuyacak?
  - **SIZAN SECRET ROTE EDILIR, "gecmiste kaldi" DENMEZ.** Git gecmisindeki bir
    `service_role` bugun de gecerlidir. Rotasyon sirasi §2'de (yeni uret -> env +
    tenant.env -> deploy -> test -> ANCAK O ZAMAN legacy disable).
  - **UNIQUE CONSTRAINT'TEN ONCE CANLI DUPLICATE OLC.** Semaya benzersizlik
    eklemek geriye donuk bir iddiadir; mevcut veri onu tutmuyorsa migration
    PATLAR, tutuyorsa da ileride mesru bir tekrar **sessiz 23505 kaybina** doner.
    Once say, sonra karar ver (25. otu: `sla_events` 62 / `room_service_orders`
    20 fazla satir -> **dogal anahtarda** constraint EKLENMEDI).
    **26. otu COZUMU:** anahtar daraltildi — **ACIK KAYIT** alt kumesinde dup
    **0** oldugu icin partial unique (`031`) SIFIR temizlikle kuruldu; naive
    dogal-anahtar UNIQUE ise REDDEDILDI. Ayrinti ve gerekce: asagidaki
    *26. OTURUM VERI-BUTUNLUGU KARARLARI* (a-h).
- **RAPOR BOTU:** @hotel_yonetici_rapor_bot (id 8504961295) — ASLA DOKUNMA.

## 4. TUZAKLAR (defalarca saat kaybettirdi)
- **`.or()` PARAMETRE BAGLAMAZ — string INTERPOLE ETME (25. otu):** PostgREST'te
  `.or()` bir **FILTRE IFADESIDIR**: `or=(room_number.ilike.%x%,last_name.ilike.%x%)`.
  Kullanici girdisini icine dogrudan yazarsan `,` `(` `)` `.` karakterleri AYIRAC
  olarak parse edilir ve cagiran **hangi satirlarin donecegini** yonlendirebilir.
  SQL injection DEGIL (degerleri PostgREST baglar) ama sonuc kumesini kaydirir.
  `sanitizeOrFilterValue` KULLAN. Normal arama girdisinde bu karakterler
  bulunmadigi icin pratikte no-op'tur — yani "calisiyor" gorunmesi kanit DEGIL.
- **HATAYI ISTEMCIYE SERIALIZE ETME (25. otu):** `{ error: err.message }`,
  `detail: String(err)`, `err.stack`, `JSON.stringify(error)` -> istemciye tablo/
  kolon adlarini, sorgu yapisini ve ic yollari sizdirir. **DIKKAT — iki asamali
  desen ilk bakista GORUNMEZ:** `const msg = err instanceof Error ? err.message :
  '...'` sonra `{ error: msg }`. Tek satirlik grep bunu KACIRIR (25. oturumda
  64 dogrudan sitenin yaninda **61 dolayli** site boyle bulundu). Sizinti ararken
  hem donusu hem ONCEKI atamayi tara.
- **HAM PII LOGLAMA (25. otu):** misafir ad/soyadi `console.*`a yazilmaz — Vercel
  log'lari saklanan, paylasilan ve disari aktarilabilen bir yuzeydir. `maskName`
  kullan. Oda no teshis icin kalir. Alerji metni zaten `cf961d0` ile maskeliydi
  (yalniz `len=`). **Personel `full_name`'leri HALA HAM loglaniyor** (bkz. §7).
- **`[slug]` ROUTE'UNDA SLUG KONTROLUNU ATLAMA (25. otu):** URL'deki slug saldirgan
  girdisidir ve `resolveTenantBySlug` **service_role** client doner (RLS BYPASS).
  `middleware.ts` `/api/...`i KAPSAMAZ. Yeni bir `[slug]` route'u acarken ilk is
  `slug !== admin.hotel_slug -> 403`. Canli ornek: SLA route'u bu kontrolu tasimadigi
  icin **cross-tenant YAZMAYA ACIKTI** (`8cf4e95`). Rol kapisi AYRI bir kontroldur.
- **Migration klasoru:** migrations/tenant/ — `supabase/migrations` YOKTUR.
  Kod var + migration yok = sessiz no-op. information_schema ile teyit sart.
- **Supabase:** .maybeSingle() yerine .order('created_at').limit(1).maybeSingle()
  — PGRST116 onler.
- **hotel_facts'te `fact_key` UNIQUE DEGIL** (canli information_schema: yalniz
  PRIMARY KEY(id)). "UNIQUE oldugu icin cakisma olmaz" varsayimi YANLIS —
  guardsiz INSERT duplicate fact uretir. Once SELECT, sonra
  `INSERT ... WHERE NOT EXISTS`. Ayrica `fact_label` **NOT NULL** (kolay atlanir).
- **Kart "Oda bilinmiyor":** cozum SADECE `inhouse_guests_v2.telegram_id` +
  `status='active'` uzerinden. `verified_inhouse_guest_id`'yi duzeltmek karti
  DUZELTMEZ. Re-import eski satiri arsivleyip damgayi orada birakabilir
  (bkz. *Misafir-oda eslesmesi*).
- **Testte kopya fonksiyon KULLANMA:** scratchpad'e kopyalanan bir fonksiyonu
  test etmek yanlis guven verir — kopya 49/49 YESIL donerken canli davranisla
  CELISEBILIR (bir kez yasandi). Test gercek modulu import etmeli.
- **YESIL TEST TEK BASINA KANIT DEGIL — HARNESS-BITE OLC (23. otu):** yeni vakalar
  eklendikten sonra **bir vakanin beklentisini gecici olarak TERS cevir** ve korpusun
  gercekten KIRMIZI dondugunu gor (sayi dusmeli + `DUSEN: <dosya>` + exit 1), sonra
  AYNEN geri al ve yesili teyit et. Yanlis import / yanlis dosya adi / yanlisikla
  yorumlanmis blok yuzunden hic kosmayan bir korpus da "YESIL" doner. Geri alma
  BYTE-TAM olmali: `git diff --stat` fix oncesiyle AYNI kalmali.
- **BACKLOG ENVANTERI != KOD GERCEGI — ISE BASLARKEN CANLI TARA (24. otu):** §7 bu
  dosyada `front_office` chat_id borcunu "**6 kopya**" diye tasiyordu; tek satirlik
  tarama (`Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String
  "eq\('code', 'front_office'\)"`) **9** lookup buldu — ikisi envanterde HIC YOKTU,
  ucu de farkli `select` tasidigi icin helper'a BAGLANAMAZDI. Doc'taki sayiya
  guvenip 6 siteyi cevirseydin "borc kapandi" denirdi ama iki kopya sessizce
  yasardi. ONCE tara, SONRA planla — envanter bir ipucu, kanit DEGIL.
- **DAVRANIS-KORUYUCU IO REFACTORUNUN MUHRU is8 DEGIL (24. otu):** cikarilan helper
  salt IO ise (icinde saf karar YOK) korpusa vaka eklemek SAHTE kapsam uretir —
  vaka ya ag ister ya da helper'i taklit eder (kopya-test tuzaginin ikizi). Dogru
  muhur: **`npm run doctor` YESIL — is8 sayisi DEGISMEMELI** + diff'in satir satir
  esdegerlik okumasi (guard yonu · coerce YERI · falsy davranisi). Saf KARAR
  degistiyse kural terse doner: o zaman is8 vakasi SART.
- **CAGRI-YERI GARANTILERINI OKU, SAVUNMA KODU YAZMA (23. otu):** site 7'de
  `avParsed.firstName` icin fallback yazmak GEREKSIZDI — `parseVerificationInput`
  `firstName` ve `lastName`i **birlikte** doldurur (`tokens.length >= 2`), ustelik
  ustteki format kapisi zaten `!avLastName` ile donuyor. Fonksiyonun sozlesmesini
  OKUMADAN "her ihtimale karsi" `?? ''` zinciri eklemek gercek bir kosulu maskeler.
- **`chat_id` tabloda VAR != bot oraya YAZABILIR (23. otu):** `departments.telegram_chat_id`
  dolu olmasi teslimati KANITLAMAZ; gruptan atilmis/susturulmus bot da tabloda id
  birakir. SELECT yalniz "config eksik degil" der; gercek kanit canli log satiri +
  grupta gorunen karttir.
- **`bigint` kolonlar JS'e STRING gelir:** supabase-js `telegram_chat_id`i
  `"-5366737876"` olarak dondurur. Telegram API string kabul etse de tip
  uyusmazligi tsc'de patlar -> `Number(...)` coerce SART (bkz. `allergen-notify.ts:143`).
- **PowerShell:** && desteklemez, komutlar ayri satir.
  Select-String -Path src\**\*.ts subdirectory'e GIRMEZ.
  Dogru: Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String "..."
- **`vercel --prod`'u Select-String / pipe ile SARMA (23. otu):**
  `vercel --prod | Select-String -Pattern "...\"..."` gibi bir filtre, PowerShell'in
  `\"` kacisini parametre baglamasinda dusurup komutu **vercel'i HIC calistirmadan**
  patlatir -> deploy sessizce TETIKLENMEZ (exit != 0 ama deployment YOK).
  `vercel --prod`'u CIPLAK kos; ciktiyi suzmen gerekiyorsa AYRI satirda yap.
  Suphede `vercel ls` ile yeni Production kaydi olup olmadigini teyit et
  (23. otu: ilk deneme boyle dustu, cift-deploy olmadi).
- **`git commit -m @'...'@` HERE-STRING'INE CIFT TIRNAK KOYMA (24. otu):** PowerShell
  tek-tirnakli here-string'i native exe'ye TEK arguman olarak GECIRMEZ; icindeki `"`
  karakterleri arguman siniri gibi islenir ve mesajin her parcasi ayri bir pathspec
  olur -> `error: pathspec 'STOPS' did not match any file(s) known to git` yagmuru ve
  **commit ATILMAZ** (dosyalar staged kalir — sessizce yarim is; `git status` ile
  teyit et, "commit gecti" SAYMA). Ustteki `vercel --prod` tuzaginin KARDESI: ikisinde
  de PowerShell'in native-exe arguman baglamasi tirnagi yutuyor. **COZUM: cok satirli
  ya da tirnakli commit mesajini scratchpad'e `.txt` yaz, `git commit -F <dosya>` ile
  ver** (bu dosya `04aa216`'da boyle commit'lendi). Tirnaksiz tek satirda `-m` sorunsuz.
- **Commit mesaji ASCII only.** Turkce karakter YASAK.
- **SIR SOHBETE / GIT'E / LOG'A GIRMEZ (25. otu, genisletildi):** `service_role` ve
  `anon` anahtarlari, **`sb_secret_*` degerleri**, **GitHub PAT'i**,
  `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `ENCRYPTION_MASTER_KEY`. Rapor ederken
  **ADINI yaz, DEGERINI YAZMA**. Pratik kurallar: PAT'i komut satirina/URL'e gomme
  (shell gecmisine ve log'a duser) — git sorunca prompt'a gir; `tenant.env` gibi
  dosyalari incelerken `=` oncesini kesen bir komut kullan
  (`sed -n 's/^\([A-Za-z0-9_]*\)=.*/\1/p'`), `cat` ATMA; JWT'nin `role` claim'ini
  merak ediyorsan yalniz o alani decode edip bas, token'in kendisini ASLA.
- **Misafire donuk metinler TAM Turkce karakterli.**
- **JS `\b` ASCII-ONLY:** `\w` Kiril/Arap harfini SAYMAZ -> `\bчеловек` / `\bحفل`
  kaliplari HICBIR ZAMAN eslesmez ve SESSIZ OLU KOD olur (test yesil, canli bos).
  Non-latin keyword taramasi `includes` (substring) ile yapilir; `normalizeTr`
  non-latin'i SILMEZ, o yuzden normalize edilmis metinde calisir.
- **Okuma-sonra-yazma bayragi ES ZAMANLILIGI KESMEZ:** `SELECT ... if (flag) ...
  UPDATE` deseni iki paralel invocation'in ikisini de gecirir (Vercel'de her
  callback ayri instance). Cift kayit istemiyorsan kosulu UPDATE'in ICINE koy
  (`.eq('flag', true).select('id')` -> donen dizi bos = kaybettin). Bkz. IS 2 M1.
- **Serbest-metin siparis UAT'i: urun MENUDE OLMALI.** Menude olmayan urunle
  ("kahve") test edersen `isOrderInMenu`=false doner, akis `menu:show` kademeli
  oneri dalina sapar ve onay karti HIC cikmaz -> `order:confirm` callback'ine
  ULASILAMAZ, dedup/kapi davranisi olculemez. Menudeki urunu KODSUZ iste
  (bkz. §2 *M2 KAPISI*).
- **callback_data 64 byte siniri.** Asarsan state DB'ye.
- **Telegram `update_id` ARTIK OKUNUYOR (18. otu).** Eski kayit ("tanimli ama hicbir
  yerde kullanilmiyor -> webhook seviyesinde retry dedup'i YOK") **GECERSIZ**:
  `src/lib/telegram/update-dedup.ts` + route.ts :341 gate. Akis-basina korumalar
  (order: M1 claim; hk/note: damga) YERINDE DURUYOR — gate onlarin YERINI ALMAZ,
  farkli bir yarisi kapatir (retry vs cift-tik).
- **Bot kimligi:** setWebhook ONCESI getMe ile token dogrula.
- **Vercel:** "Deploy Ready" yetmez. vercel --prod + Production teyidi.
  vercel logs CLI ECONNRESET verir — log web panelinden okunur.
  `vercel inspect` PowerShell'de **exit 255** donebilir (stderr'e yazilan plugin
  satiri yuzunden) — CIKTI dogruysa deploy saglamdir, exit koduna guvenme.
- **Scratchpad scriptleri repo root'a YAZILMAZ.** Ayri dizin kullan. IO'lu bir modulu
  canli DB'ye karsi denemek gerekiyorsa (`@/` import'u scratchpad'de patlar) gecici
  probe `scripts/__tmp-*.ts` olarak acilir, KOSULUR ve **hemen SILINIR** — commit
  gate'inde gorunmemelidir (`__*` zaten .gitignore'da).
- **`tsql.js` DDL de calistirir** (`exec_sql` RPC uzerinden) — migration'i canli
  tenant'a uygulamak icin Supabase SQL Editor sart DEGIL. AMA `exec_sql_json`
  sorguyu alt-sorguya sardigi icin **veri-degistiren CTE** (`WITH ins AS (INSERT
  ... RETURNING)`) calismaz: "data-modifying statement must be at top level".
  Cozum: DML'i ayri calistir, sonucu ayri `SELECT count(*)` ile dogrula.

### Korunmus: Conventions & gotchas (orijinal — ustteki maddelerle celismez, tamamlar)
- **Turkish normalization:** use the shared `normalizeTr()` (`src/lib/utils/normalize-tr.ts`) for any keyword/name matching — verification and interest-tag detection both depend on it. Don't roll a second normalizer (some older code inlines `.replace(/İ/g,'i')…` chains; prefer the shared util).
- **Timezone:** all "now"/off-hours/SLA logic is **Europe/Istanbul** (`src/lib/date/turkeyTime.ts`, e.g. `getTurkeyToday`). Never use raw local server time for business hours.
- **Guest table is `inhouse_guests_v2`** (TEXT `room_number`, single `guest_name`, `status='active'`, `check_out_date`). Legacy `inhouse_guests` exists only as a fallback in `verify-guest.ts`. New code should target v2.
- **Allergen module (M4):** `ALERJEN_MODUL4_KURALLAR.md` is the **authoritative spec** — follow it exactly. Key invariants: the bot never gives medical/safety approval; "no response" is never recorded as "no allergy"; in-house allergy reports notify kitchen+GR flagged staff (`department_staff` flags `is_allergen_primary/backup/is_manager`) **always**, reception only off-hours (00:00–08:00 TR). Per recent commits, allergy notifications are **button-free and create no `sla_events`** — don't add SLA tracking to the allergy path. Notifications via `src/lib/telegram/allergen-notify.ts` (personel **DM**'i: `department_staff.telegram_user_id`; departman GRUBUNA yazmaz). 23. otu: dogrulama 3 denemede BASARISIZ olursa ayri bir **on buro GRUP karti** duser (`route.ts` alerjen kapisi) — o da butonsuz + `sla_events`siz, ayni invaryanti korur.
- **Webhooks must return 200** and degrade gracefully; services return `{ success, error }` / log-and-continue rather than throwing across the message path.
- **Markdown is stripped** from guest replies (Telegram) and the AI is instructed to emit plain text only.
- Generated Supabase types: `src/types/database-central.ts`, `src/types/database-hotel.ts`.

## 5. DEGISIKLIK DONGUSU (her fix icin)
1. Ilgili dosyalari OKU
2. Cerrahi degisiklik
3. `npm run type-check` + (kapi/karar mantigina dokunduysan) `npm run test:is8`
4. `git diff --stat` ciktisini raporla
5. Commit ATMA — Claude/Kemal soyleyecek
6. Rapor: ne degisti, hangi satir, ne dogrulanmadi

## 6. RAPORLAMA FORMATI
Her is sonunda:
- DEGISEN DOSYALAR: dosya + satir araligi
- YAPILMAYAN: talimatta olup yapamadiklarin + nedeni
- FARK EDILEN RISK: dokunmadigin ama bozuk gordugun seyler
- DOGRULANMAYAN: canli kanit gerektiren kisimlar
Asla "tamamlandi, calisiyor" yazma. Neyin dogrulanmadigini yaz.

## 7. BILINEN TEKNIK BORC (talimat gelmeden DOKUNMA — sadece bilincinde ol)

**13. oturumda KAPANDI** (yeniden acmayin): P7b RU/AR misafir metinleri · Tier-2
callback/toast dili · IS 10 kalici dil · `handle-order/note-callback` iki
`lang='tr'` HARDCODE'u · B4 alerjen-cevap dili · hk `language` yanlis-slot (madde-5).

**15. oturumda KAPANDI:** yalin sayinin oda sayilmasi (`6c30f6f`) · oda-no
disqualifier'in RU/AR kapsami (`3d9e593`) — bkz. §2 *Oda-no parse disqualifier*.

**16. oturumda KAPANDI:** **RS-siparis DEDUP yoktu** — ayni siparis kisa sure
icinde iki kez kayit/kart uretebiliyordu; artik M1 atomik claim (es zamanli
callback) + M2 dedup (ayri akis tekrari) var. Ayrica housekeeping'in inline
Jaccard kopyasi ortak `duplicate-guard.ts`e tasindi (`73d92ae`).

**17. oturumda KAPANDI:** **M2 dedup'in serbest-metin YANLIS-POZITIFI** (`d5b9408`) —
"bir kahve daha istiyorum" vs "kahve istiyorum" Jaccard TAM 0.5 oldugu icin GERCEK
ikinci siparis iletilmiyordu; M2 artik yalniz yapili (kod-bazli) sipariste kosar
(`isStructuredOrder` kapisi). Kod okumasiyla ayrica TEYIT EDILDI ki bu yol
**erisilebilir** bir bug'di (freeform onay karti canli — bkz. §2 *M2 KAPISI*), savunma
guard'i degil. (DIKKAT: 15. oturumun "backlog #1"i AYRI bir istir — oda-no parse.)

**18. oturumda KAPANDI:** **webhook-girisi `update_id` dedup'i YOKTU (backlog #3)**
(`df3f6b5`) — Telegram'in tekrar teslimi yalniz `order:` akisinda (M1) kesiliyordu;
`note:`/`hk:`/duz-mesaj yolunda koruma yoktu. Artik `extractUpdateId` (SAF) +
`claimTelegramUpdate` (PK catismasi) + `migrations/tenant/029` var; is8 1775/1775.
**UCLU MUHUR:** (1) canli probe — gercek `claimTelegramUpdate` ilk cagri `true`,
ikinci `false`, farkli slug `true`; (2) SQL — ikinci INSERT satir eklemedi, `seen_at`
degismedi; (3) PROD — `[update-dedup] first-seen` satiri canlida gorundu.
Ayrinti: §2 *Webhook-girisi update_id dedup*.

**19. oturumda KAPANDI (SEMPTOM):** **AR oda-prefixi TALEP metnine siziyordu**
(`48ea1ea`) — `ROOM_PREFIX_STRIP_RE`, `ROOM_REGEX` prefix alternasyonunun IKIZIYDI ama
AR prefixi EKSIKTI; oda DOGRU okunuyor, prefix kelimesi personel kartindaki talep
metnine dusuyordu. Strip listesine AR eklendi (`is8-verify-parse` §8, 6 vaka;
1775 -> 1781). **KOK (uc kopya) ACIK KALDI** -> 20. otu. Bu sevk CLAUDE.md'yi
GUNCELLEMEDI (bkz. §0 *DOKUMAN GECIKMESI*).

**20. oturumda KAPANDI (KOK):** **backlog #5 KOK — oda-prefixin UC KOPYASI**
(`f5a56a7` + `92edccb`; deploy `dpl_FCKu2qhQww4bazAhHoFLxBMBzcDH`). Ayni 8 prefix
`ROOM_REGEX` alternasyonu + `ROOM_PREFIX_STRIP_RE` + `STOP_WORDS` olmak uzere UC yerde
elle yaziliydi; hepsi artik TEK `ROOM_PREFIXES` dizisinden URETILIR, `AR_ROOM_PREFIX`
ayri sabiti kalkti ve dosyanin son ham AR oda-prefix literali gitti. **UCLU KANIT:**
(1) iki regex `.source` byte-esdegerligi (is8 §9), (2) STOP_WORDS codePoint dump
**SHA256 AYNI, 110 -> 110, 0 fark**, (3) NEGATIF KONTROL — `zimmer` gecici cikarilinca
`9g[2]` (oda okunamadi) + `9i[2]` (prefix TALEBE SIZDI) KIRMIZI dondu.
is8 1781 -> 1827. Ayrinti: §2 *Oda-prefix TEK KAYNAK*.
**CANLI BOT UAT'i BEKLIYOR** — refactor davranis-koruyucu, ama kanit su an saf-parse +
kume seviyesinde; gercek Telegram mesajiyla (AR/RU prefixli dogrulama -> kart metni)
olculmedi.

**21. oturumda KAPANDI:** **backlog #13 — isim eslesmesinin UC SUBSTRING KOPYASI**
(`9e46fdf`; deploy `dpl_8bMJpYxVmY4gYn3EgacSWD9FAks7`). Ad/soyad UC AYRI yerde inline
ve SUBSTRING karsilastiriliyordu: "102 Mehmet Ak" mesaji odadaki "Ayse Akin" kaydini
esler, tek aday oldugu icin `length === 1` korumasini da gecer ve `telegram_id`
YANLIS kisiye damgalanirdi. Artik TEK saf modul `match-guest-name.ts` karar verir
(TAM KELIME; orta isimler iki tarafta da yok sayilir) ve 17.7-B'de `find()` yerine
TEK-ANLAMLI eslesme sarti vardir. is8 1827 -> 1872 (YENI dosya, 45 vaka),
`npm run doctor` YESIL (tsc 0 · sema 45/46 · sabit-marka 0 unexpected).
Ayrinti: §2 *Misafir ismi eslesmesi TEK KAYNAK*.
**CANLI BOT UAT'i BEKLIYOR** — kanit saf-karar seviyesinde. Olculecekler:
(i) "102 Mehmet Ak" -> damga ATILMAMALI, (ii) gercek misafir normal baglanmali,
(iii) 17.7-B'de tam isim baglanmali / belirsiz isim 3 denemede on buroya dusmeli.

**22. oturumda KAPANDI:** **backlog #6 — isim-karsilastirma TAM KONSOLIDASYON**
(`e36bf65`; deploy `dpl_2G5Rwuh1q3WZQz7XNuBFkc7XKPQa`). #13'ten kalan IKI site
baglandi: **site 5** `reception-approval.ts` GUARD B (kendi `toLocaleLowerCase('tr')`
normalizer'i + tam-dize esitsizligi -> `!sameGuestByText`) ve **site 6**
`route.ts` re-verify (6a tetik `:3267` -> `!sameLastName`; 6b re-send guard
`:3423-3424` -> `sameLastName` + odada `normalizeTr`, eskiden ham `===` idi).
Modul 2 SAF export kazandi: `sameGuestByText`, `sameLastName`. Ucu de
uyari/tetik/skip uretir — **damga YAZMAZ**, o yuzden risk "gereksiz soru",
"baskasinin odasi" DEGIL. is8 45 -> 71 (§6 11 + §7 8 + §8 oracle 7),
test:is8 1872 -> 1898. Ayrinti: §2 *Misafir ismi eslesmesi TEK KAYNAK*.

**23. oturumda KAPANDI — IKI SEVK:**
- **SEVK A — site 7 `[allergen-verify-gate]`** (`1b529f2`; deploy
  `dpl_AevDr9o2s8CxiHFViqY5S8Ebi6WQ`). Alerjen dogrulama kapisi kendi
  `toLowerCase`'ini kullaniyor, olcut olarak **yalniz SOYADIN son kelimesini**
  aliyor (ad HIC bakilmiyor) ve adaylar arasinda `find()` ile **ilk sirayi**
  seciyordu -> odada "Ayse Akin" ve "Mehmet Akin" varken alerji YANLIS misafire
  yazilabilirdi. Artik `matchesGuestName` + `length === 1` tek-anlamlilik guard'i.
  is8 71 -> **86** (§9: 9a-9g davranis + 9h-9o cift-yonlu `legacyAllergenMatch`
  oracle), test:is8 1898 -> **1913**, **HARNESS-BITE olculdu** (9b ters cevrilince
  1912/1913 + 13/14 dosya KIRMIZI).
- **SEVK B — alerjen SESSIZ YUTMA** (`0bac2ad`; deploy
  `dpl_2rqqDg6C9Uo7HLRX9MZACP8YJ24v` = **SON PROD**). 3 basarisiz denemede state
  temizlenip misafire "on buroya basvurun" deniyor ama personele HICBIR sey
  gitmiyordu; bildirilen alerji DB'de oksuz kaliyor ve akis bir daha
  tetiklenmiyordu. Artik state temizliginden ONCE on buro grubuna TR kart duser
  (+39/-0, fail-safe try/catch). **is8 EKLENMEDI** (blok salt IO). Muhur:
  tsc + doctor + **tsql canli SELECT** (`front_office` chat_id DOLU). Ayrinti:
  §2 *Alerjen dogrulama kapisi — max-denemede ON BURO UYARISI*.
- **DOC SENKRONU:** bu dosya v35'te bayat kalmisti (22+23 sevkleri isaretlenmemis)
  -> bu commit ile v37'ye tasindi.

**24. oturumda KAPANDI:** **backlog #6 — `front_office` chat_id lookup TEK KAYNAK**
(`df38583`; o oturumda deploy EDILMEDI, **25. oturumda `1da42a9` ile BIRLIKTE prod'a
gitti**). Ayni dort satir alti yerde elle
tekrarlaniyordu; artik `getFrontOfficeChatId(supa): Promise<string | null>`
(`src/lib/telegram/front-office.ts`) TEK kaynak — **HAM string** doner, coerce CAGRI
YERINDE kalir, falsy katlamasi eski `if (!chatId)` guard'iyla BIREBIR. 6 canli site +
olu `:865` bagli. **SAYIM DUZELTMESI:** bu dosya borcu "6 kopya" diye tasiyordu, canli
tarama **9** lookup buldu -> ucu farkli `select` tasidigi icin DISARIDA (yeni #20).
Muhur: doctor YESIL, **test:is8 1913 DEGISMEDI** (salt IO — vaka EKLENMEDI),
circular import yok. Ayrinti: §2 *On buro chat_id TEK KAYNAK*. **CANLI UAT YOK.**
**DOC SENKRONU:** bu commit dosyayi v37 -> **v38**'e tasir (kod sevkiyle AYNI oturum).

**25. oturumda KAPANDI — GUVENLIK KAPANISI** (`4114d07` · `8cf4e95` · `cf961d0` ·
`6778749` · `1da42a9`; **HEPSI PROD**):
- **CROSS-TENANT YAZMA (KRITIK, `8cf4e95`)** — `[slug]/departments/[code]/sla`
  URL slug'ini oturumla karsilastirmiyordu; A otelinin admin'i B'nin SLA esigini
  YAZABILIYORDU. 21 `[slug]` route'u tarandi, eksik olan TEK bu idi.
- **SLA route ROL kapisi (`1da42a9`)** — slug kapisi "hangi otel"i cozer, "hangi
  rol"u cozmez: otelin HERHANGI bir departman muduru TUM departmanlarin esigini
  yazabiliyordu. Bu route'un calisan bir cagirani YOK (panel formu `method="PATCH"`
  ile ates edemez), yani kapi hicbir akisi bozmadi.
- **error.message SIZINTISI — 125 site (`1da42a9`)** · **PostgREST filtre
  enjeksiyonu** + **guvenlik header'lari** + **Perplexity 30 sn timeout** +
  **alerjen metni log maskesi** + **prompt guard** (`cf961d0`).
- **xlsx CVE (`1da42a9`)** — `fixAvailable:false` olan tek yuksek risk; SheetJS
  resmi CDN 0.20.3'e tasindi. **next 16.3.0 + ws 8.21.2** (`4114d07`).
- **KALICI RATE LIMIT (`1da42a9`, migration 030)** — denial-of-wallet; in-memory
  sayac Vercel'de cold start'ta sifirlandigi ve otel capinda tavan olmadigi icin
  koruma pratikte yoktu.
- **LOG PII (`1da42a9`)** — misafir ad/soyadi 7 log sitesinde maskelendi.
- **backlog #4** (alerjen TR ceviri) · **#9** (`зал`/`день` kelime siniri) ·
  **#10** (`order:noop` dili) · **#20** (cok-kolon helper) — hepsi KAPANDI.
- **SIZAN `service_role` ROTE EDILDI.** Git gecmisindeki token demo-hotel
  projesinin `service_role`u idi (`scripts/check-table-counts.mjs`, `a2061a0`
  hardcode etti / `9ecf2c9` env'e cevirdi).
- **DOC SENKRONU:** o commit dosyayi v38 -> **v39**'a tasidi (kod sevkiyle AYNI
  oturum, AYRI commit).

**26. oturumda KAPANDI — backlog #3 (UNIQUE constraint) DAR-GUVENLI COZUMLE**
(`9dcf48a`; deploy `dpl_GDKd8CqbR6nUBVi5gAr6TjBnqXP2`; migration **031 CANLI**):
- **NAIVE COZUM REDDEDILDI, gerekcesi §3 (a-h)'de KALICI KARAR olarak yazili.**
  DB UNIQUE = tam esitlik, app dedup = bulanik (Jaccard 0.5 / 3 dk / acik kayit)
  -> taklit edemez. Canli fazla satirlarin **~%60'i mesru tekrar** (1 saat - 9 gun,
  en uzunu 9 gun) -> "temizle sonra kur" **veri imhasi** olurdu.
- **KURULAN:** `031_sla_events_open_unique.sql` — partial unique
  `(conversation_id, department_code, md5(request_text))` WHERE `responded_at IS
  NULL AND closed_at IS NULL`. **ACIK alt kumede dup 0** oldugu icin **SIFIR
  temizlikle** kuruldu (fail-safe gate uygulamadan hemen once TAZE kosuldu -> BOS).
- **KOD (once deploy, olu dal):** `pg-error.ts` `isUniqueViolation` (SAF) +
  `insert-sla-event.ts` `insertSlaEvent` — `sla_events` INSERT'inin **4/4 sitesi**
  tek kaynaga baglandi; 23505 -> cakisan ACIK kartin altina `notifyDuplicateRequest`.
- **`room_service_orders`: constraint YOK (bilincli, §3-h)** -> yerine 2 defekt:
  kart-fail'de **oksuz satir rollback'i** + `[order-confirm] RSO INSERT FAILED`
  markeri.
- **MUHUR:** `npm run doctor` YESIL (tsc 0 · **is8 1997 -> 2031**, 17 -> **18
  dosya** · sema 46/47 DEGISMEDI · marka 0 unexpected) + `npm run build` exit 0 +
  **payload SHA256 esdegerligi 4/4** + sahte-client probe'u (happy-path'te ek DB
  cagrisi YOK) + **harness-bite** (33/34 KIRMIZI) + `pg_indexes` teyidi.
- **CANLI BOT UAT YOK:** 23505 dalinin gercekten tetiklendigi bir vaka gorulmedi;
  `[sla-insert] 23505 UNIQUE` satiri prod'da HENUZ dusmedi. Ayrinti: §2
  *sla_events cift-kayit DAR-GUVENLI BACKSTOP*.
- **DOC SENKRONU:** bu commit dosyayi v39 -> **v40**'a tasir (kod sevkiyle AYNI
  oturum, AYRI commit).

**27. oturumda KAPANDI — DB-KATMAN HARDENING (RLS defense-in-depth)** (`3409a0e`
tenant-032 kaydi + central-011 kaydi + bu doc-sync; **DEPLOY YOK** — DB-katman,
runtime kod degil):
- **CANLI ACIK BULUNDU (recon):** `anon` anahtari 45 tabloda tam CRUD + `exec_sql`
  (SECURITY DEFINER/postgres) anon'a acik -> anon anahtariyla postgres-yetkili
  keyfi SQL. Kok neden: Supabase public-sema **default-privilege** grant'lari;
  bootstrap'in `REVOKE ... FROM PUBLIC`u anon+authenticated'in AYRI grant'larini
  temizlemiyor. **CANLI KANIT:** demo anon key `inhouse_guests_v2` 20 satir ->
  SONRA denied; `exec_sql('SELECT 1')` CALISTI -> SONRA 42501.
- **`migrations/tenant/032_db_hardening_revoke_anon_rls.sql`** (YENI) + **`migrations/
  central/011_db_hardening_revoke_anon_rls.sql`** (YENI): tablo+sequence+fonksiyondan
  anon/authenticated/PUBLIC REVOKE + service_role GRANT + `ALTER DEFAULT PRIVILEGES
  REVOKE` (gelecek grant'lar) + **RLS ENABLE her public tabloda** (policy yok ->
  deny-by-default; service_role bypass).
- **UYGULAMA + KANIT:** 032 -> v5 + demo (`apply-hardening`, exec_sql/postgres-definer,
  preflight owner-assert=0). v5 katalog SONRA: `anon_exec_sql=false`,
  `anon_inhouse_read=false`, `auth_admin_read=false`, `rls_kapali=0`,
  `svc_conv_write=true`, `svc_exec_sql=true` (APP SAGLAM). central-011 ->
  hotelgen-central PROD **SQL Editor'den CANLI** (`anon_bridge=false`,
  `anon_hotels=false`, `rls_off=0`, `svc_ok=true`).
- **`tsql.js` (untracked, hg-scratch) PATCH:** `exec_sql_json` CREATE'inden sonra
  `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role` —
  her tsql kosusu Supabase default-grant'i geri acsa da service_role-only birakir
  (OLCULDU: patched tsql sonrasi `anon exec_sql_json=false`). Commit'e GIRMEZ.
- **INVARIANT KORUNDU:** app + tsql yalniz service_role (user-JWT yolu YOK,
  `mode:'anon'` HIC cagrilmiyor, `central-browser` anon = OLU KOD, `supabase.auth`
  sifir kullanim) -> hardening app'i BOZMAZ. `npm run doctor` YESIL (is8 2031/2031).
- **DOC SENKRONU:** bu commit dosyayi v40 -> **v41**'e tasir (DB-katman kaydiyla AYNI
  oturum). Migration max: **tenant 032 / central 011**.

**SIRADAKI ACIK IS:** verification-core kok nedeni (asagida). Isim-eslesme
konsolidasyonu **TAMAMEN KAPANDI** (7/7 site), `front_office` konsolidasyonu
**9/9 site** ile KAPANDI (#6 + #20) ve `sla_events` INSERT konsolidasyonu **4/4
site** ile KAPANDI (#3) — ucunu de yeniden acmayin.

- **verification parse yanlis-pozitifi (SIRADAKI IS — kok neden ACIK):** `ROOM_REGEX`
  (`verify-guest.ts:131`) prefix'i OPSIYONEL tuttugu icin serbest metindeki HER 2-4
  haneli sayiyi oda no ADAYI yapar. Ustune `requestStopWords` `\b` kalibi cekim eklerini
  KACIRIR ("istiyoruz" != "istiyorum"). 15. oturum yalniz **yanlis-pozitifi**
  kapatti (`disqualifiedAsRoom` 3 OR + prefixsiz-sayi sarti, TR/EN/DE + RU/AR);
  regex'in kendisi ve stop-word kalibi DUZELTILMEDI -> disqualifier'in gormedigi
  mesaj siniflarinda tuzak DURUYOR. **20. otu bunu KAPATMADI** — tek-kaynak refactoru
  prefix LISTESINI birlestirdi, `(?:...)?` opsiyonelligine DOKUNMADI; **21-23. otular
  da DOKUNMADI** (onlar isim-eslesme tarafiydi, oda-no parse degil). Duzeltmek
  verification cekirdegine dokunmaktir, ayri korpus ister (`is8-verify-parse-test.ts`
  zemini hazir, **94 vaka**).
- ~~On buro alerji karti alerjen metnini cevirmiyor~~ — **25. otu KAPANDI**
  (backlog #4, `1da42a9`). Karar tek kaynakta (`needsTurkishLine` SAF +
  `resolveAllergenTurkish` IO); mutfak/GR karti da bu kaynaga BAGLANDI (kopya YOK),
  bicim her kartta kendi dilinde (HTML vs plain-text). Yer tutucu
  `'(belirtilmemis)'` LLM'e GITMEZ.
- **On buro alerji karti BUTONSUZ + `sla_events` YOK (23. otu, dusuk):** M4 spec'i
  alerji yolunda SLA takibini YASAKLADIGI icin bilincli; ama "manuel kontrol
  edildi mi" de IZLENMEZ. Alternatif desen `createReceptionApproval`dir (butonlu +
  `pending_guest_matches` satiri) — kullanilmadi.
- ~~#20 — cok-kolonlu `front_office` lookup'lari helper disinda~~ — **25. otu
  KAPANDI** (`1da42a9`). Cozum ongorulen sekilde ikinci bir helper oldu:
  `getFrontOfficeRow(supa, columns, opts?)`. `handle-callback`in
  `.eq('is_enabled', true)` FARKI opt-in bayrakla KORUNDU. 9/9 lookup tek kaynakta.
- **`route.ts` `notifyFrontDeskUnverified` OLU KOD (23. otu kesfi, dusuk):**
  tanimli, `intentLabel`de `allergy` girisi bile var, ama repo genelinde HICBIR
  cagri yeri yok (canli yol `createReceptionApproval`). Silmek ayri bir karar
  (§1 "pre-existing dead code silme, RAPORLA") — yeni bir on-buro bildirimi
  yazarken hazir sablon olarak OKUNABILIR. 24. otu'da chat_id lookup'i helper'a
  baglandi (desen birebir ayniydi); ustundeki "select daraltildi" yorumu artik
  helper'a tasinan bir select'e atifta bulunuyor — **yeri kaydi, kozmetik**,
  yaniltici degil.
- **Oda-prefix listesi GENISLETME (20. otu, acik):** `ROOM_PREFIXES` bugun **8** uye
  tasiyor. Eksik gorunen adaylar: RU `комната` (oda), AR `مقر`, ve belirlilik takisi
  `ال` ile gelen formlar. Eklemek **DAVRANIS DEGISIKLIGIDIR**, tek-kaynak senkronu
  DEGIL: yeni bir uye AYNI ANDA `ROOM_REGEX`i (daha cok sayi oda sayilir),
  `ROOM_PREFIX_STRIP_RE`yi (daha cok kelime talepten silinir) ve `STOP_WORDS`u (daha cok
  token ISIM olmaktan cikar) genisletir. `ال` ozellikle riskli: cok kisa/yaygin bir
  substring ve strip `gi` **substring** eslesmesiyle calisir -> talep metnini yiyebilir.
  Native (RU/AR) goz + yeni is8 vakalari + §9 `.source` muhurlerinin GUNCELLENMESI sart.
- **`QUANTITY_UNITS_NONLATIN` ham AR literalleri (20. otu, dusuk):**
  `verify-guest.ts:162` hala kaynakta HAM Arapca literal tasir (11 uye) — RTL kurali
  geregi codePoint'e cevrilmeli. Oda-prefix DEGIL, o yuzden 20. otu kapsami disinda
  birakildi. Cevirirken once mevcut literallerin codePoint'i OLCULMELI, yoksa kume
  sessizce kayar (oda-prefixte bu olcum yapildi ve birebir cikti).
- **Serbest-metin ANLAMSAL tekrar dedup'i YOK (17. otu artik borcu):** M2 serbest
  metinde KAPALI oldugu icin misafir ayni cumleyi 3 dk icinde iki kez onaylarsa **iki
  kart** acilir. BILINCLI tradeoff: fazladan kart, kayip talepten iyidir (personel
  ikinci karti gorur ve kapatir; kayip talep GORUNMEZ). Ayni kartin cift tiki /
  Telegram retry'i M1 atomik claim'de durur — acik olan yalniz AYRI akis tekrari.
  Gercek cozum kelime kumesi degil ANLAM karsilastirmasidir (LLM); bulanik esigi
  serbest metne geri acmak KOK NEDENI geri getirir, YAPMA.
- **`cancel` dali atomik claim ALMAZ** (yalniz `confirm`). Es zamanli iki iptal
  misafire iki mesaj gonderebilir — kozmetik, kayit uretmez.
- ~~**`sla_events` / `room_service_orders` uzerinde UNIQUE constraint YOK**~~ —
  **26. otu KISMEN KAPANDI** (`9dcf48a` + migration `031`). `sla_events`'te artik
  **ACIK KAYIT** partial unique VAR ve INSERT'ler tek kaynaktan gectigi icin yeni
  bir INSERT noktasi garantiyi **otomatik ALIR**. **`room_service_orders`'ta hala
  YOK ve BILINCLI olarak yok** (§3-h: dogal anahtar mesru tekrar siparisi bloklar,
  `status` ayirt etmez). M1 atomik claim YERINDE DURUYOR — constraint yalniz tam
  metin esitligini yakalar, M1 ise ayni kartin es zamanli iki callback'ini.
- **029 migration'inin COK-TENANT yayilimi (18. otu, dusuk):** `029_processed_telegram_updates`
  yalniz **v5** tenant'a uygulandi. Migration'i kosmamis bir otelde `claimTelegramUpdate`
  fail-safe `true` doner -> dedup SESSIZCE devre disi (davranis eskisiyle ayni, bozulma
  yok) ama koruma da YOK. Yeni tenant acilisinda migration kosulmali.
- **`update_id` gate'inin maliyet notu (18. otu, dusuk):** gate hotel/token/tenant-client
  cozumunden SONRA calisir (update govdesi ancak orada parse ediliyor). Bir retry bu uc
  okumayi yine oder — yan etki uretmez, ama "sifir maliyetli" degildir. Daha erkene
  almak mevcut hata-yonetimi sirasini degistirmeyi gerektirir.
- **`[update-dedup] skip duplicate` prod-logu MANUEL ZORLANAMAZ (18. otu, dusuk — #31
  ailesi):** gercek Telegram redelivery'sini tetiklemek elde degildir; ayni `update_id`'yi
  elle POST etmek `TELEGRAM_WEBHOOK_SECRET` gerektirir. Normal trafikte gorunen satir
  `first-seen`'dir; `skip duplicate` ancak dogal bir retry aninda log'a duser.
- **`claimErr` aninda cift-kayit korumasi DUSER:** M1'de DB hatasi olursa akis
  bilincli olarak DEVAM eder (siparisi yutmamak icin). Nadir ama kayitli.
- **ru/ar ceviri anlam review'u YOK:** 5-dil sozlukteki Rusca/Arapca metinler is8
  ile yalniz YON, DOLULUK ve "tr'den farkli" acisindan dogrulanir; ANLAM/uslup
  icin native goz gecmedi. Misafire giden metinler, oncelik orta.
- ~~`order:noop` dil-baglama~~ — **25. otu KAPANDI** (backlog #10, `1da42a9`).
  `telegram_chat_id` ile tek lookup acildi; her miss'te `'tr'` fallback (ESKI
  davranis) oldugu icin toast kaybolamaz. IS 10'un son bilincli istisnasi bitti.
- **Misafire donuk ASCII metin ihlali (KISMEN kapandi):** `advanceHousekeeping`in
  adet sorusu artik guest-text.ts'ten TAM Turkce geliyor ("Kaç adet ... istersiniz?"),
  onay/iptal kart etiketleri de oyle. KALAN: `labelForHousekeepingCode` esya
  etiketleri hala ASCII ve TR ("yuz havlusu", "carsaf") — 5 dilde de ayni etiket
  yer tutucuya basiliyor. Etiket sozlugu ayri is; yeni metin YAZARKEN ihlali YAYMA.
- **route.ts damga-okuma kopyasi:** hkItems ve hkComplaint kapilari `prevV`
  okumasini ayri ayri (yaklasik 12 satir) tekrarliyor. Kritik bir deger iki
  yerde yasiyor — biri degisirse digeri kayar.
- **`brainShouldForward` icindeki `isInfoOnly` housekeeping klozu ULASILMAZ**
  (housekeeping beyni artik isInfoOnly uretmiyor). fb/animation kullanmaya
  devam ediyor; fail-safe yonde oldugu icin birakildi.
- **Soru-formatli sikayet kapsami:** sikayet dali ESYA sarti tasir; esyasiz
  servis sikayeti ("odam temizlenmedi") sikayet dalina GIRMEZ, mevcut talep
  akisinda kalir.
- **Housekeeping dogrulama acik sorusu:** `housekeeping` doğrulama gerektiren
  intent listesinde oldugu halde canli UAT'de bot oda no SORMADI. Hangi dalin
  atladigi statik okumayla kanitlanamadi — 1 canli Vercel log satiri
  (`[persistent-verify]` / `[verification]`) gerekiyor.
- **room_rates icin tenant migration YOK** (`npm run doctor` [C] teyidi: ne migrations/tenant'ta
  create-table ne canli tenant DB'de). Dusuk oncelik — rezervasyon linki room_rates'ten bagimsiz
  (hotel-context.ts fetchRoomRates, IS13) + Barboon canli fiyat veriyor. Fiyat listesi icin
  room_rates migration'i + veri gerekir (ayri is).

### 25. oturumdan KALAN borc

**A) KEMAL'IN ELIYLE YAPILACAKLAR (kod isi DEGIL, ajan kapatamaz):**
- **AI butce/harcama limiti KURULMADI.** Kalici rate-limit tuketimi YAVASLATIR ama
  bir TAVAN degildir. Anthropic + OpenAI (Whisper) tarafinda hesap seviyesinde
  harcama limiti/alarmi tanimlanmali — denial-of-wallet'in ikinci yarisi budur.
- **Central `service_role` rotasyonunun TEYIDI.** Demo-hotel anahtari rote edildi;
  `CENTRAL_SUPABASE_SERVICE_ROLE_KEY` tarafinin da yeni degerle deploy edilip
  canli test edildigi (bkz. §2 rotasyon sirasi) TEYIT EDILMELI.
- **`hg-scratch/tenant.env` guncel mi?** Yerel arac dosyasidir, deploy'a girmez;
  rotasyondan sonra guncellenmezse `tsql.js` ve probe'lar sessizce 401 alir.
- **`dpl_` deployment id KAYIT ALTINA ALINMADI (25. otu).** Onceki oturumlarin
  aksine bu dosyada `1da42a9` deploy'unun id'si YOK; sonradan "hangi deploy neyi
  tasidi" sorusu `vercel ls` ile elle cozulmek zorunda kalir.

**B) VERI BUTUNLUGU — backlog #3 (UNIQUE constraint): 26. otu'da KAPANDI:**
- Cozum ve gerekce yukarida (*26. oturumda KAPANDI*) + §3 (a-h) + §2
  *sla_events cift-kayit DAR-GUVENLI BACKSTOP*.
- **25. oturumun "eklemek TEHLIKELI olabilir" uyarisi HALA GECERLI ve COZUMUN
  ICINDE:** UNIQUE mesru bir ikinci talebi sessiz 23505 kaybina cevirebilirdi —
  bu yuzden (i) anahtar **acik kayit** alt kumesine daraltildi, (ii) 23505'i
  YAKALAYAN kod **once** prod'a alindi, (iii) yakalandiginda personele
  `notifyDuplicateRequest` reply'i duser. Bu uc sart olmadan constraint EKLENMEZ.
- **HISTORIK KAPALI DUPLICATE'LER YERINDE DURUYOR — BILINCLI, YENIDEN TEMIZLEME
  GIRISIMI YAPMA.** `sla_events`'te 21 grup / 62 fazla satir, `room_service_orders`
  'ta 7 grup / 20 fazla satir; hepsi **KAPALI** (yanitlanmis/kapanmis) kayitlar ve
  ~%60'i **mesru tekrar** (1 saat - 9 gun arali, en uzunu 9 gun). Partial index
  yalnizca ACIK kayitlari kapsadigi icin bu satirlar constraint'i **TETIKLEMEZ**;
  varliklari bir bozukluk DEGIL, gecmis trafiginin kaydidir. Silmek **veri
  imhasidir** ve hicbir sey kazandirmaz. `room_service_orders` icin de ayni:
  temizlik degil, §3-h geregi constraint EKLENMEMESI karari gecerlidir.

**C) OPSIYONEL ZIRH (bugun bozuk bir sey YOK — kapsam ve sure tahmini):**
- ~~**Tenant DB'lerde RLS (~2-3 gun).**~~ **27. otu KAPANDI** (migration 032 +
  central-011). Bugune kadar izolasyonun TEK katmani uygulama koduydu; her tenant
  erisimi `service_role` ile gidip RLS'i bypass ediyordu (25. otu SLA acigi tam bu
  yuzden "kod atlarsa koruma yok" demekti). Artik **ikinci katman VAR:** her public
  tabloda RLS deny-by-default (policy yok -> anon/authenticated sifir satir),
  anon/authenticated tablo+fonksiyon grant'lari REVOKE, `exec_sql` service_role-only.
  Politika YAZILMADI (gerek yok — app service_role, `rolbypassrls=true`). **ACIK
  KALAN:** 032/central-011 **cok-tenant yayilim** (bkz. D) — yeni tenant acilisinda
  032 kosulmali; RLS'i bugun kullanan app yolu YOK, ama ileride user-JWT/anon yolu
  eklenirse **once policy yazilmali** (deny-by-default o yolu da keser).
- **Tam CSP (~1 gun).** `cf961d0` header'lari ekledi ama **CSP BILINCLI olarak
  EKLENMEDI**: panel inline style ve tsparticles tasiyor, Report-Only ile
  olcmeden zorlamak UI'yi kirar. Once Report-Only, sonra enforce.
- **`serverActions.allowedOrigins` KASTEN bos** — bos birakmak Next'in
  Origin===Host kuralini korur (daha siki) ve preview deploy'lari bozmaz.

**D) 25. oturumda ACILAN kucuk borclar:**
- **Personel `full_name`'leri HALA HAM loglaniyor** (`allergen-notify.ts`,
  `forward-to-department.ts`). Misafir adlari maskelendi; personel adi talimat
  kapsami disindaydi. Ayni `maskName` ile kapatilabilir — ama teslimat teshisinde
  "kime gitti" okunakliligini dusurur, once karar gerekir.
- **`migrations/tenant/030` ve `031` YALNIZ v5 tenant'ta.** 030 yoksa rate-limit
  FAIL-OPEN calisir (limit YOK, bozulma da yok); **031 yoksa 23505 backstop'u OLU
  KOD olarak kosar** (`isUniqueViolation` asla true donmez — davranis eskisiyle
  ayni, koruma da YOK). Yeni tenant acilisinda ikisi de kosulmali; **031'den once
  o tenant'ta acik-dup gate'i TAZE olculmeli** (§3-d).
- **`migrations/tenant/032` YALNIZ v5 + demo'da; `central/011` Central PROD'da (27.otu).**
  032 kosmamis bir tenant'ta anon/authenticated DB'de HALA tam yetkili + RLS kapali
  (acik durur — recon'daki delik). **Yeni tenant acilisinda 032 KOSULMALI**, ve her
  seferinde **preflight owner-assert** (non-postgres sahipli public tablo varsa
  DUR — RLS ENABLE patlar). `central/011` Central migration runner
  (`/admin/central-migrations`) ile de yeniden kosulabilir (idempotent). Bu ucu de
  `schema_migrations`a DUSMEDI (dogrudan exec_sql / SQL Editor — 031 ile ayni).
- **Otel rate-limit tavani (600/dk) OLCUME DEGIL TAHMINE dayanir.** Dusurmeden
  once gercek zirve trafigi olculmeli.
- **Build artik `cdn.sheetjs.com`a bagli** — CDN kesintisi build'i dusurur.
- **`system-prompts.ts` DEGISTI (prompt guard eklendi, `cf961d0`)** -> daha once
  alinmis prompt snapshot'lari (`scripts/prompt-snap.ts` ciktilari) BAYAT; prompt
  karsilastirmasi yapacaksan snapshot'i YENIDEN al.
- **backlog #5 (alerji kartina buton + SLA takibi) bir FEATURE'dir**, guvenlik
  borcu degil — M4 spec'i alerji yolunda SLA'yi YASAKLADIGI icin once urun karari
  gerekir. Bu batch'in DISINDA birakildi.
