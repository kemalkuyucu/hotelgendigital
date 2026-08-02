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
import { matchesGuestName, matchesGuestNameFromText } from '@/lib/verification/match-guest-name';
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

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`IS8 match-guest-name: ${pass}/${total} PASS`);
  for (const f of fails) console.error('  x ' + f);
  process.exit(1);
}
console.log(`IS8 match-guest-name: ${pass}/${total} PASS`);
