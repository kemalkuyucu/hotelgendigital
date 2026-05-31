---
name: hotelgen-orchestrator
description: Controlled, module-by-module execution engine for HotelGen v2 (hotelgendigital repo). Invoke for ANY multi-step implementation, bug fix, AUDIT remediation, or brain re-architecture task — anything spanning more than one file or needing verification before shipping. Enforces the read-first → diagnose → implement → validate → real-bot-verify → commit → tag loop, applies every hard-won repo safety rule, and tracks progress in MODULE_MANIFEST.md so work resumes cleanly across sessions and the user is never asked to babysit safe steps.
---

# HotelGen Orchestrator

The disciplined way to do HotelGen work. Read this fully before touching code, then follow the loop in §3 for every module. Companion file: `MODULE_MANIFEST.md` (in this folder) = the ordered worklist + live status. Project context: repo-root `CLAUDE.md` (architecture) and `AUDIT.md` (current bug map). These three plus the user's approved master spec are the source of truth.

## 1. Mission

Move the project forward **one closed module at a time**: correct, verified on the real system, committed, tagged, and recorded — with the human (Kemal) interrupted only at the two points where human judgment is irreducible (real-bot acceptance, and irreversible deploy/tag). Everything else runs without nagging. Speed comes from not repeating mistakes, not from skipping verification.

## 2. Non-negotiable principles

1. **Read before write — idempotent.** Inspect current reality first (`MODULE_MANIFEST.md`, the `AUDIT.md` finding, the actual files). Rule everywhere: *if it exists, update or skip; if not, create.* Never recreate what is already there. State the real current condition in 2–3 lines before proposing anything.
2. **Evidence before fix — no blind fixes.** For any bug, produce the proof first: the exact code excerpt + line, the migration/schema excerpt, or the Vercel log line. Tool/agent diagnoses ("there might be a duplicate", "this should work") are not evidence — cite the actual output. A correct diagnosis is a 30-second fix; a guess wastes the session.
3. **The real Telegram bot is the only source of truth for guest behavior.** A green `type-check`/`build`, a passing `curl`, or a local script PASS does **not** prove the guest flow works. Never self-certify guest-facing behavior. Stop and ask Kemal to run the real bot.
4. **Verify on production.** After a deploy, acceptance is on `hotelgen-v2.vercel.app` with a hard refresh (Ctrl+Shift+R). Every push to branch `hotelgen-v2` auto-deploys.
5. **One module, closed box.** Finish → validate → real-bot verify → commit → tag → update manifest. Only then the next module. A module connects to others only through defined interfaces.

## 3. The per-module loop

For the current module in `MODULE_MANIFEST.md`:

1. **READ** *(auto)* — Open the manifest, identify the current module + the `AUDIT.md`/spec refs it cites, read the named files. Report current condition. If the module says "verify X" and the code already satisfies X, say so and jump to step 6 (don't rewrite working code).
2. **DIAGNOSE / SCOPE** *(auto)* — Bug: produce evidence (§2.2). Feature: list what exists vs. what's missing. Re-architecture: map the target (master spec) onto the current files.
3. **PLAN** *(auto, show Kemal — short)* — Micro-steps, files touched, idempotent strategy. No essay.
4. **IMPLEMENT** *(auto)* — Edit/create files. Obey every guardrail in §4.
5. **VALIDATE** *(auto)* — Run `npm run type-check` then `npm run build`. Must be green. If red: fix and repeat. Never advance on red. (`npm run lint` is currently broken — see §4 L1 — so it is not a gate until fixed.)
6. **HUMAN GATE — real-bot test** *(STOP)* — Emit a short Turkish test block: which bot, exactly what to type, the expected result. Wait for Kemal's screenshot/confirmation. Do not commit before this.
7. **COMMIT** *(auto, after green + Kemal's confirmation)* — Conventional message referencing the module (e.g. `fix(M-A4): align forwarded_messages insert to schema`).
8. **HUMAN GATE — push / tag** *(ASK)* — `git push` and `git tag` auto-deploy / mark releases; always ask before either.
9. **UPDATE MANIFEST** *(auto)* — Mark the module ✅ + tag + date. Advance only when Kemal says go.

Steps marked *(auto)* must not generate permission prompts — `.claude/settings.local.json` allow-lists them. The only interruptions are the two human gates and anything genuinely destructive.

## 4. Repo guardrails (violating any of these has broken prod before)

- **`src/middleware.ts` filename is load-bearing.** Renaming it disables ALL auth (prior incident: it was `proxy.ts` and `/admin/*` was unprotected). Never rename.
- **Auth cookies path = `/`** (never the panel path, or API calls fail).
- **Turkish matching → `normalizeTr()`** (`src/lib/utils/normalize-tr.ts`) only. Don't inline a second normalizer.
- **All time/business-hours/SLA logic → Europe/Istanbul** (`src/lib/date/turkeyTime.ts`). Never raw server time.
- **Guest table is `inhouse_guests_v2`** (TEXT `room_number`, `guest_name`, `status='active'`, `check_out_date`). Legacy `inhouse_guests` is fallback only. When a v2 id is in hand, query v2 — never legacy with a v2 id (AUDIT D5).
- **After any knowledge CRUD → `invalidateSummary(hotelId)`** or the bot serves stale info for 5 min.
- **Webhooks always return 200** and degrade gracefully (services return `{success,error}` / log-and-continue, never throw across the message path). Telegram retries on non-200 (AUDIT H1).
- **Guest replies are plain text** — markdown is stripped; AI must emit plain text.
- **Allergen path follows `ALERJEN_MODUL4_KURALLAR.md` exactly**: button-free, creates **no** `sla_events`, notifies kitchen+GR flagged staff (`department_staff.is_allergen_primary/backup/is_manager`) **always**, reception only off-hours (00:00–08:00 TR). Never add SLA tracking to the allergy path.
- **Vercel Hobby limits:** no `waitUntil` / no fire-and-forget async — use sequential `await`. Max 2 cron jobs (SLA scan is piggybacked on health-check for this reason).
- **Verify column names against the migration before writing a query.** AUDIT D1/D2/D3 were all column/table-name mismatches that silently broke writes (`forwarded_messages`, `departments.name`→`display_name`, `audit_log`→`hotel_audit_log`).
- **Migrations:** per-hotel at runtime via the `exec_sql` RPC (not the JS query builder); idempotent; 3-digit names; **never edit an applied file — add a new one**; runner skips `000_*` (bootstrap) and `007_drop_*` unless destructive. **Single schema authority = `migrations/tenant/*`** — the old `sql/0x` hotel-side files (05–12) are DEPRECATED/archive (pre-migration manual "SQL Editor" bootstrap, never re-run). A15/D7 resolved 2026-06-01: read-only probe of both live tenants (demo-hotel, green-park-test) confirmed **no drift** — both are pure 001-chain. (Lone live diff: `match_documents()` RPC exists on demo, absent on green-park → Phase C/RAG follow-up, not a schema issue.)
- **`tsc --noEmit` must stay at 0 errors.** **L1:** `next lint` is broken (Next 16 removed the subcommand); until the lint script is repointed to the ESLint CLI, validation = type-check + build.
- **Never commit secrets.** `.env`, `.env.local`, `.env.production` are git-ignored; never read or print their values (AUDIT S1).

## 5. Manifest usage

`MODULE_MANIFEST.md` is the single resume point. Always start a session by reading it. Phases run in order (A stabilize → B brain → C knowledge → D features) unless Kemal redirects. After completing a module, update its row (status ✅, tag, date) and note anything discovered. If a module turns out already-satisfied by current code, mark it ✅ with "verified, no change" rather than rewriting.

## 6. Human-gate message format (Turkish, short)

Real-bot gate:
> ✅ Kod hazır · type-check + build yeşil.
> **ŞİMDİ SEN:** `@<bot>` üzerinden yaz → `<mesaj>`
> **Beklenen:** `<sonuç>`
> Ekran görüntüsü/teyit gelince commit + (onayınla) push.

Push/tag gate:
> Commit hazır. **Push edeyim mi?** (prod'a otomatik deploy olur) · Tag: `<tag>`
