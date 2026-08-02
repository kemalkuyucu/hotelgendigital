/**
 * IS 8 — misafir adi eslesmesi (backlog #13) korpusu.
 *
 * GERCEK modulu import eder (kopya fonksiyon YASAK); ag/LLM/DB YOK (saf karar).
 * Kilitlenen davranis: ad + soyad TAM KELIME eslesir, orta isimler IKI TARAFTA da
 * yok sayilir; ham metinde en az 2 kelime tabani vardir.
 *
 * (5) NEGATIF KONTROL: eski SUBSTRING davranisi ELLE yazilmis oracle'larla
 * yeniden uretilir ve "eski TRUE / yeni FALSE" cifti assert edilir. Oracle'lar
 * test edilen modulden HICBIR SEY import ETMEZ (oz-dogrulama tuzagi). Yalniz
 * normalizeTr paylasilir — cunku eski site-1 kodu da birebir onu cagiriyordu;
 * elle yazilan kisim SUBSTRING KARARIDIR, olculen sey de odur.
 */
import {
  matchesGuestName,
  matchesGuestNameFromText,
  sameGuestByText,
  sameLastName,
} from '@/lib/verification/match-guest-name';
import { normalizeTr } from '@/lib/utils/normalize-tr';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// ── (1) matchesGuestName — POZITIF (gercek misafir kilitlenmemeli) ─────────
check('1a tam ayni', matchesGuestName('Mehmet Kaya', 'Mehmet', 'Kaya'), true);
check('1b DB orta isimli', matchesGuestName('Mehmet Ali Kaya', 'Mehmet', 'Kaya'), true);
check('1c girilen orta isimli', matchesGuestName('Mehmet Kaya', 'Mehmet Ali', 'Kaya'), true);
check('1d iki tarafta orta isim', matchesGuestName('Mehmet Ali Kaya', 'Mehmet Veli', 'Kaya'), true);
check('1e aksan: DB diyakritikli', matchesGuestName('Şahin Öz', 'Sahin', 'Oz'), true);
check('1f aksan: girilen diyakritikli', matchesGuestName('Sahin Oz', 'Şahin', 'Öz'), true);
check('1g buyuk-kucuk', matchesGuestName('MEHMET KAYA', 'mehmet', 'kaya'), true);
check('1h DB sirasi ters', matchesGuestName('Kaya Mehmet', 'Mehmet', 'Kaya'), true);
check('1i fazla bosluk', matchesGuestName('  Mehmet   Kaya ', ' Mehmet ', ' Kaya '), true);
check('1j TR i/I', matchesGuestName('Işıl Yıldız', 'Isil', 'Yildiz'), true);

// ── (2) matchesGuestName — NEGATIF (yanlis damga onlenmeli) ───────────────
// 2a: CANLI KIRILMA ORNEGI. Oda 102'de "Ayse Akin" kayitli, misafir "102 Mehmet Ak"
// yaziyor -> eskiden 'akin' icinde 'ak' gectigi icin eslesiyor, tek aday oldugu icin
// length===1 korumasi da geciyor ve telegram_id YANLIS kisiye damgalaniyordu.
check('2a ANA HEDEF soyad-parcasi', matchesGuestName('Ayse Akin', 'Mehmet', 'Ak'), false);
check('2b soyad DB soyadinin oneki', matchesGuestName('Ali Kayahan', 'Ali', 'Kaya'), false);
check('2c yanlis ad + dogru soyad', matchesGuestName('Ayse Kaya', 'Mehmet', 'Kaya'), false);
check('2d dogru ad + yanlis soyad', matchesGuestName('Mehmet Kaya', 'Mehmet', 'Demir'), false);
check('2e ad bos', matchesGuestName('Mehmet Kaya', '', 'Kaya'), false);
check('2f soyad bos', matchesGuestName('Mehmet Kaya', 'Mehmet', ''), false);
check('2g ad sadece bosluk', matchesGuestName('Mehmet Kaya', '   ', 'Kaya'), false);
check('2h DB adi bos', matchesGuestName('', 'Mehmet', 'Kaya'), false);
check('2i DB adi null', matchesGuestName(null, 'Mehmet', 'Kaya'), false);
check('2j DB tek token', matchesGuestName('Mehmet', 'Mehmet', 'Kaya'), false);

// ── (3) matchesGuestNameFromText — POZITIF (17.7-B ham metin) ─────────────
check('3a tam', matchesGuestNameFromText('Mehmet Kaya', 'Mehmet Kaya'), true);
check('3b DB orta isimli', matchesGuestNameFromText('Mehmet Ali Kaya', 'Mehmet Kaya'), true);
check('3c girilen orta isimli', matchesGuestNameFromText('Mehmet Kaya', 'Mehmet Ali Kaya'), true);
check('3d aksan', matchesGuestNameFromText('Şahin Öz', 'sahin oz'), true);
check('3e bosluk + buyuk harf', matchesGuestNameFromText('Mehmet Kaya', '  MEHMET   KAYA  '), true);

// ── (4) matchesGuestNameFromText — NEGATIF ────────────────────────────────
check('4a tek kelime (ad)', matchesGuestNameFromText('Mehmet Kaya', 'Mehmet'), false);
check('4b tek kelime (soyad)', matchesGuestNameFromText('Mehmet Kaya', 'Kaya'), false);
check('4c bos metin', matchesGuestNameFromText('Mehmet Kaya', ''), false);
check('4d sadece bosluk', matchesGuestNameFromText('Mehmet Kaya', '   '), false);
check('4e talep metni', matchesGuestNameFromText('Mehmet Kaya', 'odami temizleyin'), false);
check('4f ANA HEDEF ikizi', matchesGuestNameFromText('Ayse Akin', 'Mehmet Ak'), false);
check('4g soyad oneki', matchesGuestNameFromText('Ali Kayahan', 'Ali Kaya'), false);
check('4h tek harf', matchesGuestNameFromText('Ayse Akin', 'a'), false);
check('4i orta isim + yanlis soyad', matchesGuestNameFromText('Mehmet Ali Kaya', 'Ali Veli'), false);

// ── (5) NEGATIF KONTROL — eski substring davranisi ELLE yeniden uretilir ──
// site 1 ([17c-rn]) ESKI kodu: gn.includes(ad+soyad) || gn.includes(soyad)
function legacySubstringMatch(dbName: string, firstName: string, lastName: string): boolean {
  const gn = normalizeTr(dbName);
  return gn.includes(normalizeTr(`${firstName} ${lastName}`)) || gn.includes(normalizeTr(lastName));
}
// site 2 (17.7-B) ESKI kodu: yerel normalise (TR katlamasi YOK) + substring
function legacyFromTextMatch(dbName: string, typed: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalise(dbName).includes(normalise(typed));
}

// (a) ANA HEDEF: eski TRUE (yanlis damga) / yeni FALSE
check('5a legacy ANA HEDEF', legacySubstringMatch('Ayse Akin', 'Mehmet', 'Ak'), true);
check('5b yeni ANA HEDEF', matchesGuestName('Ayse Akin', 'Mehmet', 'Ak'), false);
// (b) soyad oneki: eski TRUE / yeni FALSE
check('5c legacy soyad-oneki', legacySubstringMatch('Ali Kayahan', 'Ali', 'Kaya'), true);
check('5d yeni soyad-oneki', matchesGuestName('Ali Kayahan', 'Ali', 'Kaya'), false);
// (c) Oracle KOR DEGIL: her seye true demiyor, gercek pozitifte ikisi de true
check('5e legacy gercek negatif', legacySubstringMatch('Mehmet Kaya', 'Zeynep', 'Demir'), false);
check('5f legacy gercek pozitif', legacySubstringMatch('Mehmet Kaya', 'Mehmet', 'Kaya'), true);
check('5g yeni gercek pozitif', matchesGuestName('Mehmet Kaya', 'Mehmet', 'Kaya'), true);
// (d) 17.7-B tek-harf deligi: eski TRUE / yeni FALSE
check('5h legacy tek harf', legacyFromTextMatch('Ayse Akin', 'a'), true);
check('5i yeni tek harf', matchesGuestNameFromText('Ayse Akin', 'a'), false);
// (e) 17.7-B TR katlama boslugu: eski FALSE (misafir kilitlenirdi) / yeni TRUE
check('5j legacy TR katlama yok', legacyFromTextMatch('Şahin Öz', 'sahin oz'), false);
check('5k yeni TR katlama var', matchesGuestNameFromText('Şahin Öz', 'sahin oz'), true);

// ── (6) sameGuestByText — SITE 5 (reception-approval GUARD B) ─────────────
// Iki TAM ISIM ayni misafiri mi? Ilk token = ad, son token = soyad.
check('6a tam ayni', sameGuestByText('Kemal Kuyucu', 'Kemal Kuyucu'), true);
check('6b A orta isimli', sameGuestByText('Kemal Ali Kuyucu', 'Kemal Kuyucu'), true);
check('6c B orta isimli', sameGuestByText('Kemal Kuyucu', 'Kemal Ali Kuyucu'), true);
check('6d ayni soyad farkli ad', sameGuestByText('Ayse Akin', 'Mehmet Akin'), false);
check('6e soyad-parcasi', sameGuestByText('Ayse Akin', 'Mehmet Ak'), false);
check('6f TR diyakritik', sameGuestByText('Sahin Yilmaz', 'Şahin Yılmaz'), true);
check('6g tek token esit', sameGuestByText('Kemal', 'Kemal'), true);
check('6h tek token farkli', sameGuestByText('Kemal', 'Ahmet Yilmaz'), false);
check('6i tek token vs cift', sameGuestByText('Kemal', 'Kemal Kuyucu'), false);
check('6j bos taraf', sameGuestByText('', 'Kemal Kuyucu'), false);
check('6k fazla bosluk', sameGuestByText('  Kemal   Kuyucu  ', 'kemal kuyucu'), true);

// ── (7) sameLastName — SITE 6 (route.ts re-verify) ────────────────────────
check('7a esit', sameLastName('Kuyucu', 'Kuyucu'), true);
check('7b farkli', sameLastName('Kuyucu', 'Yilmaz'), false);
check('7c coklu-token A', sameLastName('Al Saleh', 'Saleh'), true);
check('7d coklu-token B', sameLastName('Saleh', 'Al Saleh'), true);
check('7e TR diyakritik', sameLastName('Şahin', 'Sahin'), true);
check('7f onek DEGIL', sameLastName('Ak', 'Akin'), false);
check('7g A bos', sameLastName('', 'Kuyucu'), false);
check('7h B bos', sameLastName('Kuyucu', ''), false);

// ── (8) NEGATIF KONTROL — site 5'in ESKI normalizer'i ELLE yeniden uretilir ─
// reception-approval GUARD B ESKI kodu: toLocaleLowerCase('tr') + TAM-DIZE esitlik.
// Modulden TURETILMEZ (oz-dogrulama tuzagi); olculen sey TAM-DIZE vs TOKEN karari.
const legacySame = (a: string, b: string): boolean =>
  String(a).toLocaleLowerCase('tr').trim() === String(b).toLocaleLowerCase('tr').trim();

// (a) TR katlama: eski FALSE (ayni kisi "farkli" sayilirdi) / yeni TRUE
check('8a legacy TR katlama yok', legacySame('Sahin Yilmaz', 'Şahin Yılmaz'), false);
check('8b yeni TR katlama var', sameGuestByText('Sahin Yilmaz', 'Şahin Yılmaz'), true);
// (b) orta isim: eski FALSE / yeni TRUE
check('8c legacy orta isim', legacySame('Kemal Kuyucu', 'Kemal Ali Kuyucu'), false);
check('8d yeni orta isim', sameGuestByText('Kemal Kuyucu', 'Kemal Ali Kuyucu'), true);
// (c) Oracle KOR DEGIL: birebir ayni yazimda TRUE, gercek farkli kiside FALSE
check('8e legacy birebir ayni', legacySame('Kemal Kuyucu', 'kemal kuyucu'), true);
check('8f legacy gercek farkli', legacySame('Kemal Kuyucu', 'Ahmet Yilmaz'), false);
check('8g yeni gercek farkli', sameGuestByText('Kemal Kuyucu', 'Ahmet Yilmaz'), false);

// ── (9) allergen-verify-gate (site 7) — ad+soyad + TR-fold; legacy oracle negatif kontrol ─
// Site 7 ESKI kodu: DB adinin SON kelimesi === yazilan soyad, toLowerCase (TR katlamasi
// YOK), ad HIC kiyaslanmaz, find() ilk-alma. Oracle modulden TURETILMEZ (oz-dogrulama
// tuzagi); olculen sey "yalniz soyad + TR-katlamasiz" karari.
const legacyAllergenMatch = (dbName: string, typedLast: string): boolean => {
  const parts = dbName.trim().split(/\s+/);
  const lastWord = (parts[parts.length - 1] ?? '').toLowerCase();
  return lastWord === typedLast.trim().toLowerCase();
};

check('9a dogru kisi', matchesGuestName('Mehmet Akın', 'Mehmet', 'Akın'), true);
check('9b ANA HEDEF ayni soyad farkli ad', matchesGuestName('Ayşe Akın', 'Mehmet', 'Akın'), false);
check('9c TR-fold', matchesGuestName('Şahin Yılmaz', 'Sahin', 'Yilmaz'), true);
check('9d orta isim toleransli', matchesGuestName('Mehmet Ali Kuyucu', 'Mehmet', 'Kuyucu'), true);
check('9e ad oneki DEGIL', matchesGuestName('Kemal Kuyucu', 'Kemalettin', 'Kuyucu'), false);
check('9f dogru kisi (ayni oda ikizi)', matchesGuestName('Ayşe Akın', 'Ayşe', 'Akın'), true);
check('9g farkli soyad', matchesGuestName('Mehmet Demir', 'Mehmet', 'Akın'), false);

// (a) ANA HEDEF: eski TRUE (alerji YANLIS kisiye yazilirdi) / yeni FALSE
check('9h legacy ANA HEDEF', legacyAllergenMatch('Ayşe Akın', 'Akın'), true);
check('9i yeni ANA HEDEF', matchesGuestName('Ayşe Akın', 'Mehmet', 'Akın'), false);
// (b) TR katlama boslugu: eski FALSE (gercek misafir kilitlenirdi) / yeni TRUE
check('9j legacy TR katlama yok', legacyAllergenMatch('Şahin Yılmaz', 'Yilmaz'), false);
check('9k yeni TR katlama var', matchesGuestName('Şahin Yılmaz', 'Sahin', 'Yilmaz'), true);
// (c) Oracle KOR DEGIL: dogru kiside ikisi de TRUE, farkli soyadda ikisi de FALSE
check('9l legacy dogru kisi', legacyAllergenMatch('Mehmet Akın', 'Akın'), true);
check('9m yeni dogru kisi', matchesGuestName('Mehmet Akın', 'Mehmet', 'Akın'), true);
check('9n legacy farkli soyad', legacyAllergenMatch('Mehmet Demir', 'Akın'), false);
check('9o yeni farkli soyad', matchesGuestName('Mehmet Demir', 'Mehmet', 'Akın'), false);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`IS8 match-guest-name: ${pass}/${total} PASS`);
  for (const f of fails) console.error('  x ' + f);
  process.exit(1);
}
console.log(`IS8 match-guest-name: ${pass}/${total} PASS`);
