# DEVİR NOTU — HotelGen v2

> Son güncelleme: 2026-06-02 (**B2.4/B3 ✅ alerji yaşamsal zinciri UÇTAN UCA KAPANDI + prod-doğrulandı, tag `v1.0-B3-allergy-chain`** · B2.1/B2.2/B2.3 tag'li · verify reset bug fix) · Branch: `hotelgen-v2` · Resume noktası: `.claude/skills/hotelgen-orchestrator/MODULE_MANIFEST.md`
> ▶ **SIRADAKİ GÖREV:** B1.1 — constitution dosyaları (`00-master` + 7 dept, saf içerik, wire yok). Track 2 (beyin re-mimarisi) başlıyor. Detay: aşağıda "AÇIK İŞLER".
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

## PHASE B — 🚧 BAŞLADI · B2.1+B2.2 ✅ tag'li · B2.3 🔶 KOD İNDİ (dc37477, TAG BEKLİYOR)

Tek-beyin orchestrator → 4 mesaj tipli + departman-constitution'lı hibrit model.

### Onaylanan bağımlılık zinciri
**B2.1 ✅ → B2.2 ✅ → B2.3 🔶 (kod indi, tag AÇIK #1+#2 sonrası) → (B2.4/B3) → B1.1 → B1.2 → B1.3 → B4**

| Track | Adımlar | Risk | Guest-facing? |
|---|---|---|---|
| **Track 1 (ÖNCE)** B2 — allergen bug + buton/SLA sözleşmesi | **B2.1 ✅** taksonomi modülü (saf) · **B2.2 ✅** router'a `messageType`+flag (davranış-nötr) · **B2.3 🔶** flag'leri forward yoluna bağla (kod indi `dc37477`, tag bekliyor) · **B2.4** allergen BİLDİRİM doğrula | Düşük | B2.1/B2.2 ❌ · B2.3/B2.4 ✅ bot testi |
| **Track 2 (SONRA)** B1 — beyin re-mimarisi | **B1.1** constitution dosyaları (`00-master` + 7 dept) · **B1.2** lazy-load loader (no-op, flag arkasında) · **B1.3** orchestrator swap | B1.3 **YÜKSEK** | B1.1/B1.2 ❌ · B1.3 ✅ **GENİŞ** bot testi |
| **Track 3 (EN SON, gate)** | **B4** persistent-verify + forward regresyonu | Gate | ✅ bot testi |

### ONAYLANAN Intent → Mesaj-tipi haritası (B2.1'de KODLANDI → `message-types.ts`)
- **SOHBET** (`CHAT_INTENTS`): greeting, acknowledgment, chitchat, farewell, affirmation, negation
- **BİLGİ** (`INFO_INTENTS`): knowledge_query
- **TALEP** (`REQUEST_INTENTS`): technical, housekeeping, fb, spa, animation, room_service, billing, lost_and_found, complaint
- **BİLDİRİM** (`NOTIFICATION_INTENTS`): allergy, late_checkout (+ misafirin aksiyon beklemediği bildirimler)
- **Tanınmayan/boş intent → TALEP** (davranış-nötr fallback; mevcut router da bilinmeyeni forward'lar).
- **Çoklu-intent:** her `intents[]` öğesi kendi tipini taşır (MODUL_11.2). B2.2'de tüketilecek.

### Tip → davranış sözleşmesi (B2.1'de `messageTypeTraits()` olarak kodlandı)
- SOHBET / BİLGİ → `forwards:false` (forward YOK).
- **TALEP → `forwards:true, withButtons:true, createsSlaEvent:true`** (forward + 2 buton + `sla_events`).
- **BİLDİRİM → `forwards:true, withButtons:false, createsSlaEvent:false`** (forward + buton YOK + sla YOK). Allergen'in zaten yaptığı; B2 bunu first-class sınıf yapar — eski bug'ın kök nedeni BİLDİRİM'in router dışında özel-kılıf olmasıydı.

### B2.1 — ✅ (commit `ae32b48`, tag `v1.0-B2.1-message-types`)
- Tek yeni **saf** dosya `src/lib/ai/message-types.ts`: `MessageType` · `MESSAGE_TYPE_TRAITS` · `CHAT/INFO/REQUEST/NOTIFICATION_INTENTS` · `INTENT_MESSAGE_TYPE` (frozen) · `getMessageType()` · `messageTypeTraits()`. Davranış-nötr (kimse import etmiyordu). `allergy`+`late_checkout` → BİLDİRİM.

### B2.2 — ✅ NE YAPILDI (commit bu turda, tag `v1.0-B2.2-router-consumes-map`)
- **TEK dosya** `src/lib/ai/classify-and-respond.ts` (+47/−13). message-types.ts artık TÜKETİLİYOR.
- `RoutingDecision` + `ClassifiedIntentItem` interface'lerine `messageType` / `withButtons` / `createsSlaEvent` eklendi.
- `routeIntentToDepartment`: başta `getMessageType`+`messageTypeTraits` ile `typeSignature` hesaplanır, her 5 dönüşe `...typeSignature` spread edilir. **Departman + `shouldForward` branch'leri AYNEN** (additive — forward kararı hâlâ branch'lerden gelir, traits'ten DEĞİL).
- `classifiedIntents.map`: her intent kendi `messageType`/flag'lerini taşır → çoklu-intent'te TALEP ve BİLDİRİM ayrışır.
- `NON_FORWARDING_INTENTS`: elle-tutulan 7'li kopya → `new Set([...CHAT_INTENTS, ...INFO_INTENTS])` (aynı 7 üye; export simgesi korundu; çoğullama gitti). route.ts'te bu simgeyi import eden YOK (doğrulandı).
- **route.ts DOKUNULMADI.** Allergy hâlâ `rawDepartment==='allergy'` ile dallanır; yeni flag'ler taşınır ama **B2.3'e dek OKUNMAZ** → davranış-nötr.
- **Davranış-nötr DOĞRULANDI** (single + multi-intent çıktısı bugünküyle birebir). type-check + build YEŞİL. Bot testi yok (canlı yol değişmedi).

### B2.3 — ✅ TAG'Lİ (`v1.0-B2.3-forward-flags`, commit `9785bd0`) — PROD REAL-BOT VERIFIED 2026-06-02
- **Ne yapıldı (B2.3 kod, `dc37477`):** B2.2'de taşınan `withButtons` / `createsSlaEvent` flag'leri route.ts forward döngüsünde TÜKETİLİYOR — forward yolu artık string alerji-string-check değil, **per-intent flag**'lere göre dallanıyor → yalnız **TALEP** = 2 buton + `sla_events`; **BİLDİRİM** = butonsuz + sla yok (allergy bunun bir örneği, hardcode değil).
- **Alerji-forward bug FIX (`9785bd0`):** BİLDİRİM dalı (route.ts:~2479) ölü hardcode chat id `-5015613103`'e gönderiyordu — bu chat DB'de YOK → `tg.sendMessage` patlıyor, hata loop'un `catch (fwdErr)`'inde sessizce yutuluyor → alerji bildirimi **hiçbir gruba düşmüyor** (misafir yine iyi cevap alıyordu, semptom buydu). Çözülmüş `fwdItem.chatId` (-5225595171) yok sayılıyordu. **Fix:** hardcode sabit kaldırıldı, `chat_id: targetChatId` (= çözülmüş `fwdItem.chatId`, allergy→front_office) kullanılıyor. Butonsuz + sla_events YOK korundu; TALEP/SLA dalı + routing/classify DOKUNULMADI (davranış-nötr, yalnız hedef düzeltildi). **NOT:** önceki teşhis hipotezi ("front_office resolve olmuyor → düşüyor") canlı DB ile ÇÜRÜTÜLDÜ — front_office enabled + chat dolu; gerçek kök neden ölü hardcode id'ydi.
- **Durum:** type-check YEŞİL, push edildi (`9785bd0`). **PROD REAL-BOT VERIFIED ✅ 2026-06-02** — `mantar alerjim var` → Front Office grubuna (`-5225595171`) butonsuz `ℹ️ Misafir Bildirimi (Alerji)` mesajı düştü, SLA kartı/buton yok. Tag `v1.0-B2.3-forward-flags` atıldı.

### B2.4 / B3 — ✅ TAG'Lİ (`v1.0-B3-allergy-chain`) — ALERJİ YAŞAMSAL ZİNCİRİ UÇTAN UCA KAPANDI, PROD REAL-BOT VERIFIED 2026-06-02
- **Sonuç:** "verify-first" beklenenden çok daha derin çıktı; B2.3 sonrası ardışık salt-okunur teşhislerle bir kök-neden ZİNCİRİ bulundu ve **7 fix** ile kapatıldı. Alerji bildirimi artık mutfak+GR'ye GERÇEKTEN ulaşıyor (önceden sessizce yutuluyordu — yaşamsal güvenlik açığı).
- **Kapanan akış (uçtan uca):** `"102 Özgür Özen"` (oda+isim tek mesaj) → **17.c-R+N** `inhouse_guests_v2.telegram_id` damgalar → **Part-C** odayı çözer (`persistentVerifiedGuest.room_number=102`) → `"fıstık alerjim var"` → **safety `health_medical` short-circuit'ini alerji keyword AŞAR** → allergy intent (keyword safety net garantisi) → BİLDİRİM dalı → `sendAllergenNotifications` → **Senaryo A** (oda eşleşti).
- **DOĞRULAMA (2026-06-02 17:10):** `allergen_notification_log` **4 satır `status=sent`, scenario A** — GR Mudur, GR Sorumlu, fb_backup (Ali Yılmaz), fb_primary (Özgür ÖZEN). `department_staff` tam seed (fb primary+backup, GR sorumlu+müdür, hepsi tgId SET).
- **7 commit (hepsi type-check yeşil + prod bot-doğrulandı):**
  1. `9785bd0` — B2.3 alerji bildirimi → çözülmüş dept chat (ölü hardcode `-5015613103` kaldırıldı).
  2. `5ca6683` — direkt `intent=allergy` → `sendAllergenNotifications` (M4 spec fan-out: mutfak primary/backup + GR + GR müdürü DM; tek front_office grup mesajı kaldırıldı).
  3. `835d476` — deterministik alerji keyword override (`alerj`/`allerg`/`intoleran`, `normalizeTr`): LLM allergy etiketlemezse keyword zorlar → alerji tek başına LLM'e bağımlı değil.
  4. `b616940` — kalıcı-doğrulanmış misafirin salt-doğrulama re-send'i (örn. "102 Özgür Özen") forward etmez, "zaten doğrulandı" cevabı döner (sahte talep + SLA önlendi).
  5. `41eca32` — boş `request_text` artık bot cevabını (reply_text) request_text'e KOPYALAMAZ; boşsa forward edilmez, SLA üretilmez (selamlama sahte "Misafir Talebi" + SLA breach'i önlendi).
  6. `a84de80` — **EN KRİTİK:** alerji keyword'ü `health_medical` safety pre-classifier short-circuit'ini AŞAR → alerji bildirimi genel tıbbi sohbet diye yutulmaz, allergen pipeline'a düşer. (Diğer safety kategorileri + alerji-kelimesiz tıbbi mesajlar AYNEN korunur.)
  7. `a7bd45f` — **FIX-2:** Modül 17.c "oda + ad soyad" tek mesajı (örn. "102 Özgür Özen") yakalar (pure-digit gate kaçırıyordu) → `parseVerificationInput` + `normalizeTr` ile v2 eşleşmesinde telegram_id damgalar → Part-C bağlayabilir → alerji Senaryo A'ya ulaşır.
- **Açık takip (yaşamsal değil, ayrı iş):** DOĞRULANMAMIŞ misafir (telegram_id bağlı değil) direkt alerji bildirirse → room null → Senaryo C → kimse bilgilendirilmez AMA bot yine "Afiyet olsun" der (yanıltıcı). M4 spec'e göre oda bilinmiyorsa oda+isim SORULMALI (M3 ask-flow'da var, direkt-intent BİLDİRİM dalında YOK). Ayrı küçük iş — yaşamsal zincir (doğrulanmış akış) kapandı.

### Mevcut durum (kod gerçeği — B2.2 sonrası)
- Beyin: **tek monolit** `system-prompts.ts::buildOrchestratorSystemPrompt` (~430 satır). Constitution/lazy-load YOK (Track 2).
- Sınıflama: `classify-and-respond.ts` (strict-JSON: reply_text/intents[]/confidence/answered_from_knowledge) + safety pre-classifier (Haiku). **Artık `message-types.ts`'i tüketir → her intent `messageType`+flag taşır.**
- Routing: `routeIntentToDepartment` — NON_FORWARDING(=CHAT∪INFO) / OPERATIONAL / PERSONAL / complaint / fallback + **mesaj-tipi imzası**. Flag'ler taşınıyor ama forward yolunda HENÜZ okunmuyor (B2.3).
- TALEP: `forward-to-department` + `send-forward-with-buttons` + sla_events. BİLDİRİM: route.ts içinde `rawDepartment==='allergy'` özel-kılıf (button-free), `allergen-notify.ts`. **B2.3 bu özel-kılıfı flag-tabanlı yapacak.**

---

## VERIFY ZİNCİRİ — ✅ DOĞRULAMA RESET BUG FIX (2026-06-02, bot-doğrulandı)

**Belirti:** Misafir doğrulanıyor, sonraki mesajda ("havlu lazım") bot oda no'yu TEKRAR soruyordu; ayrıca salt-doğrulama mesajı ("102 Özgür Özen") sahte "Misafir Talebi" (`Talep: "kimlik doğrulama"` + butonlar) olarak departmana forward ediliyordu.

**3 parçalı düzeltme (4 commit), branch `hotelgen-v2` — hepsi type-check + build YEŞİL, tag YOK:**
- **Part A** `02a778f` — `fix(verify): non-destructive re-check, only wipe on positive checkout evidence`. Persistent-verify else dalı doğrulamayı YALNIZCA pozitif checkout kanıtı (satır VAR ama check_out<bugün / status pasif) varken siler; "id ile satır bulunamadı" ambigü-miss → wipe YOK, görünür log + 24h TTL koruması devrede. `getTurkeyToday()` tek tarih kaynağı.
- **skipForward guard** `c104807` — `fix(verify): guard skipForward so verification-only turn does not forward as fake request`. Taze doğrulama + gerçek talep YOK → `skipForward=true`, ForwardableItem üretilmez (misafir yine doğrulama-başarı cevabını alır). Talep VARSA (pending/embedded) ya da zaten-doğrulanmış passthrough → forward devam.
- **Part B+C** `b50f3ed` + `68cbeb5` — durable `telegram_id` bağlama. **B:** doğrulama başarısında v2 eşleşmesi `inhouse_guests_v2.telegram_id = chat_id` damgalanır (legacy DEĞİŞMEZ). **C:** persistent re-check artık `verified_inhouse_guest_id` null-check'inden BAĞIMSIZ — önce `telegram_id` ile çözer, `persistentVerifiedGuest`'i DOĞRUDAN set eder, kayıp/drift id'yi self-heal eder. telegram_id yoksa eski id-tabanlı zincir (v2-by-id → legacy → Part A) BİREBİR fallback.

**Bot testi (2026-06-02) ✅:** misafir doğrulandı → "havlu lazım" → oda TEKRAR SORULMADI → talep Demo_HK'ya doğru düştü. Veri doğrulaması (Part B): room 102 satırında `telegram_id=758605940` damgalandı.

---

## AÇIK İŞLER (öncelik sırası)

1. **✅ ÇÖZÜLDÜ — ALERJİ YAŞAMSAL ZİNCİRİ (tag `v1.0-B3-allergy-chain`, 7 fix, prod-verified 2026-06-02 17:10).** Uçtan uca kapandı: oda+isim bağlar → Part-C oda çözer → safety aşılır → Senaryo A mutfak+GR DM (4 satır `sent`). Detay: B2.4/B3 bölümü.
2. **✅ ÇÖZÜLDÜ — Post-verify/selamlama sahte forward + buton sorunu.** `41eca32` (boş request_text forward etmez) + `b616940` (salt-doğrulama re-send guard) ile kapandı — selamlama/doğrulama turu artık SLA'lı sahte talep üretmiyor.
3. **🟠 DOĞRULANMAMIŞ direkt-alerji → Senaryo C (yaşamsal değil ama spec açığı, sıradaki aday).** telegram_id bağlı olmayan misafir direkt "fıstık alerjim var" derse room null → Senaryo C → kimse bilgilendirilmez, bot yine "Afiyet olsun" der (yanıltıcı). M4: oda bilinmiyorsa oda+isim SORULMALI (M3 ask-flow'da var, direkt-intent BİLDİRİM dalında YOK). Ayrı küçük iş.
4. **🗣️ AI cevap tonu çok robotik (B1 fazı).** Yanıtlar fazla mekanik → ton yumuşatma. B1 (constitution/prompt) fazında ele alınacak, şimdi değil.

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
