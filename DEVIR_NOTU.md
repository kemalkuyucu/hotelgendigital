# DEVİR NOTU — HotelGen v2

> Son güncelleme: 2026-06-01 · Branch: `hotelgen-v2` · Resume noktası: `.claude/skills/hotelgen-orchestrator/MODULE_MANIFEST.md`
> Bu not = oturumlar arası tam devir. Detay her zaman MODULE_MANIFEST.md + AUDIT.md + ALERJEN_MODUL4_KURALLAR.md'de.

---

## PHASE A — ✅ %100 BİTTİ (15/15)

A1–A15'in tamamı tag'li ve (uygulanabilir olanlar) prod-doğrulanmış. **Phase A kapandı.**

| ID | Konu (AUDIT) | Tag |
|----|--------------|-----|
| A1 | S2 — JWT secret fail-fast, hardcoded fallback kaldırıldı | `v1.0-A1-jwt-failfast` |
| A2 | S3+S6 — `super_admin` guard + bcrypt cost 12 | `v1.0-A2-superadmin-guard` |
| A3 | S4+S8 — ManyChat fail-closed + `timingSafeEqual` | `v1.0-A3-webhook-auth` |
| A4 | D1 — `forwarded_messages` insert şemaya hizalandı + try/catch | `v1.0-A4-A5-unregistered-guest-forward` (`e27d89d`) |
| A5 | D2 — `departments.name`→`display_name` (kayıt-dışı notify çalışıyor) | `v1.0-A4-A5-unregistered-guest-forward` (`e27d89d`) |
| A6 | D3 — `audit_log`→`hotel_audit_log` (archive cron) | `v1.0-A6-audit-table-fix` |
| A7 | H1 — webhook dış try/catch → her durumda 200 | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A8 | H3 — `verification_attempts` insert `await` + error check | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A9 | H4 — in-house link update'lerine error-check (sonsuz "oda no sor" döngüsü önlendi) | `v1.0-A7-A8-A9-webhook-resilience` (`7e685b5`) |
| A10 | H2 + #1 — per-hotel token + atomik claim ile çift-eskalasyon önleme | `v1.0-A10-sla-atomic-claim` (`f33c6b9`) |
| A11 | D5 — v2 id ile `inhouse_guests_v2` sorgusu ("Oda: —" kök neden) | `v1.0-A11-d5-room-fix` (`e27d89d`) |
| A12 | D4 — archive cron `inhouse_guests_v2` genişletildi | `v1.0-A12-archive-v2-extend` (`7e9fca4`) |
| A13 | D6 — SLA callback fantom `conversations.language` + `.maybeSingle()` | `v1.0-A13-callback-language-fix` |
| A14 | L1 — `lint` script ESLint CLI'ye yönlendirildi | `v1.0-A14-lint-eslint-cli` |
| A15 | D7 — şema ikiliği: **canlı probe → DRIFT YOK**; `sql/0x` arşivlendi, tek otorite `migrations/tenant/*` | `v1.0-A15-schema-reconcile-docs` (`5ad5256`) |

**Prod-verify özetleri:**
- A7/A8/A9: real-bot 2026-05-31 (3 senaryo: 9999 no-match bildirimi, 102 doğrulama + döngü yok, yanlış soyad attempt-log + limit→resepsiyon).
- A10: real-bot 2026-06-01 — doğrulanmış misafir (102) talep, butona basılmadı, SLA aşımında Demo_OnBuro'ya eskalasyon **TAM 1 KEZ** (önceden 2), "Oda: 102" dolu.
- A11: real-bot 2026-05-31 — 19:11 talebinde Demo_HK'da "Oda: 102".
- A15: salt-okunur probe (schema_migrations + OpenAPI introspection) **demo-hotel + green-park-test** → `departments`/`department_staff`/`document_chunks`/`conversation_summary` hepsi 001-zinciri şekli; `sql/05` şekli hiçbir canlıda yok. Runtime migration GEREKMEDİ.

---

## PHASE B — 🚧 BAŞLIYORUZ (plan ONAYLI, kod henüz YOK)

Tek-beyin orchestrator → 4 mesaj tipli + departman-constitution'lı hibrit model.

### Onaylanan bağımlılık zinciri
**B2.1 → B2.2 → B2.3 → (B2.4/B3) → B1.1 → B1.2 → B1.3 → B4**

| Track | Adımlar | Risk | Guest-facing? |
|---|---|---|---|
| **Track 1 (ÖNCE)** B2 — allergen bug + buton/SLA sözleşmesi | **B2.1** taksonomi modülü (saf) · **B2.2** router'a `messageType`+flag (davranış-nötr) · **B2.3** flag'leri forward yoluna bağla · **B2.4** allergen BİLDİRİM doğrula | Düşük | B2.1/B2.2 ❌ · B2.3/B2.4 ✅ bot testi |
| **Track 2 (SONRA)** B1 — beyin re-mimarisi | **B1.1** constitution dosyaları (`00-master` + 7 dept) · **B1.2** lazy-load loader (no-op, flag arkasında) · **B1.3** orchestrator swap | B1.3 **YÜKSEK** | B1.1/B1.2 ❌ · B1.3 ✅ **GENİŞ** bot testi |
| **Track 3 (EN SON, gate)** | **B4** persistent-verify + forward regresyonu | Gate | ✅ bot testi |

### ONAYLANAN Intent → Mesaj-tipi haritası (spec'te yoktu, eklendi)
- **SOHBET:** greeting, acknowledgment, chitchat, farewell, affirmation, negation
- **BİLGİ:** knowledge_query
- **TALEP:** technical, housekeeping, fb, spa, animation, room_service, billing, lost_and_found, complaint
- **BİLDİRİM:** allergy + misafirin aksiyon beklemediği bildirimler (örn. "yarın geç çıkış")
- **Çoklu-intent:** bir mesaj aynı anda TALEP+BİLDİRİM taşıyabilir; her `intents[]` öğesi kendi tipini taşır (MODUL_11.2 mantığı).

### Tip → davranış sözleşmesi (B2'nin kuracağı)
- SOHBET / BİLGİ → forward YOK.
- **TALEP → forward + 2 buton + `sla_events`.**
- **BİLDİRİM → forward + buton YOK + `sla_events` YOK.** (Allergen'in zaten yaptığı; B2 bunu first-class sınıf yapar — eski bug'ın kök nedeni BİLDİRİM'in router dışında özel-kılıf olmasıydı.)

### Mevcut durum (Phase B öncesi kod gerçeği)
- Beyin: **tek monolit** `system-prompts.ts::buildOrchestratorSystemPrompt` (~430 satır). Constitution/lazy-load YOK.
- Sınıflama: `classify-and-respond.ts` (strict-JSON: reply_text/intents[]/confidence/answered_from_knowledge) + safety pre-classifier (Haiku).
- Routing: `routeIntentToDepartment` — NON_FORWARDING / OPERATIONAL / PERSONAL / complaint / fallback. **`notification` dalı YOK.**
- TALEP: `forward-to-department` + `send-forward-with-buttons` + sla_events. BİLDİRİM: yalnız `allergen-notify.ts` (router'ı baypas, button-free, Senaryo A/B/C).

### ▶ SIRADAKİ İLK ADIM: B2.1 (OKU+GÖSTER yapıldı, yazım onayı bekliyor)
- **Ne:** tek yeni saf dosya `src/lib/ai/message-types.ts` — `MessageType` tipi + `INTENT_MESSAGE_TYPE` haritası + `NOTIFICATION_INTENTS` + `getMessageType()` + `messageTypeTraits()`. Davranış-nötr (kimse import etmez), bot testi YOK, sadece type-check+build.
- **Kritik:** `allergy` resmî olarak **BİLDİRİM** olur. Mevcut `OPERATIONAL/PERSONAL/...` set'leri B2.1'de silinmez; B2.2'de router bu haritayı tüketir, çoğullama o adımda biter (drift 1 adım sürer).
- Onay gelince yazılacak.

---

## AÇIK TAKİP (Phase B dışı, unutma)
- **match_documents RPC green-park-test'te YOK** (demo-hotel'de var) → RAG/document_chunks semantik arama green-park'ta kullanılacaksa fonksiyon + (gerekiyorsa) `embedding` vektör tipi eklenecek. **Phase C / RAG.**
- **SLA değerleri** test için düşük (1/5 dk) olabilir → go-live öncesi gerçek 30/60'a çek (Phase D).
- **Summary threshold:** master mimari 50 msg der; canlı ~20 msg / 8000 token. Canlı değer korunuyor, Kemal teyit edecek.

## UX BACKLOG (sonraki faz — ŞİMDİ DOKUNMA)
- **Deneme sayısı 3→2:** `MAX_VERIFICATION_ATTEMPTS = 3` (`verification-intents.ts:34`). Kemal 2 istiyor. Spec'te sayı yok → config kararı.
- **Kayıt-dışı bildirim hızlandırma (UX-1/UX-2):** bildirim 3 başarısız deneme + gecikme sonrası geç düşüyor → deneme sayısını düşür + gönderim anını hızlandır.
- **SLA eskalasyon FORM → rapor (D-REP):** reception eskalasyonda şu an buton/mesaj alıyor; olması gereken FORM — gecikme açıklaması yazılır, manager raporunda (detaylı) görünür.

## GÜVENLİK
- ⚠️ **green-park-test `service_role` key paylaşıldı (2026-06-01):** A15 canlı probe'u için sohbete yapıştırıldı (probe salt-okunur, key çıktıya yazılmadı, geçici dosya silindi). Tam yetkili gizli anahtar → **gerekirse Supabase dashboard'dan rotate et** (Project Settings → API Keys → service_role). Probe bitti, key'e ihtiyaç yok.

## BİLİNEN ARTIKLAR (bug DEĞİL)
- Repo kökündeki `__*.js/.mjs`, `scratch_*.mjs`, `__run_*.ps1`, `__test_scenario_*.json` → throwaway diagnostic, commit edilmedi, kaynak/referans kod DEĞİL.
- A11 öncesi oluşmuş "Oda: —" eski SLA mesajları → geçmiş veri, kod artık doğru.

## NOTLAR
- **Validasyon gate:** `npm run type-check` + `npm run build`. (lint A14'te runner'a bağlandı ama legacy baseline'da red — henüz hard gate değil; otomatik test yok.)
- **Tenant şema otoritesi:** `migrations/tenant/*` (eski `sql/0x` DEPRECATED/arşiv). Kolon kullanmadan önce migration'a bak.
- **Spec dosyası:** `HOTELGEN_MASTER_SPEC.md` repo'da YOK — hedef mimari MODULE_MANIFEST Phase B + ALERJEN_MODUL4 + onaylı kararlardan türetiliyor.
