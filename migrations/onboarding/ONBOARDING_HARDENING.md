# ONBOARDING — DB HARDENING KITI

> **BU DOSYALAR TURETILMISTIR.** Icerikleri mevcut NUMARALI migration'larin
> (`migrations/tenant/029` · `030` · `031` · `032` ve `migrations/central/011`)
> konsolidasyonudur — **yeni bir karar, yeni bir tablo ya da yeni bir politika
> ICERMEZLER.**
>
> **NUMARALI SIRA INVARIANTI DEGISMEZ:** tenant en yuksek numara **032**,
> central en yuksek numara **011**. Bu klasordeki dosyalar migration DEGILDIR:
> `loadMigrations` yalniz `migrations/tenant`, `loadCentralMigrations` yalniz
> `migrations/central` okur -> **runner bu klasoru GORMEZ** ve
> `schema_migrations`'a hicbir kayit DUSMEZ. (029/030/031/032 ve central-011
> zaten dogrudan `exec_sql` / SQL Editor ile uygulandigi icin onlar da o tabloda
> KAYITLI DEGIL — bu YENI bir tutarsizlik degildir.)
>
> Kok gerekceler, canli olcumler ve reddedilen alternatifler **kaynak
> migration dosyalarinin basliklarindadir**; burada yalniz uygulama sirasi,
> idempotentlik ve dogrulama vardir.

---

## 1. Dosyalar ve urettikleri nesneler

| Dosya | Kaynak | Uretilen nesne / etki |
|---|---|---|
| `tenant_hardening.sql` | tenant 029+030+031+032 | tablo `processed_telegram_updates` (+`idx_ptu_seen_at`) · tablo `rate_limit_counters` (+`idx_rlc_window_start`) · fonksiyon `public.rate_limit_hit(text,text,integer)` · partial-unique index `uq_sla_events_open_request` (yalniz `sla_events` VARSA) · **hardening**: anon/authenticated/PUBLIC'ten tablo+sequence+fonksiyon REVOKE, `service_role`'e GRANT, `ALTER DEFAULT PRIVILEGES` (best-effort — **fonksiyonlarda ETKISIZ**, bkz. §3), her public base tabloda **RLS ENABLE** |
| `central_hardening.sql` | central 011 | **yalniz hardening** (yukaridaki grant/RLS deseni). Nesne URETMEZ — Central'da 029/030/031 karsiligi tablo yoktur |
| `verify_hardening.sql` | — | **SALT-OKUMA.** Tek SELECT -> `check_name · detail · status` (`PASS`/`FAIL`) |

**SIRA BAGLAYICIDIR** (`tenant_hardening.sql` icinde): once nesne uretimi
(BOLUM 1-3), sonra hardening (BOLUM 4). Ters sirada BOLUM 1-2'nin **yeni**
tablolari revoke+RLS kapsamina girmez (Supabase yeni nesneye anon/authenticated
grant'ini otomatik verir) — kapatmak istedigimiz delik acik kalir. Ayni gerekce
fonksiyonda da gecerlidir: `CREATE OR REPLACE` EXECUTE hakkini yeniden acar,
BOLUM 4 onu geri kapatir.

---

## 2. CHECKLIST — yeni tenant

**0. ON KOSUL (bu kit KAPSAMINDA DEGIL):** Supabase projesi acilmis, **`000_bootstrap.sql`**
   (yani `exec_sql` RPC'si) kurulmus ve baz sema (`001..028`) uygulanmis olmali.
   Kit baz semayi KURMAZ; `sla_events` henuz yoksa BOLUM 3 kendini atlar ve
   NOTICE birakir (asagidaki "Re-run" notu).

**1. Tenant DB'de `tenant_hardening.sql` calistir.**
   - Yol A — Supabase SQL Editor: dosyanin tamamini yapistir, calistir.
   - Yol B — `tsql` (`exec_sql` uzerinden): dosyayi **Node ile oku ve parametre
     olarak gecir**; SQL'i PowerShell argumani YAPMA (tirnak/here-string
     yutulmasi — CLAUDE.md §4).
   - **TEK ISLEMDIR:** bir bolum patlarsa hicbiri uygulanmaz (all-or-nothing).
     Hata mesajini oku, sebebi gider, **TEKRAR KOS**.

**2. Ayni DB'de `verify_hardening.sql` calistir -> TUM satirlar `PASS` olmali.**
   Bir satir `FAIL` ise ADIM 3'e **GECME**.

**3. Otelin bridge bilgilerini Central `bridge_credentials`'a kaydet**
   (admin panelinden; Supabase URL + service key + bot token AES-256-GCM ile
   sifrelenir).

**4. `central_hardening.sql`'i Central DB'de BIR KEZ calistir.**
   Central tek bir DB'dir — **otel basina tekrar GEREKMEZ**. Dogrulamak icin
   Central'da `verify_hardening.sql`'i kos ve **yalniz `grant_*` + `rls_*`**
   satirlarina bak: `tenant_obj_*` satirlari Central'da `FAIL` gorunur ve
   **BEKLENENDIR** (o nesneler tenant'a aittir).

---

## 3. Notlar

### Idempotent / guvenli re-run
Tum deyimler `IF NOT EXISTS` · `CREATE OR REPLACE` · `REVOKE`/`GRANT` ·
`ENABLE ROW LEVEL SECURITY` — tekrar kosulmasi zararsizdir.

**RE-RUN GEREKLI OLAN HAL:** bu kitten **SONRA** yeni tablo ya da fonksiyon
yaratan bir migration kosarsan (or. ileride `033`), `tenant_hardening.sql`'i
**TEKRAR KOS**. Iki sebep:
1. Yeni tablo RLS'siz dogar.
2. **Yeni fonksiyon anon-executable dogar.** `ALTER DEFAULT PRIVILEGES ... ON
   FUNCTIONS` bunu ENGELLEMEZ — 29. oturumda OLCULDU (asagidaki bolum). Tek
   guvence, hardening'in `REVOKE EXECUTE ON ALL FUNCTIONS` sweep'ini TEKRAR
   kosmaktir.

Ayni sekilde `sla_events` baz semayla sonradan gelirse BOLUM 3 ancak
**re-run'da** index'i kurar.

### Fonksiyon default-priv'i GUVENCE DEGIL — 29. oturumda OLCULDU

Iki hardening dosyasindaki `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON
FUNCTIONS ...` satiri **gelecek fonksiyonlari KORUMAZ.** Canli olcum (v5,
harness-bite, salt-okuma + gecici dummy):

- `defaclrole=postgres · sema=public · objtype=f` girdisi **zaten mevcuttu** ve
  icerigi `postgres=X | service_role=X` idi (PUBLIC/anon/authenticated YOK) —
  yani `032` o girdiyi kurmustu.
- **Buna RAGMEN** `exec_sql` (postgres-definer) yolundan yaratilan taze bir
  fonksiyon su ACL ile dogdu:
  `=X/postgres | postgres=X/postgres | service_role=X/postgres`.
  Bastaki bos alici **PUBLIC**'tir -> `has_function_privilege('anon', ...)` =
  **true**.
- `anon` hicbir role uye DEGIL (`pg_auth_members` bos) -> hakkin tek kaynagi
  bu PUBLIC girdisidir.
- Aday `ALTER DEFAULT PRIVILEGES **FOR ROLE postgres** ...` denendi:
  `pg_default_acl` **hic degismedi** (no-op) ve taze fonksiyon yine `anon=true`
  dogdu.
- Mekanizma **KANITLANMADI** (owner=postgres, `current_user`=postgres teyitli);
  sonuc mekanizmadan bagimsizdir.

**GUVENCE = ACIK REVOKE.** Dort katman:
1. **Sweep** — hardening'in `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
   FROM PUBLIC, anon, authenticated` satiri O ANDAKI tum fonksiyonlari kilitler.
2. **Re-run** — nesne ekleyen HER migration'dan sonra `tenant_hardening.sql`
   tekrar kosulur (ya da migration kendi REVOKE'unu tasir).
3. **Yakalama** — `verify_hardening.sql` -> `grant_anon_auth_functions` satiri
   anon-executable kalan fonksiyonu **FAIL** ile ve ADIYLA raporlar.
4. **Self-heal** — `exec_sql_json` ozelinde `tsql.js` ve `scripts/doctor.mjs`
   CREATE'in HEMEN ardindan REVOKE+GRANT uygular.

`ALTER DEFAULT PRIVILEGES` satirlari **zararsiz best-effort** olarak KALIR
(tablo/sequence tarafi ayrica OLCULMEDI) — ama **guvence sayilmaz**.

### RLS ENABLE engellenirse ne olur — iki dosya, iki desen
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` **yalniz tablo sahibince**
yapilabilir. Her dosya bu durumu KENDI kaynagindaki gibi ele alir:

- **`tenant_hardening.sql` — fail-loud (032 + CLAUDE.md §3-27d).** RLS
  dongusunden **once** `public` semada `tableowner <> 'postgres'` sayar, >0 ise
  `RAISE EXCEPTION` ile durur ve (tek islem oldugu icin) hicbir bolum uygulanmaz.
  Hata mesaji hangi tablolarin engel oldugunu ve sahiplerini yazar; cozum
  `ALTER TABLE public.<tablo> OWNER TO postgres` sonra **tekrar kos**.
- **`central_hardening.sql` — tablo-basina skip (011).** ALTER edilemeyen tek bir
  tablo, kalan tablolarin hardening'ini dusurmez; atlanan tablo `RAISE NOTICE`
  birakir.

**Her iki desende de dogrulama `verify_hardening.sql`'dedir:** atlanmis ya da
uygulanmamis bir tablo `rls_enabled_all_base_tables` satirinda `rowsecurity=false`
olarak **FAIL** doner — yani skip SESSIZ KALMAZ. Ayrica RLS **ikincil** katmandir;
birincil kilit anon/authenticated'ten cekilen **grant**'tir (`grant_*` satirlari).

### `031` partial-unique: uygulamadan ONCE acik-cakisma olc
Bos bir onboarding DB'sinde risk YOKTUR (satir yok). Ama kiti **canli** bir
tenant'ta kosuyorsan, CLAUDE.md §3-26d geregi once su sorguyu kos —
**BOS donmeli**:

```sql
SELECT conversation_id, department_code, md5(request_text) AS h, count(*)
  FROM sla_events
 WHERE responded_at IS NULL AND closed_at IS NULL
 GROUP BY 1, 2, 3
HAVING count(*) > 1;
```

Satir donerse **DUR** ve cakismayi incele. Olcmeden kosarsan `CREATE UNIQUE
INDEX` **patlar** ve (tek islem oldugu icin) hicbir bolum uygulanmaz — bu
ISTENEN davranistir, sessizce yarim uygulanmasindan iyidir.

### `verify_hardening.sql` yorumu
- `grant_anon_auth_tables` / `grant_anon_auth_functions`: `has_*_privilege`
  hakki **dogrudan + PUBLIC uzerinden + rol uyeligi uzerinden** toplam olcer;
  unutulmus bir `GRANT ... TO PUBLIC` de burada yakalanir.
- `grant_service_role_crud`: REVOKE'larin **app'i bozmadiginin** kaniti
  (CLAUDE.md §3-27e). `service_role` rolu hic yoksa da `FAIL` doner —
  sessiz yesil uretmez.
- `tenant_obj_rate_limit_hit_fn`: sayac tablosu tek basina yetmez; fonksiyon
  yoksa rate-limit **FAIL-OPEN** kosar (koruma sessizce YOK olur).
- Dosya **tek SELECT**'tir; `exec_sql_json` gibi sorguyu alt-sorguya saran bir
  arac kullaniyorsan sondaki `;` karakterini atmak gerekebilir.

### Bu kit neyi DEGISTIRMEZ
Runtime kod, Vercel bundle'i ya da uygulama davranisi. **DB-katman deploy
DEGILDIR** (CLAUDE.md §3-27f): grant/RLS canli DB'de yasar, `vercel --prod`
GEREKMEZ.

### Uyari — mevcut oteller
- Bu kit **YENI tenant kurulumu** icindir. Zaten canli bir otelde kosmadan once
  yukaridaki acik-cakisma olcumunu yap ve trafigi dusun (RLS ENABLE kisa sureli
  `ACCESS EXCLUSIVE` kilidi alir).
- **`regnum-hotels-belek` (Regnum) uzerinde KOSMA — DOKUNMA.** Bu bir isletme
  talimatidir; bu otel icin ayrica karar verilecek.
- Uygulanmis durum kaydi: **tenant `032` -> v5 + demo**, **central `011` ->
  Central PROD**. Diger tenant'lar hardening'i **HENUZ ALMADI** (CLAUDE.md §7-D).
