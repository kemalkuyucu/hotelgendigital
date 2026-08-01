# CLAUDE.md — HotelGen Digital

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 0. ONCE OKU
- Bu dosya her oturumda okunur. Talimat disina cikma.
- Teshis ve karar Claude'da (sohbet tarafinda). Sen talimati uygularsin.
- Talimatta olmayan "iyilestirme" YAPMA. Gordugun bozuklugu RAPORLA, duzeltme.
- Bu dosya **20. oturum sonrasi** durumu yansitir; sohbet tarafindaki
  **DEVIR + MASTER (v34)** ile hizalidir.
- **SON PROD (20. oturum): `92edccb`** — oda-prefix **TEK KAYNAK `ROOM_PREFIXES`**
  (backlog #5 **KOK**): ayni 8 prefix UC AYRI yerde elle yaziliydi; artik regex
  alternasyonu + strip regex + STOP_WORDS tek diziden URETILIR.
  Deploy `dpl_FCKu2qhQww4bazAhHoFLxBMBzcDH` (target=production, READY; alias
  `hotelgen-v2.vercel.app` `vercel inspect` ile TEYITLI — alias UZERINDEN inspect
  AYNI dpl id'yi cozdu). **`f5a56a7` + `92edccb` BIRLIKTE deploy edildi.** Zincir:
  `1cc5efb` (13. otu prod) -> `631d2a1` (docs) -> `6c30f6f` + `3d9e593`
  (15. otu, oda-no parse + RU/AR) -> `73d92ae` (16. otu, IS 2 M1+M2)
  -> `d5b9408` (17. otu, M2 kapisi; deploy `dpl_7ejoCZTRfzvYeYFLvUK3GbDGur9X`)
  -> `df3f6b5` (18. otu; deploy `dpl_JBrt8hqMoHx9ruxR4M3kXLsTgXL2`)
  -> `48ea1ea` (19. otu, backlog #5 **SEMPTOM**: AR prefixi strip listesine eklendi)
  -> `f5a56a7` + `92edccb` (20. otu, **KOK**). Yedek tag: `pre-tier2-20260728`.
- **DOKUMAN GECIKMESI (20. otu tespiti):** 19. oturum sevki (`48ea1ea`) bu dosyaya
  DOKUNMADI — CLAUDE.md v32/18. oturumda kalmisti. Bu senkron 19+20'yi BIRLIKTE
  tasir. Ders: kod sevki ile doc sevki ayri commit'ler; biri atlanirsa doc sessizce
  bayatlar (kod dogru, harita yanlis).

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
- **`npm run doctor` (scripts/doctor.mjs) = TEK KOMUT saglik kontrolu.** [A] tsc + [B] test:is8 (20. oturum sonu **1827/1827**, **13 dosya**; 1651 (13. otu, 10 dosya) -> 1693 (15. otu `is8-verify-parse-test.ts`, 42 vaka) -> 1734 (16. otu `is8-duplicate-guard-test.ts` 31 vaka + guest-lang'e dedup metni kapsami 10 vaka) -> 1747 (17. otu, YENI DOSYA YOK: `is8-duplicate-guard` 31->36 §8 M2 kapisi, `is8-pending-order` 20->28 §g `isStructuredOrder`) -> 1775 (18. otu `is8-update-dedup-test.ts`, 28 vaka §u1-u10) -> 1781 (19. otu, YENI DOSYA YOK: `is8-verify-parse` 42->48 §8 AR prefix strip) -> 1819 (20. otu §9 regex+strip tek kaynak, 38 vaka) -> 1827 (20. otu §10 STOP_WORDS, 8 vaka; `is8-verify-parse` toplam **94**)) +
  [C] tenant sema/migration butunlugu (canli information_schema; tenant.env yoksa WARN-skip;
  20. otu sonu **GEREKLI 45 / MEVCUT 46**, `migration-eksik: [yok]` — 18. otu ile AYNI,
  20. otu DOC-ONLY + kod refactoru oldugu icin sema DEGISMEDI) +
  [D] sabit-marka taramasi (src/**, dosya-bazli allowlist). Yesil/kirmizi, FAIL -> exit 1. YEREL arac,
  PROD'a deploy EDILMEZ. "Bir sey bozuldu mu?" -> once bunu kos.
- Kalan dogrulama yine `npm run type-check` + `npm run build` + manuel/UAT. Repo kokundeki
  `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` dosyalari tek
  kullanimlik teshis scriptleridir — test degil; referans alma, yenisini ekleme.
- **Migrations do NOT run via npm.** They run from inside the app (admin UI / API routes) per-hotel. See *Migrations* below.
- Node 20+. Deployed on **Vercel** (`hotelgen-v2.vercel.app`); env vars live in the Vercel dashboard, locally in `.env.local`.
- **Izin ayari (15. oturum): `.claude/settings.local.json`** — git'te TAKIPSIZ (yalniz
  `.claude/skills/**` takipli), yani commit gate'inde GORUNMEZ. `defaultMode: acceptEdits`;
  `vercel`/`npx vercel` **ask** listesinde (deploy her defasinda acik onay ister — §3
  DEPLOY kuralinin arac tarafindaki karsiligi), `.env*` okumasi ve `git push --force`
  **deny**. Yeni bir komut reddedilirse once bu dosyaya bak, tahmin etme.
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
| src/lib/sla/handle-order-callback.ts | damga kapisi -> **M1 atomik claim** -> **M2 dedup (yalniz yapili siparis)** -> sla_events + room_service_orders INSERT -> kart |
| src/lib/sla/duplicate-guard.ts | **SAF** `isDuplicateRequest` — normalize + Jaccard; pencere/aday/bildirim YOK (cagirana ait) |

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
`sla_events`/`room_service_orders` uzerinde DB UNIQUE constraint YOK (M1 uygulama
seviyesi korumadir); **serbest metinde bulanik dedup YOK** — ayni cumle 2 kez
onaylanirsa 2 kart acilir (fazladan kart, kayip talepten iyidir; bkz. §7).
(GUNCELLEME 18. otu: "webhook seviyesinde `update_id` dedup'i YOK" kaydi ARTIK
GECERSIZ — giriste gate var, bkz. §2 *Webhook-girisi update_id dedup*. M1 yine de
gerekli: gate retry'i keser, M1 cift-tik'i.)

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

### src/lib/sla/ tam dosya listesi (16. oturumda canli dizinle TEYIT EDILDI — 11 dosya, eksik yok)
`handle-reception-reply.ts`, `check-runner.ts`, `handle-callback.ts`,
`handle-menu-offer-callback.ts`, `send-forward-with-buttons.ts`, `handle-order-callback.ts`,
`handle-note-callback.ts`, `handle-housekeeping-callback.ts`, `housekeeping-forward.ts`,
`notify-duplicate.ts`, **`duplicate-guard.ts`** (16. otu — IS 2)

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
- Tenant migrations live in `migrations/tenant/NNN_*.sql` (3-digit, idempotent, each wrapped in BEGIN/COMMIT; never edit an applied file — add a new one). **En yuksek numarali dosya (18. otu): `029_processed_telegram_updates.sql`** — yeni tablo, ADDITIVE ve GUVENLI (mevcut kolon/veriye dokunmaz). **YALNIZ v5 tenant'a uygulandi**; her YENI tenant'ta calistirilmasi gerekir, aksi halde `claimTelegramUpdate` fail-safe `true` doner ve o otelde dedup sessizce DEVRE DISI kalir (davranis eskisiyle ayni, bozulma yok). (Not: `021_*` yok — numaralandirma 020'den 022'ye atliyor; bu bilinen bir bosluk, sorun degil. Onceki kayit "027" idi, 028 zaten mevcuttu — duzeltildi.) Central migrations in `migrations/central/`. `loadMigrations` skips `000_*` (bootstrap, creates the `exec_sql` RPC — chicken-and-egg) and skips `007_drop_deprecated.sql` unless `includeDestructive`.
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
  (`extractUpdateId`)**.
- **SESSIZ YUTMA YASAGI:** Bir talep herhangi bir kapida dusuruluyorsa
  (dedup/gate/filtre) personel veya misafir MUTLAKA haberdar edilir.
  Sessiz continue/return = kayip. **Bir SIKAYET'i bilgi cevabiyla kapatmak da
  sessiz yutmadir** — aksaklik bildiren misafire KB metni donup kimseye
  iletmemek yasak (IS 8 sikayet dali bunun icin var).
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
  yalniz istendiginde yapilir.
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
  - **TR normalize** -> `normalize-tr.ts` `normalizeTr` (ikinci normalizer YASAK)
- **RAPOR BOTU:** @hotel_yonetici_rapor_bot (id 8504961295) — ASLA DOKUNMA.

## 4. TUZAKLAR (defalarca saat kaybettirdi)
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
- **PowerShell:** && desteklemez, komutlar ayri satir.
  Select-String -Path src\**\*.ts subdirectory'e GIRMEZ.
  Dogru: Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String "..."
- **Commit mesaji ASCII only.** Turkce karakter YASAK.
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
- **Allergen module (M4):** `ALERJEN_MODUL4_KURALLAR.md` is the **authoritative spec** — follow it exactly. Key invariants: the bot never gives medical/safety approval; "no response" is never recorded as "no allergy"; in-house allergy reports notify kitchen+GR flagged staff (`department_staff` flags `is_allergen_primary/backup/is_manager`) **always**, reception only off-hours (00:00–08:00 TR). Per recent commits, allergy notifications are **button-free and create no `sla_events`** — don't add SLA tracking to the allergy path. Notifications via `src/lib/telegram/allergen-notify.ts`.
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

**SIRADAKI ACIK IS:** verification-core kok nedeni (asagida).

- **verification parse yanlis-pozitifi (SIRADAKI IS — kok neden ACIK):** `ROOM_REGEX`
  (`verify-guest.ts:131`) prefix'i OPSIYONEL tuttugu icin serbest metindeki HER 2-4
  haneli sayiyi oda no ADAYI yapar. Ustune `requestStopWords` `\b` kalibi cekim eklerini
  KACIRIR ("istiyoruz" != "istiyorum"). 15. oturum yalniz **yanlis-pozitifi**
  kapatti (`disqualifiedAsRoom` 3 OR + prefixsiz-sayi sarti, TR/EN/DE + RU/AR);
  regex'in kendisi ve stop-word kalibi DUZELTILMEDI -> disqualifier'in gormedigi
  mesaj siniflarinda tuzak DURUYOR. **20. otu bunu KAPATMADI** — tek-kaynak refactoru
  prefix LISTESINI birlestirdi, `(?:...)?` opsiyonelligine DOKUNMADI. Duzeltmek
  verification cekirdegine dokunmaktir, ayri korpus ister (`is8-verify-parse-test.ts`
  zemini hazir, **94 vaka**).
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
- **`sla_events` / `room_service_orders` uzerinde UNIQUE constraint YOK**
  (`003_sla_events.sql`, `023_menu_catalog.sql`: yalniz PK + normal index). M1
  uygulama seviyesi bir korumadir; ileride BASKA bir INSERT noktasi acilirsa ayni
  garantiyi otomatik ALMAZ. DB-seviyesi garanti yeni migration ister.
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
- **`order:noop` dil-baglama:** tek kalan bilincli `'tr'` (bkz. IS 10 istisnasi).
  callback_data'ya convId sigdirmak ya da chat_id lookup'i acmak gerekir; nadir
  yol oldugu icin ertelendi.
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
