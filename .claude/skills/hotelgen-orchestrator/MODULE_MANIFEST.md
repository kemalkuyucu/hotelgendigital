# MODULE_MANIFEST — HotelGen v2

Single resume point for the `hotelgen-orchestrator` skill. Read this first every session.
Status: ✅ done · 🔧 todo · 🔶 in-progress / verify-only · ⛔ blocked · 👤 Kemal task (non-code)
Order: **Phase A → B → C → D** unless Kemal redirects. Each module = closed box (validate → real-bot → commit → tag → update this row).

> Last reconciled: 2026-05-31, from `AUDIT.md` + `CLAUDE.md` + approved master spec + handoff note.

---

## Reference — completed modules (do NOT redo; verify only if a bug surfaces)

M1 foundation `v1.0-module1` · M2 auth/admin `v1.0-module2` · M3 bridge+email `v1.0-module3` · M4 telegram guest bot `v1.0-module4` · M14a hotel facts/KB `v1.0-module14a` · M14b perplexity discovery `v1.0-module14b` · M15 auto-file+IBAN `v1.0-module15` · M16a location card `v1.0-module16a` · M16b safety classifier `v1.0-module16b(+fix)` · M17a excel+roles `v1.0-module17a/role-system` · M17b/c/d front-office+checkout (no tag) · M17.6 tenant migrations `v1.0-module17.6` · M17.7 pending-match notify `v1.0-module17.7` · M22 group manager panel `v1.0-module22` · **Allergen M4** (per `ALERJEN_MODUL4_KURALLAR.md`, `allergen-notify.ts`) · **Persistent verify** `v1.0-greenpark-verify-loop-fix`.

---

## Phase A — STABILIZE (AUDIT remediation) — DO FIRST
> Order follows AUDIT "Öncelikli Aksiyon Sırası". A4/A5 fix the forward pipeline → prerequisites for Phase B. S1 already ✅.

| ID | Scope (AUDIT ref) | Status |
|----|-------------------|--------|
| A1 | **S2** JWT secret fail-fast in prod; drop hardcoded literal fallback; confirm `HOTEL_ADMIN_JWT_SECRET`/`NEXTAUTH_SECRET` set in Vercel env | ✅ `v1.0-A1-jwt-failfast` 2026-05-31 — shared `src/lib/auth/jwt-secret.ts`, 3 callers repointed; Vercel prod env confirmed set; panel login (hotel-admin demo-hotel + group-admin demo-grup) verified |
| A2 | **S3+S6** add `super_admin` guard to `admin-users` (GET/POST + `[uid]`), `safety-rules`, `knowledge/facts|sections`, `migrations/run`, `central-migrations/run`; align bcrypt cost to 12 | ✅ `v1.0-A2-superadmin-guard` 2026-05-31 — shared `src/lib/auth/guards.ts` `requireSuperAdmin()`, 10 handlers wired, bcrypt 10→12; `status` endpoints left as-is (read-only, out of scope); verified super_admin (AdminYonetici) panel still works |
| A3 | **S4+S8** ManyChat webhook fail-closed (401 if no secret) + `timingSafeEqual` across telegram-manager & manychat webhooks | ✅ `v1.0-A3-webhook-auth` 2026-05-31 — `timingSafeEqualStr` in `verify.ts` (single source); telegram-manager → `verifyTelegramSecret`; manychat fail-closed in prod. ⚠️ Kemal: set `MANYCHAT_WEBHOOK_SECRET` in Vercel when ManyChat goes live (currently unused). Telegram behavior-equivalent for valid traffic — pushed without live manager-bot test per Kemal go |
| A4 | **D1** align `forwarded_messages` insert to actual schema (drop `conversation_id/department_code/message_html/sent_at` or migrate); wrap in try/catch | ✅ `v1.0-A4-A5-unregistered-guest-forward` (commit `e27d89d`) 2026-05-31 — insert aligned + try/catch. POST-DEPLOY real-bot VERIFIED: Demo_OnBuro got "🚨 Kayıt Dışı Misafir Talebi" (intent + declared room/last name + first message) |
| A5 | **D2** `departments.name` → `display_name` at webhook `route.ts:518` (unverified-guest notify silently skipped today) | ✅ `v1.0-A4-A5-unregistered-guest-forward` (commit `e27d89d`) 2026-05-31 — select narrowed to `telegram_chat_id` (dropped non-existent `name`). POST-DEPLOY real-bot VERIFIED (notify now fires) |
| A6 | **D3** `audit_log` → `hotel_audit_log` + correct columns in archive cron | ✅ `v1.0-A6-audit-table-fix` 2026-05-31 — tenant write table `audit_log`→`hotel_audit_log` (cols already valid) + error log; archive logic untouched; accepted on schema evidence (no guest-facing change). Note: Central `audit_log` (sql/01) is a separate, correctly-used table |
| A7 | **H1** wrap whole webhook POST body in try/catch → always 200 (stop Telegram retry storm on throw) | ✅ `v1.0-A7-A8-A9-webhook-resilience` (commit `7e685b5`) 2026-05-31 — secret kontrolü sonrası tüm POST gövdesi (`getHotelBySlug`→final return) dış `try`'a alındı; `catch (fatalErr)` → log + **200** (`info:'handled-error'`). Korunan: secret→401, json parse→400, hotel-not-found→404 (try içinden normal return), inactive/no-token/no-db→200. type-check+build yeşil. **prod-verify: real-bot 2026-05-31** (3 senaryo paketinde akış bozulmadı) |
| A8 | **H3** `verification_attempts` insert: `await` + error check (don't lose security log) | ✅ `v1.0-A7-A8-A9-webhook-resilience` (commit `7e685b5`) 2026-05-31 — `void …insert` → `await` + `if(vaErr) console.error`. **prod-verify: real-bot 2026-05-31** — yanlış soyad → tekrar sor, akış kesilmedi, limit dolunca resepsiyona düştü |
| A9 | **H4** in-house link `update`s: check `error`, else infinite "ask room number" loop | ✅ `v1.0-A7-A8-A9-webhook-resilience` (commit `7e685b5`) 2026-05-31 — 6 in-house update'e error-check log; loop-kritik 2'sine (`conversations.inhouse_match_guest_id` tek-eşleşme + isim-eşleşti) "LOOP-KRİTİK" etiketi. Davranış değişmedi. **prod-verify: real-bot 2026-05-31** — (a) 9999→"kayıt yok+resepsiyon"+Demo_OnBuro "EŞLEŞMİYOR" bildirimi; (b) 102 doğrulandı→ikinci mesaj (havlu) tekrar oda SORMADI, Demo_HK'ya "Oda: 102" düştü = döngü yok |
| A10 | **H2** + finding #1 — **CODE DONE, UNCOMMITTED** (`check-runner.ts`, clean separate file). H2: `getBotTokenForHotel` now demo→env / else `getDecryptedBridge(id).telegramBotToken`. #1 (double escalation): **atomic claim** — `update(escalated_at) WHERE escalated_at IS NULL .select()` before sending; skip if not claimed. type-check+build green; **COMMITTED+PUSHED (`f33c6b9`, deploying)**. #1 atomic-claim confirmed sound (DB row-lock + re-eval WHERE → single message on concurrent calls). External dup cron (cron-job.org) also removed by Kemal. Awaiting POST-DEPLOY double-escalation test. **Finding #3 reclassified → AUDIT D5 = A11**. Tag pending verification | 🔶 |
| A11 | **D5** when guestId came from v2, query `inhouse_guests_v2` (not legacy) | ✅ `v1.0-A11-d5-room-fix` (commit `e27d89d`, also carries A4/A5) 2026-05-31 — root cause of finding #3 ("Oda: —"). `handleVerificationFlow` was re-querying LEGACY `inhouse_guests` with a v2 id → room lost. Fix: build `verifiedGuestRecord` directly from `verifyGuest()` result, eliminating broken re-query. POST-DEPLOY real-bot VERIFIED (19:11 → "Oda: 102" in Demo_HK). Note: re-verify path `route.ts:1944` still has same legacy+v2-id pattern — harmless now (only fires on re-verify) but worth a follow-up. type-check+build green; **COMMITTED+PUSHED (`e27d89d`, deploying)** with A4/A5. ⚠️ Pre-deploy test failed because fix wasn't live (prod ran old code). **POST-DEPLOY REAL-BOT VERIFIED ✅ 2026-05-31** — 19:11 talebinde Demo_HK grubunda "Oda: 102" göründü; both path (A) & (B) work on prod. Commit `e27d89d` (shared with A4/A5). Tag pending A4/A5 verification (same commit) |
| A12 | **D4** extend archive cron to `inhouse_guests_v2` (`status active→archived`, `check_out_date<today`) — else persistent-verify treats checked-out as active | ✅ `v1.0-A12-archive-v2-extend` (commit `7e9fca4`) 2026-05-31 — archive cron'a v2 bloğu legacy'nin yanına eklendi: `inhouse_guests_v2` `.lt('check_out_date', getTurkeyToday())` + `.eq('status','active')` → `{status:'archived', archived_at:now()}`. Legacy `inhouse_guests` (is_active bool) bloğu olduğu gibi kaldı. İki sayaç toplanıp `hotel_audit_log.auto_archive_checked_out`'a yansıdı (details: archived_legacy/archived_v2/archived_count kırılımı). Her iki update error ayrı kontrol. type-check+build yeşil; COMMITTED+PUSHED+TAGGED. **prod-verify: next nightly run** (cron gece 00:00 çalışır → anlık test yok; bir sonraki gece koşusunda v2 checkout'ların `status='archived'` olduğu + audit log'da `archived_v2>0` doğrulanacak) | ✅ |
| A13 | **D6** `handle-callback`: `.maybeSingle()` + drop non-existent `conversations.language` | ✅ `v1.0-A13-callback-language-fix` 2026-05-31 — phantom `conversations.language` dropped + `.single()`→`.maybeSingle()`; real-bot verified (havlu→HK, button→guest confirmation delivered, no language error) |
| A14 | **L1** repoint `lint` script to ESLint CLI so the quality gate actually runs | ✅ `v1.0-A14-lint-eslint-cli` 2026-05-31 — `lint`→`eslint .` (ESLint 9 flat config); throwaway files (`__*`/`scratch_*`/`test_*`/`code-templates/`) ignored. Gate now RUNS but red on legacy baseline (32 err/26 warn in src+scripts) — rules NOT disabled; cleanup is a separate effort (Phase D candidate), so lint is not yet a hard gate |
| A15 | **D7** unify dual hotel schema (`sql/05_*` vs `migrations/tenant/001`); pick one source, align/archive others — **[needs live DB confirm]** | 🔶 |

## Phase B — BRAIN RE-ARCHITECTURE (master spec Bölüm A + B)
> Turn the single-brain orchestrator into the hybrid per-department model. Render the Turkish master spec into English prompt files per the language policy.

| ID | Scope | Status |
|----|-------|--------|
| B1 | Create constitution files `00-master.md` + `01-front-office`…`07-animation` from master spec Bölüm A/B; wire into `system-prompts.ts` + orchestrator with lazy-load by department | 🔧 |
| B2 | **4 message types** (SOHBET/BİLGİ/TALEP/BİLDİRİM): add the `notification` path to `routeIntentToDepartment`; map intents per master spec A.2; guarantee BİLDİRİM = no button + no `sla_events`; TALEP = 2 buttons + SLA | 🔧 |
| B3 | Verify allergen path = `ALERJEN_MODUL4_KURALLAR.md` + master spec A.7 (kitchen+GR, button-free). Real-bot: `mantar alerjim var` → confirm handoff-note failure is resolved; fix only if still broken | 🔶 |
| B4 | Regression: persistent verify still green after B1/B2 (already ✅+tagged) | 🔶 |

## Phase C — KNOWLEDGE / PERPLEXITY (master spec Bölüm C)
| ID | Scope | Status |
|----|-------|--------|
| C1 | Pre-fill Green Park environment discovery (option A — demo-safe) + define empty-result fallback wording (no hallucination, polite redirect) | 🔧 |
| C2 | Write airport/center distance (km) into `hotel_settings.location_info` → Perplexity-free, instant, consistent answers | 🔧 |
| C3 | Verify "bilgi sistemde yok" fallback only fires when data truly absent (3-source read intact) | 🔶 |

## Phase D — FEATURES & COMPLETION
| ID | Scope | Status |
|----|-------|--------|
| D-RL | Reservation Links: commit the ~810 local lines; ordered list (hotel's own link first, then agencies, panel 1-2-3 priority) | 🔶 |
| D-REP | Manager reporting detail (master spec Bölüm D): per hotel×department breakdown · request text · room/guest · created→first-response time · status · escalation reason form · **PDF + Excel/CSV download**. Build on `sla_events`/`requests`/`sla_violations` + M22 group panel. **+ Real-bot finding #2 (2026-05-31, A13 test):** reception currently gets a button/message on escalation, but it should be a **FORM** — reception contacts the relevant department, writes a delay explanation, and that explanation must surface in the manager report (detailed). This is the "escalation reason form" → report linkage; design here | 🔧 |
| D-TZ | Module 18: Tomorrow-filter UTC vs TR drift after 21:00 TR | 🔧 |
| D-PEND | Pending-match real test (`/start` → room 999) + multi-match UI (M17.5) | 🔧 |
| D-TAG | Apply missing tags: `v1.0-module17b`, `v1.0-module17cd` | 🔧 |
| D-TG | Telegram dept-group prerequisites: 7 groups, BotFather privacy off, collect chat_ids, seed `departments`, revoke leaked tokens | 👤 |

---

### Notes
- **UX backlog (real-bot 2026-05-31, A4/A5 test — DO NOT fix now, later phase):**
  - **UX-1:** Unregistered-guest notification fires too late (after 3 failed attempts + delay). Candidate: reduce attempt count + speed up the moment of send. (Kemal wants attempt count = 2; code is currently `MAX_VERIFICATION_ATTEMPTS = 3` in `verification-intents.ts:34`. No master spec file in repo specifies a number — see below.)
  - **UX-2:** Notification after lock-out may be delayed in its send timing → speed-up candidate.
- **Master spec attempt count (reported 2026-05-31):** `HOTELGEN_MASTER_SPEC.md` does **not exist** in the repo (root or docs/); no markdown documents a specific verification-attempt count. `CLAUDE.md` only says "Max attempts then locks." The only authoritative value today is the code constant `MAX_VERIFICATION_ATTEMPTS = 3`. Kemal wants 2 → this is a config decision, no spec to reconcile.
- **Allergen is likely already correct** per `CLAUDE.md` (button-free, kitchen+GR via `allergen-notify.ts`). B3 is verify-first, not re-fix.
- **SLA values** may be set low for testing (technical 1/5) — restore to real 30/60 before go-live (track under D).
- **Summary threshold conflict:** master mimari answer = 50 msg; live = ~20 msg / 8000 tokens. Keep live value; Kemal to confirm.
