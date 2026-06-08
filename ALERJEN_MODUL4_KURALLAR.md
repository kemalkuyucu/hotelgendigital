# ALERJEN MODÜLÜ — MODÜL 4 KARAR KURALLARI

> Bu dosya Modül 4 (alerji bildirim yönlendirme) için **tek doğru referanstır**.
> Antigravity bu kuralları tahmin etmeden, birebir uygular.
> Önceki modüller: M1 = `guest_allergens` tablosu, M2 = personel bayrakları (`is_allergen_primary`, `is_allergen_backup`, `is_manager`), M3 = bot alerji sorusu + kayıt (çalışıyor).

---

## 1. TEMEL PRENSİP (DEĞİŞTİRİLEMEZ)

- Bot ASLA tıbbi/güvenlik onayı vermez ("bunu yiyebilirsiniz / güvenli" YASAK). Sadece toplar, kaydeder, **insanlara bildirir**. Karar insanda.
- Hayati bilgi olduğu için bildirim **çok katmanlı** gider, kimse kaçırmasın.
- "Cevap yok" ASLA "alerji yok" diye kaydedilmez.

---

## 2. TETİKLEYİCİ

Misafir F&B (yemek/restoran/menü/oda servisi) konusu açtı + bu konaklamada ilk kez → bot alerji sorar (M3 zaten yapıyor).

Cevap 3 durum:
- **"yok / hayır"** → `guest_allergens.status = 'none'`, BİLDİRİM YOK, normal F&B cevabına devam et (yemek saati vb. sorduysa cevapla).
- **cevapsız / alakasız** → `status = 'asked_no_response'`, BİLDİRİM YOK, alerjen kategorisine DAHİL ETME.
- **"var, X'e alerjim var"** → `status = 'reported'`, `allergen_text = misafirin yazdığı metin` → **KRİTİK AKIŞ (bölüm 3)**.

---

## 3. KRİTİK AKIŞ — alerji bildirildi, oda durumuna göre dallan

Bot oda no + isim soyisim sorar. Gelen cevaba göre 3 durum:

### A) Misafir OTELDE — in-house'ta eşleşti (oda no + isim doğru)
`guest_allergens`: status=reported, room_number + guest_full_name + check_in/check_out doldur.

**Bildirim alıcıları:**
| Alıcı | Ne zaman | Kaynak |
|---|---|---|
| Mutfak alerjen sorumlusu (`is_allergen_primary`) | HER ZAMAN (mesai fark etmez) | department_staff, department_key='fb' |
| Tüm yedek/amirler (`is_allergen_backup`) | HER ZAMAN (hepsine aynı anda) | department_staff, department_key='fb' |
| GR sorumlusu | HER ZAMAN | department_staff, department_key='guest_relation' |
| GR müdürü (`is_manager`) | HER ZAMAN | department_staff, department_key='guest_relation', is_manager=true |
| Resepsiyon + Ön Büro Müdürü | SADECE mesai dışıysa (00:00–08:00) → "GR'ye not bırakın" uyarısı | department_key='front_office' (+ is_manager) |

**Bildirim metni (mutfak):** "⚠️ ALERJEN — Oda {oda}, {isim}: {alerjen_text}. Konuya dikkat."
**Bildirim metni (GR):** "⚠️ ALERJEN — Oda {oda}, {isim}: {alerjen_text}. Lütfen kontrol edin."
**Mesai dışı ek (resepsiyon/ön büro müdürü):** "⚠️ ALERJEN — Oda {oda}, {isim}: {alerjen_text}. GR mesai dışı, lütfen GR'ye not bırakın."

> NOT: Yedek/amirlere SIRALI değil, AYNI ANDA gider (basit tutuldu). Sıralı escalation ileride ayrı modül.

### B) Oda YOK ama otele gelecek (yolda / yakında check-in)
- Bot isim-soyisim alır.
- `guest_allergens`: status=reported, room_number=NULL, "oda bekliyor" durumu (is_active=true, room boş).
- **Sadece GR'ye bildirim:** "ℹ️ {isim} henüz oda almamış, şu alerjisi var: {alerjen_text}. Oda alınca ilgilenin."
- Mutfağa GİTMEZ (henüz yemek verilmiyor).
- Bot misafire: "Otele giriş yaptığınızda misafir ilişkilerine mutlaka bildirin."

**Oda alındıktan sonra (GR paneli):** GR kendi panelinden oda no + isim + giriş/çıkış girip kaydedince → o an mutfak alerjen sorumlusuna otomatik bildirim gider (A akışındaki mutfak bildirimi tetiklenir). *(Bu kısım Modül 4'te ele alınacak; GR panel UI'si gerekebilir.)*

### C) Misafir DIŞARIDAN (konaklama belirsiz / ileri tarih / yolda değil)
- Bot nazik uyarı:
  - İleri tarihli rezervasyon ima ediyorsa: "Konaklamak için geldiğinizde, alerji durumunuzu misafir ilişkilerine bildirin lütfen."
  - Belirsizse: "Otelimizde konaklayacaksanız, yemek alerjiniz varsa giriş yaptığınızda bildirin."
- `guest_allergens`: yine kaydedilir (gelecekte gelirse diye).
- HİÇBİR personele bildirim GİTMEZ.

---

## 4. OTELDE Mİ DEĞİL Mİ? — sistem nasıl anlar

Bot oda no + isim soyisim + (gerekirse) giriş/çıkış tarihi sorar.
- Verilen bilgi in-house'ta eşleşiyor + bugün tarih aralığında → **A (otelde)**.
- İsim var ama oda yok / gelecek tarih → **B (gelecek)**.
- Misafir "otelde değilim / daha gelmedim / bakıyorum" gibi → **C (dışarıdan)**.

Yani ayrım, misafirin oda/tarih cevabına ve in-house eşleşmesine göre yapılır.

---

## 5. MESAİ SAATİ

- Varsayılan GR mesai: **08:00–00:00** (yani 00:00–08:00 mesai dışı). TR saati (Europe/Istanbul) ile hesapla.
- Opsiyonel: ileride otel bazında değiştirilebilir (şimdilik sabit 08:00–00:00 yeterli).
- DİKKAT: Mesai dışı olsa bile GR sorumlusu + GR müdürü yine bildirim alır. Mesai dışı, SADECE resepsiyon + ön büro müdürüne EK uyarı ekler.

---

## 6. PANEL (Modül 2'de hazır, personel girilecek)

- FB alerjen sorumlusu/yedek + GR + ön büro müdürü ID'leri `department_staff.telegram_user_id`'de.
- Bayraklar: `is_allergen_primary`, `is_allergen_backup`, `is_manager`.
- Telegram ID'si olmayan işaretli personel için bildirim gönderilemez → log/uyarı.

---

## 7. KAPSAM DIŞI (Modül 4'e KARIŞTIRMA)

- Off-topic koruması (şarkı/şiir/iddaa/uygunsuz içerik) → Modül 16.b safety router'da, AYRI iş.
- Sıralı şef escalation → ileride ayrı modül.
- Resepsiyona "hemen/biraz sonra" SLA butonu kaldırma → ayrı küçük iş.
