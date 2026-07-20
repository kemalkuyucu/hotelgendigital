# CLAUDE.md — HotelGen Digital

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 0. ONCE OKU
- Bu dosya her oturumda okunur. Talimat disina cikma.
- Teshis ve karar Claude'da (sohbet tarafinda). Sen talimati uygularsin.
- Talimatta olmayan "iyilestirme" YAPMA. Gordugun bozuklugu RAPORLA, duzeltme.

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

The codebase and all guest-facing strings are **Turkish**. Guests are served in TR/EN/DE/RU/AR (+FR/IT in some prompts). Work is organized into numbered "Modüller" (M1–M22); commit messages and code comments reference them.

### Komutlar (Commands) — package.json'dan dogrulandi

```bash
npm run dev            # next dev --port 3000
npm run build          # next build
npm start              # next start
npm run lint           # eslint .   (eslint 9)  — NOT "next lint"
npm run type-check     # tsc --noEmit  ← run this to validate TS
npm run test:is8       # IS 8 kanonik korpus (bayrak seviyesi, ag/LLM cagrisi YOK)

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
- Kalan dogrulama yine `npm run type-check` + `npm run build` + manuel/UAT. Repo kokundeki
  `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` dosyalari tek
  kullanimlik teshis scriptleridir — test degil; referans alma, yenisini ekleme.
- **Migrations do NOT run via npm.** They run from inside the app (admin UI / API routes) per-hotel. See *Migrations* below.
- Node 20+. Deployed on **Vercel** (`hotelgen-v2.vercel.app`); env vars live in the Vercel dashboard, locally in `.env.local`.

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
- **Veri onarimi deseni (tek-damga invaryanti, reception-approval.ts GUARD A):** ONCE eski
  satirdan `telegram_id=NULL`, SONRA aktif satira damga, sonra konusma isaretcileri. Her UPDATE
  **id ile** — WHERE'siz UPDATE YOK. Dogrulama: kart sorgusunun BIREBIR aynisini kosur.

### Room-service akisi
| Dosya | Sorumluluk |
|---|---|
| src/lib/menu/parse-order.ts | parseOrder regex kod+adet, extractOrderNote (DIKKAT: src/lib/ai/ ALTINDA DEGIL) |
| src/lib/sla/handle-order-callback.ts | parsePendingOrder -> kart -> room_service_orders INSERT |

### Ortak
| Dosya | Sorumluluk |
|---|---|
| src/lib/ai/anthropic-client.ts | callAI wrapper, AI_PROVIDER env toggle (anthropic <-> openai) |
| src/lib/ai/translate-to-turkish.ts | personel karti TR ceviri |
| src/lib/ai/hotel-context.ts | buildHotelContext / formatContextForPrompt -> prompt bilgi tabani blogu (DIKKAT: src/lib/knowledge/ ALTINDA DEGIL) |

### src/lib/ai/ tam dosya listesi (ADIM 2'de dogrulandi — 16 dosya)
`social-intent-override.ts`, `safety-classifier.ts`, `verification-intents.ts`,
`message-types.ts`, `system-prompts.ts`, `anthropic-client.ts`, `parse-stay-query.ts`,
`detect-room-detail-intent.ts`, `detect-price-intent.ts`, `barboon-live.ts`,
`room-price-tool.ts`, `translate-to-turkish.ts`, `enforce-reply-language.ts`,
`hotel-context.ts`, `classify-and-respond.ts`, `department-brains.ts`

### src/lib/sla/ tam dosya listesi (ADIM 2'de dogrulandi — 10 dosya)
`handle-reception-reply.ts`, `check-runner.ts`, `handle-callback.ts`,
`handle-menu-offer-callback.ts`, `send-forward-with-buttons.ts`, `handle-order-callback.ts`,
`handle-note-callback.ts`, `handle-housekeeping-callback.ts`, `housekeeping-forward.ts`,
`notify-duplicate.ts`

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
- `/api/cron/health-check` — bridge health check for all active hotels **and** runs `runSlaCheck` (SLA scan is piggybacked here to stay within the Vercel Hobby 2-cron limit; the comment says "her dakika" but the schedule is currently daily — adjust the schedule if you need minute-level SLA).
- `/api/cron/archive-checked-out` — archives checked-out guests.

### Migrations (`src/lib/migrations/`, `migrations/`)

Versioned, idempotent SQL applied **per hotel DB at runtime** — not a CLI step.
- Tenant migrations live in `migrations/tenant/NNN_*.sql` (3-digit, idempotent, each wrapped in BEGIN/COMMIT; never edit an applied file — add a new one). **En yuksek numarali dosya (ADIM 2'de dogrulandi): `027_hk_pending.sql`.** (Not: `021_*` yok — numaralandirma 020'den 022'ye atliyor; bu bilinen bir bosluk, sorun degil.) Central migrations in `migrations/central/`. `loadMigrations` skips `000_*` (bootstrap, creates the `exec_sql` RPC — chicken-and-egg) and skips `007_drop_deprecated.sql` unless `includeDestructive`.
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
  esikler, esya/adet, alerjen karari, onay.
- **SESSIZ YUTMA YASAGI:** Bir talep herhangi bir kapida dusuruluyorsa
  (dedup/gate/filtre) personel veya misafir MUTLAKA haberdar edilir.
  Sessiz continue/return = kayip. **Bir SIKAYET'i bilgi cevabiyla kapatmak da
  sessiz yutmadir** — aksaklik bildiren misafire KB metni donup kimseye
  iletmemek yasak (IS 8 sikayet dali bunun icin var).
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
- **callback_data 64 byte siniri.** Asarsan state DB'ye.
- **Bot kimligi:** setWebhook ONCESI getMe ile token dogrula.
- **Vercel:** "Deploy Ready" yetmez. vercel --prod + Production teyidi.
  vercel logs CLI ECONNRESET verir — log web panelinden okunur.
- **Scratchpad scriptleri repo root'a YAZILMAZ.** Ayri dizin kullan.

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
- **Misafire donuk ASCII metin ihlali:** `advanceHousekeeping` misafire
  "Kac adet ... istersiniz?" ve ASCII esya etiketleri ("yuz havlusu", "carsaf")
  gonderiyor; forward sonrasi onay mesajlari da ASCII ("en kisa surede").
  Kural "misafire donuk metinler TAM Turkce" — bu yol kurali ihlal ediyor.
  Yeni metin YAZARKEN ihlali YAYMA (etiketsiz/tam Turkce yaz).
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
