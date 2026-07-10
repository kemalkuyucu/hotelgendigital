# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles (read this first)

Behavioral rules for any agent editing this repo. They bias toward caution over speed; for trivial tasks use judgment.

**Think before coding.** Don't assume — if a request is ambiguous, surface interpretations or ask; don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and name it.

**Simplicity first.** Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible cases. If 200 lines could be 50, rewrite it.

**Surgical changes.** Touch only what the request requires — every changed line must trace to the task. Don't "improve" adjacent code, comments, or formatting; match existing style. Remove only orphans YOUR change created; never delete pre-existing dead code unless asked (mention it instead).

**Debug by root cause, not symptom.** NO FIX WITHOUT ROOT-CAUSE INVESTIGATION FIRST — a symptom patch is a failure. Read errors fully, reproduce, check recent git changes. In multi-layer flows (webhook -> AI -> DB) add diagnostic logging at each boundary and gather evidence showing WHERE it breaks before proposing a fix. Form ONE hypothesis, make the SMALLEST change to test it, verify, then continue — never bundle multiple fixes. If 3+ fixes fail, stop and question the architecture; don't attempt fix #4.

**Verify with live evidence — never self-report success.** "type-check passed" or "it should work" is NOT proof. Proof = live bot behavior, Vercel logs, SQL results, real Telegram tests. Verify DB schema live via information_schema (migration status can show a false green). This agent EXECUTES the given instructions only: no self-initiated diagnosis, no added scope, no "while I'm here" edits — decisions come from the human/orchestrator.

**HotelGen commit & output rules.** Run `npm run type-check` before every commit (no test suite exists; type-check + build + manual UAT are the gates). Commit messages ASCII only (conventional `fix:`/`feat:`/`chore:`); guest-facing strings use full Turkish characters (Agustos -> Ağustos, kisi -> kişi) — never ASCII approximations. Migrations are per-tenant, idempotent, runtime-applied; never edit an applied migration — add a new numbered file. NEVER touch the manager report bot (`@hotel_yonetici_rapor_bot`, id 8504961295).

---

## What this is

**HotelGen v2** — a multi-tenant hotel guest-assistant SaaS built on **Next.js 16 (App Router) + TypeScript + Supabase**. Guests message a hotel over **Telegram** (and ManyChat = WhatsApp/Instagram); an AI orchestrator (Claude) answers from the hotel's knowledge base, runs guest verification, and forwards actionable requests to the right hotel department over Telegram, with SLA escalation. Staff/owners manage everything through role-based admin panels.

The codebase and all guest-facing strings are **Turkish**. Guests are served in TR/EN/DE/RU/AR (+FR/IT in some prompts). Work is organized into numbered "Modüller" (M1–M22); commit messages and code comments reference them.

## Commands

```bash
npm run dev            # next dev --port 3000
npm run build          # next build
npm start              # next start
npm run lint           # next lint (eslint 9)
npm run type-check     # tsc --noEmit  ← run this to validate TS; there is no test suite

npm run seed:demo-knowledge   # tsx scripts/seed-demo-knowledge.ts (needs DEMO_HOTEL_SUPABASE_* env)
npm run create-admin          # node scripts/create-admin.mjs (master admin bootstrap)
npm run seed-departments      # node scripts/seed-department-users.mjs
```

- **There are no automated tests.** Don't add a `test` npm script expecting CI; validate changes with `npm run type-check` + `npm run build` and manual/UAT. The `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` files in the repo root are throwaway diagnostic scripts — not a test suite; don't treat them as reference code or add new ones.
- **Migrations do NOT run via npm.** They run from inside the app (admin UI / API routes) per-hotel. See *Migrations* below.
- Node 20+. Deployed on **Vercel** (`hotelgen-v2.vercel.app`); env vars live in the Vercel dashboard, locally in `.env.local`.

## Multi-tenant architecture (the core mental model)

There is **one Central Supabase DB** ("ours") and **one separate Supabase DB per hotel**. Hotel data (guests, conversations, requests, departments, knowledge, SLA events) lives in the *hotel's own* DB — never in Central.

- **Central DB** holds: `hotels`, `packages`, `channel_routing`, `bridge_credentials`, `master_admins`, `master_admin_sessions`, `system_safety_responses`, group-admin tables. Accessed via `getCentralSupabase()` (`src/lib/supabase-client.ts`) or `getCentralServerClient()` (cookie-aware, `src/lib/supabase/central-server.ts`). Uses `CENTRAL_SUPABASE_URL` + `CENTRAL_SUPABASE_SERVICE_ROLE_KEY`.
- **Each hotel's Supabase URL + service/anon key + Telegram bot token** are stored **encrypted** in Central's `bridge_credentials` table. Encryption is **AES-256-GCM** (`src/lib/encryption.ts`, `encryptCredential`/`decryptCredential`), keyed by `ENCRYPTION_MASTER_KEY` (64 hex chars). Format: `base64(iv[12] || authTag[16] || ciphertext)`.
- **Resolving a tenant → a hotel-DB client** happens two ways:
  - By **channel id** (inbound messages): `resolveTenant(channelType, channelId)` in `src/lib/tenant-resolver.ts` → looks up `channel_routing` → decrypts bridge creds → returns a `SupabaseClient` for that hotel's DB.
  - By **slug** (admin panels, webhooks, migrations): `getHotelBySlug()` (`src/lib/tenant/get-hotel-by-slug.ts`), `resolveTenantBySlug()` (`src/lib/hotel-admin/tenant.ts`), `getHotelClient(hotelId)` (`src/lib/tenant/get-hotel-client.ts`), `getDecryptedBridge()` (`src/lib/tenant/decrypt-credentials.ts`).
- All tenant resolvers keep a **5-minute in-memory cache** (per Vercel instance). When `bridge_credentials` change, call `invalidateTenantCache` / `invalidateSlugCache` / `clearHotelClientCache`.
- **`demo-hotel` is special-cased**: it reads creds straight from env (`DEMO_HOTEL_SUPABASE_URL`, `DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN_DEMO`) instead of `bridge_credentials`. Look for `if (slug === 'demo-hotel')` branches when touching tenant/token resolution.

**Implication:** almost every server action/route first resolves the hotel, then does all data work through that hotel's `SupabaseClient`. Never query hotel data on the Central client.

## Inbound message pipeline (Telegram guest webhook)

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

## Department forwarding & SLA (`src/lib/telegram/`, `src/lib/sla/`)

- `forward-to-department.ts` posts the request to the department's Telegram group **and** DMs on-shift staff (`getActiveStaffNow`), writing `forwarded_messages` rows. `off-hours.ts` (`resolveTargetDepartment`) reroutes to reception when a department has `off_hours_behavior='forward_to_reception'` and is outside `working_hours` (Europe/Istanbul time).
- SLA flow (Module 11): forwards can be sent with inline buttons (`send-forward-with-buttons.ts`); button presses → `handle-callback.ts`; reception replying to an escalation message → `handle-reception-reply.ts`.
- `src/lib/sla/check-runner.ts` (`runSlaCheck`) scans each hotel's `sla_events`: overdue dept events → escalate to front office and set a reception deadline; overdue reception → auto-close as `no_response`.

## Cron jobs (`vercel.json`, `src/app/api/cron/`)

Two Vercel Cron jobs, both daily at 00:00 (`vercel.json`), authed by `Authorization: Bearer ${CRON_SECRET}`:
- `/api/cron/health-check` — bridge health check for all active hotels **and** runs `runSlaCheck` (SLA scan is piggybacked here to stay within the Vercel Hobby 2-cron limit; the comment says "her dakika" but the schedule is currently daily — adjust the schedule if you need minute-level SLA).
- `/api/cron/archive-checked-out` — archives checked-out guests.

## Migrations (`src/lib/migrations/`, `migrations/`)

Versioned, idempotent SQL applied **per hotel DB at runtime** — not a CLI step.
- Tenant migrations live in `migrations/tenant/NNN_*.sql` (3-digit, idempotent, each wrapped in BEGIN/COMMIT; never edit an applied file — add a new one). Central migrations in `migrations/central/`. `loadMigrations` skips `000_*` (bootstrap, creates the `exec_sql` RPC — chicken-and-egg) and skips `007_drop_deprecated.sql` unless `includeDestructive`.
- `runMigrations({ hotelSlug })` (`runMigrations.ts`) decrypts the hotel bridge, builds a tenant client, ensures `schema_migrations`, and runs unapplied files via the **`exec_sql` RPC** (SQL executed through a Postgres function, not the JS query builder).
- Triggered from admin UI / API: `/api/admin/migrations` (tenant), `/api/admin/central-migrations`, `/api/admin/hotels/[id]/run-migrations`, with a `migrations` admin page. Also `seedBaseline` / `runBootstrap`.
- **Single source of truth for tenant schema = `migrations/tenant/*`.** The legacy `sql/0x` hotel-side files (`05_hotel_schema` … `12_*`) are DEPRECATED/archive only — pre-migration manual "Supabase SQL Editor" bootstrap; never re-run them. (A15/AUDIT D7, resolved 2026-06-01: a read-only probe of both live tenants — demo-hotel + green-park-test — confirmed **no schema drift**; both are pure 001-chain. Only live difference: `match_documents()` RPC present on demo, absent on green-park → a Phase-C/RAG follow-up, not a schema conflict.)

## Auth, roles & route structure

Three independent auth systems, three cookies, enforced in `src/middleware.ts` (file MUST be named `src/middleware.ts` — renaming it disables all protection; the file header documents a prior incident where it was `proxy.ts` and `/admin/*` was unprotected):

| User | Login | Cookie | Mechanism | Routes |
|------|-------|--------|-----------|--------|
| Master admin / manager | `/admin/login`, `/manager/login` | `hg_admin_session`, `hg_manager_session` | Opaque token, **SHA-256 hash stored in Central `master_admin_sessions`** (`src/lib/auth/session.ts`, `manager-session.ts`). Roles `super_admin`/`admin` only. | `/admin/*`, `/manager/*` |
| Hotel admin (owner + dept managers) | `/hotel-admin/[slug]/login` | `hg_hotel_session` | **JWT (jose, HS256)** signed with `HOTEL_ADMIN_JWT_SECRET`, verified against hotel DB `hotel_admin_users` (bcrypt). `src/lib/hotel-admin/auth.ts` | `/hotel-admin/[slug]/*` |
| Group admin | `/group-admin/[slug]/login` | `group_session` | JWT (jose), same secret. `src/lib/group-admin/auth.ts` | `/group-admin/[slug]/*` |

- Middleware also does **per-role path gating** for hotel admins via `PATH_ROLE_MAP` (e.g. `front-office` segment → only `hotel_owner` + `front_office_manager`). Add a new protected hotel-admin section → update that map.
- `getManagerOrHotelAdmin()` (dual-auth) lets routes accept either the manager session or a hotel-admin JWT.
- App Router groups: `src/app/admin/(protected)/*`, `src/app/hotel-admin/[slug]/*`, `src/app/group-admin/[slug]/*`, `src/app/manager/*`, plus the public landing (`src/components/landing/*`). API under `src/app/api/{admin,hotel-admin,manager,group-admin,webhooks,cron,auth,health-check}/`.

## Conventions & gotchas

- **Turkish normalization:** use the shared `normalizeTr()` (`src/lib/utils/normalize-tr.ts`) for any keyword/name matching — verification and interest-tag detection both depend on it. Don't roll a second normalizer (some older code inlines `.replace(/İ/g,'i')…` chains; prefer the shared util).
- **Timezone:** all "now"/off-hours/SLA logic is **Europe/Istanbul** (`src/lib/date/turkeyTime.ts`, e.g. `getTurkeyToday`). Never use raw local server time for business hours.
- **Guest table is `inhouse_guests_v2`** (TEXT `room_number`, single `guest_name`, `status='active'`, `check_out_date`). Legacy `inhouse_guests` exists only as a fallback in `verify-guest.ts`. New code should target v2.
- **Allergen module (M4):** `ALERJEN_MODUL4_KURALLAR.md` is the **authoritative spec** — follow it exactly. Key invariants: the bot never gives medical/safety approval; "no response" is never recorded as "no allergy"; in-house allergy reports notify kitchen+GR flagged staff (`department_staff` flags `is_allergen_primary/backup/is_manager`) **always**, reception only off-hours (00:00–08:00 TR). Per recent commits, allergy notifications are **button-free and create no `sla_events`** — don't add SLA tracking to the allergy path. Notifications via `src/lib/telegram/allergen-notify.ts`.
- **Webhooks must return 200** and degrade gracefully; services return `{ success, error }` / log-and-continue rather than throwing across the message path.
- **Markdown is stripped** from guest replies (Telegram) and the AI is instructed to emit plain text only.
- Generated Supabase types: `src/types/database-central.ts`, `src/types/database-hotel.ts`.
