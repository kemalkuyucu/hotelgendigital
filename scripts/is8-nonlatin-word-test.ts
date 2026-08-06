/**
 * IS 8 — NON-LATIN TAM-KELIME sinirlari (backlog #9) korpusu.
 * GERCEK moduller import edilir (kopya fonksiyon YASAK); ag/LLM cagrisi YOK.
 *
 * Kapsam: substring yuzunden LISTEDEN CIKARILMIS iki uyenin ('зал', 'день')
 * kelime siniriyla geri eklenmesi. Test yalniz yardimciyi degil, GERCEK CAGRI
 * YERLERINI (hasEventKeyword / parseVerificationInput) de gezer.
 *
 * §4 CIFT-YONLU ORACLE: eski SUBSTRING davranisi ELLE yeniden yazilir ve
 * "eski TRUE / yeni FALSE" ciftiyle assert edilir; ayrica oracle'in KOR OLMADIGI
 * (gercek pozitifte ikisi de TRUE) gosterilir. Oracle test edilen modulden
 * TURETILMEZ — yoksa kendini dogrular.
 */
import { hasEventKeyword, EVENT_KEYWORDS_NONLATIN_WORD } from '@/lib/ai/event-contact-gate';
import { parseVerificationInput } from '@/lib/verification/verify-guest';
import { matchesNonLatinWord } from '@/lib/utils/nonlatin-word';
import { normalizeTr } from '@/lib/utils/normalize-tr';

let pass = 0;
const fails: string[] = [];
function check(desc: string, got: boolean, expected: boolean) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${got} (beklenen ${expected})`);
}
const ev = (s: string) => hasEventKeyword(normalizeTr(s));

// ── §1 — 'зал' YANLIS-POZITIFLERI ELENIR (cikarilma gerekcesi) ──────────────
check('1a "он сказал" (soyledi) etkinlik DEGIL', ev('он сказал что приедет'), false);
check('1b "вокзал" (gar) etkinlik DEGIL', ev('как доехать до вокзала'), false);
check('1c "показал" (gosterdi) etkinlik DEGIL', ev('он показал мне номер'), false);
check('1d "залив" (koy) etkinlik DEGIL', ev('вид на залив'), false);
check('1e "залог" (depozito) etkinlik DEGIL', ev('нужен ли залог'), false);

// ── §2 — 'зал' GERCEK KULLANIMI ESLESIR ─────────────────────────────────────
check('2a yalin "зал"', ev('нужен зал'), true);
check('2b tireli "конференц-зал" (tire harf DEGIL)', ev('есть конференц-зал'), true);
check('2c tamlayan hali "зала"', ev('аренда зала'), true);
// IZOLE: cumlede BASKA etkinlik kelimesi olmamali. ("мероприятие в зале" gibi bir
// ornek zaten substring listesindeki 'мероприятие' yuzunden gecer, 'зале'yi OLCMEZ.)
check('2d bulunma hali "зале" (izole)', ev('в зале сколько мест'), true);
check('2e cogul "залы"', ev('какие залы есть'), true);
check('2f cumle sonu noktalama', ev('где зал?'), true);

// ── §3 — 'день' / 'деньги' AYRIMI (parse cagri yerinden) ────────────────────
// disqualifiedAsRoom TRUE ise prefixsiz sayi ODA SAYILMAZ.
check('3a "деньги" miktar baglami DEGIL -> oda okunur', parseVerificationInput('312 деньги').roomNumber === '312', true);
check('3b "деньгами" -> oda okunur', parseVerificationInput('312 деньгами').roomNumber === '312', true);
// DIKKAT: sayi 2-4 HANELI olmali — ROOM_REGEX tek haneyi zaten oda saymaz, oyle
// bir vaka bu degisiklik OLMADAN da gecerdi (sahte kapsam).
check('3c "день" miktar baglami -> prefixsiz sayi ODA SAYILMAZ', parseVerificationInput('312 день').roomNumber === null, true);
check('3d prefixli sayi HER ZAMAN oda (miktar baglaminda bile)', parseVerificationInput('номер 312 день').roomNumber === '312', true);
check('3e cogul "дней" (eski substring uyesi) hala calisir', parseVerificationInput('312 дней').roomNumber === null, true);

// ── §4 — CIFT-YONLU ORACLE: eski SUBSTRING davranisi ────────────────────────
// ELLE yazildi; test edilen modulden TURETILMEDI.
const legacySubstring = (text: string, word: string) => text.includes(word);

const OLD_FALSE_POSITIVES: [string, string][] = [
  ['он сказал что приедет', 'зал'],
  ['как доехать до вокзала', 'зал'],
  ['он показал мне номер', 'зал'],
  ['у меня нет денег, деньги кончились', 'день'],
];
for (const [text, word] of OLD_FALSE_POSITIVES) {
  const n = normalizeTr(text);
  check(`4-"${word}"/"${text.slice(0, 14)}…" ESKI substring TRUE derdi`, legacySubstring(n, word), true);
  check(`4-"${word}"/"${text.slice(0, 14)}…" YENI kelime-siniri FALSE der`, matchesNonLatinWord(n, word), false);
}

// Oracle KOR DEGIL: gercek pozitifte ikisi de TRUE olmali.
for (const [text, word] of [['нужен зал', 'зал'], ['всего один день', 'день']] as [string, string][]) {
  const n = normalizeTr(text);
  check(`4z oracle kor degil (eski) "${word}"`, legacySubstring(n, word), true);
  check(`4z oracle kor degil (yeni) "${word}"`, matchesNonLatinWord(n, word), true);
}

// ── §5 — YARDIMCI SINIR DAVRANISI ───────────────────────────────────────────
check('5a bos metin', matchesNonLatinWord('', 'зал'), false);
check('5b bos kelime', matchesNonLatinWord('зал', ''), false);
check('5c latin metni etkilenmez', matchesNonLatinWord('oda 312 lutfen', 'зал'), false);
check('5d rakam sinir sayilir', matchesNonLatinWord('2 зал 3', 'зал'), true);
check('5e liste bos degil', EVENT_KEYWORDS_NONLATIN_WORD.length > 0, true);

// ── §6 — MEVCUT UYELERDE REGRESYON YOK (substring listesi bozulmadi) ────────
check('6a "свадьба" hala etkinlik', ev('хотим свадьбу'), true);
check('6b "конференция" hala etkinlik', ev('конференция на 50 человек'), true);
check('6c "человек" hala miktar -> oda okunmaz', parseVerificationInput('40 человек').roomNumber === null, true);
check('6d duz TR oda mesaji bozulmadi', parseVerificationInput('312 Mehmet Akin').roomNumber === '312', true);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
