# DEVİR NOTU — HotelGen v2

> Son güncelleme: 2026-05-31 · Branch: `hotelgen-v2` · Resume noktası: `.claude/skills/hotelgen-orchestrator/MODULE_MANIFEST.md`
> Bu not = oturumlar arası hızlı devir. Detay her zaman MODULE_MANIFEST.md + AUDIT.md'de.

---

## Phase A — STABILIZE (AUDIT remediation)

### ✅ Tamamlanan (15 modül — Phase A %100)

| ID | Konu (AUDIT) | Tag |
|----|--------------|-----|
| A1 | S2 — JWT secret fail-fast, hardcoded fallback kaldırıldı | `v1.0-A1-jwt-failfast` |
| A2 | S3+S6 — `super_admin` guard + bcrypt cost 12 | `v1.0-A2-superadmin-guard` |
| A3 | S4+S8 — ManyChat fail-closed + `timingSafeEqual` | `v1.0-A3-webhook-auth` |
| A4 | D1 — `forwarded_messages` insert şemaya hizalandı + try/catch | `v1.0-A4-A5-unregistered-guest-forward` (`e27d89d`) |
| A5 | D2 — `departments.name`→`display_name` (kayıt-dışı notify artık çalışıyor) | `v1.0-A4-A5-unregistered-guest-forward` (`e27d89d`) |
| A6 | D3 — `audit_log`→`hotel_audit_log` (archive cron) | `v1.0-A6-audit-table-fix` |
| A7 | H1 — webhook dış try/catch → her durumda 200 | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A8 | H3 — `verification_attempts` insert `await` + error check | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A9 | H4 — in-house link update'lerine error-check (sonsuz "oda no sor" döngüsü önlendi) | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A10 | H2 + #1 — per-hotel token + atomik claim ile çift-eskalasyon önleme | `v1.0-A10-sla-atomic-claim` (`f33c6b9`) |
| A11 | D5 — v2 id ile `inhouse_guests_v2` sorgusu ("Oda: —" kök neden) | `v1.0-A11-d5-room-fix` (`e27d89d`) |
| A12 | D4 — archive cron `inhouse_guests_v2` genişletildi | `v1.0-A12-archive-v2-extend` (`7e9fca4`) |
| A13 | D6 — SLA callback fantom `conversations.language` + `.maybeSingle()` | `v1.0-A13-callback-language-fix` |
| A14 | L1 — `lint` script ESLint CLI'ye yönlendirildi | `v1.0-A14-lint-eslint-cli` |
| A15 | D7 — şema ikiliği: canlı probe → drift YOK; `sql/0x` arşiv, tek otorite `migrations/tenant/*` | `v1.0-A15-schema-reconcile-docs` |

A7/A8/A9 hepsi **real-bot prod-verify 2026-05-31** (3 senaryo geçti: 9999 no-match bildirimi, 102 doğrulama + döngü yok, yanlış soyad attempt-log + limit→resepsiyon).

### ✅ A10 — TAMAMLANDI (prod-verify 2026-06-01)

**A10 — H2 + çift-eskalasyon önleme (AUDIT H2 + real-bot #1)** — `v1.0-A10-sla-atomic-claim` (`f33c6b9`)
- İçerik: `getBotTokenForHotel` per-hotel token (demo→env / else `getDecryptedBridge`); çift-eskalasyon için **atomik claim** (`update(escalated_at) WHERE escalated_at IS NULL .select()` → claim edilmezse mesaj atma). Harici dup cron (cron-job.org) Kemal tarafından kaldırıldı.
- **PROD-VERIFY ✅ 2026-06-01:** doğrulanmış misafir (102) talep gönderdi, butona basılmadı, SLA aşımında Demo_OnBuro'ya eskalasyon **TAM 1 KEZ** düştü (önceden 2 kez), "Oda: 102" dolu.

### ✅ A15 — TAMAMLANDI (2026-06-01) — Phase A artık %100 (15/15)

**A15 — D7 ikili şema birleştirme** — `v1.0-A15-schema-reconcile-docs`
- **Sonuç: DB'de DRIFT YOK — A15 bir runtime migration değil, dosya temizliği çıktı.**
- Salt-okunur probe (schema_migrations + PostgREST OpenAPI introspection, **sadece SELECT**) iki canlı tenant'a koşuldu:
  - **demo-hotel** ve **green-park-test**: `departments` (telegram_chat_id/reception_sla_minutes/holidays ✓), `department_staff` (department_key ✓, allergen flags ✓), `document_chunks`, `conversation_summary` (conversation_id-keyed ✓) — **hepsi 001-zinciri şekli**. `sql/05` şekli hiçbir canlıda YOK. İkisi de `migrations/tenant/001→017` (007 skip).
- **Aksiyon:** tek otorite = `migrations/tenant/*`. Eski `sql/0x` hotel-tarafı dosyalar (05,06,07,09,09b,10,11,12) DB'ye **dokunmadan** başlarına DEPRECATED/ARŞİV başlığı eklenerek arşivlendi (silinmedi). CLAUDE.md + SKILL.md + AUDIT D7 güncellendi. **Runtime migration GEREKMEDİ.**
- **Tek canlı fark (D7 dışı, TAKİP):** `match_documents()` RPC **demo-hotel'de var, green-park-test'te YOK** → RAG kullanılacaksa green-park'a pgvector fonksiyonunu eklemek gerekir. **Phase C / RAG takip maddesi** (şema sorunu değil, A15 kapsamı dışı).

---

## UX Backlog (sonraki faz — ŞİMDİ DOKUNMA)

- **Deneme sayısı 3→2:** `MAX_VERIFICATION_ATTEMPTS = 3` (`verification-intents.ts:34`). Kemal 2 istiyor. Master spec'te (HOTELGEN_MASTER_SPEC.md repo'da YOK) bir sayı belirtilmiyor → bu bir **config kararı**, reconcile edilecek spec yok.
- **Kayıt-dışı bildirim hızlandırma (UX-1/UX-2):** Bildirim 3 başarısız deneme + gecikme sonrası geç düşüyor. Aday: deneme sayısını düşür + gönderim anını hızlandır.
- **SLA eskalasyon FORM → rapor (D-REP):** Reception şu an eskalasyonda buton/mesaj alıyor; olması gereken **FORM** — reception ilgili departmanla iletişime geçer, gecikme açıklaması yazar, bu açıklama manager raporunda (detaylı) görünür. "Escalation reason form" → rapor bağlantısı D-REP'te tasarlanacak.

---

## Bilinen artıklar (bug DEĞİL)

- **18:37'lik "Oda: —" SLA mesajları:** A11 fix'inden ÖNCE oluşmuş eski kayıtlar. Kod artık doğru ("Oda: 102" düşüyor); eski mesajlar geçmiş veri, bug değil.
- Repo kökündeki `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` → throwaway diagnostic, commit edilmedi, referans/kaynak kod DEĞİL.

---

## Sonraki fazlar (sıra)

- **Phase B — Beyin re-mimarisi:** tek-beyin orchestrator → hibrit per-department model. Constitution dosyaları (`00-master.md` + `01-front-office`…`07-animation`), 4 mesaj tipi (SOHBET/BİLGİ/TALEP/BİLDİRİM), allergen path doğrulama (button-free, kitchen+GR).
- **Phase C — Bilgi havuzu / Perplexity:** Green Park çevre keşfi ön-doldurma, havaalanı/merkez km'leri `hotel_settings.location_info`'ya, "bilgi sistemde yok" fallback doğrulama. **+ RAG takip (A15'ten):** `match_documents()` RPC green-park-test'te YOK (demo'da var) — RAG/document_chunks semantik arama green-park'ta kullanılacaksa fonksiyon + (gerekiyorsa) `embedding` vektör tipini o tenant'a eklemek gerekir.
- **Phase D — Özellikler:** Reservation Links (~810 lokal satır commit), manager raporlama detayı + PDF/Excel (D-REP), Module 18 timezone drift (21:00 TR sonrası), pending-match testi, eksik tag'ler (`v1.0-module17b`, `v1.0-module17cd`), Telegram dept-group prerequisites (Kemal task).

---

## Güvenlik
- ⚠️ **green-park-test `service_role` key paylaşıldı (2026-06-01):** A15 canlı probe'u için green-park-test'in Supabase `service_role` key'i sohbete yapıştırıldı (probe salt-okunur, key çıktıya yazılmadı, geçici dosya silindi). Tam yetkili gizli anahtardır → **gerekirse Supabase dashboard'dan rotate et** (Project Settings → API Keys → service_role → rotate). Probe bitti, key'e artık ihtiyaç yok.

## Notlar
- **Validasyon gate:** `npm run type-check` + `npm run build` (lint A14'te runner'a bağlandı ama legacy baseline'da red — henüz hard gate değil).
- **SLA değerleri** test için düşük (1/5 dk) olabilir → go-live öncesi gerçek 30/60'a çek (D altında).
- **Summary threshold:** master mimari 50 msg der; canlı ~20 msg / 8000 token. Canlı değer korunuyor, Kemal teyit edecek.
