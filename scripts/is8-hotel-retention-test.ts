/**
 * IS 8 — Otel soft-delete RETENTION karari korpusu.
 * GERCEK modul import edilir (kopya fonksiyon YASAK).
 *
 * `now` SABIT verilir: `Date.now()` kullanan bir test saat gectikce kayar ve
 * bir gun sessizce yesil/kirmizi doner. Beklentiler ELLE yazilmistir, modulden
 * TURETILMEZ (turetilseydi esik degistiginde beklenti de kayar ve test KENDINI
 * dogrulardi -- STOP_WORDS korpusunda bir kez bu tuzaga dusulmustu).
 *
 * §4 CIFT-YONLU NEGATIF KONTROL: `legacyInlineDue` = bu modul YOKKEN cron'a
 * yazilacak olan inline kontrolun ELLE yazilmis ikizi.
 */
import { PURGE_RETENTION_DAYS, purgeInfo, isPurgeDue } from '@/lib/hotels/retention';

let pass = 0;
const fails: string[] = [];

function check(desc: string, got: unknown, expected: unknown) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
}
function checkTrue(desc: string, cond: boolean) {
  check(desc, cond, true);
}

const DAY = 86_400_000;
const NOW = new Date('2026-08-13T12:00:00.000Z');
const NOW_MS = NOW.getTime();
/** now'dan `d` gun ONCE silinmis bir otelin deleted_at ISO'su. */
const agoIso = (d: number) => new Date(NOW_MS - d * DAY).toISOString();

// ── §1 ESIK MUHRU ───────────────────────────────────────────────────────────
check('1a PURGE_RETENTION_DAYS === 30', PURGE_RETENTION_DAYS, 30);

// ── §2 FAIL-SAFE: okunamayan deleted_at ASLA purge tetiklemez ───────────────
const BAD: Array<[string, string | Date | null | undefined]> = [
  ['2a null', null],
  ['2b undefined', undefined],
  ['2c bos dize', ''],
  ['2d sadece bosluk', '   '],
  ['2e not-a-date', 'not-a-date'],
  ['2f yarim tarih metni', '2026-13-45T99:99:99Z'],
  ['2g Invalid Date objesi', new Date('bozuk')],
];
for (const [desc, input] of BAD) {
  const r = purgeInfo(input, NOW);
  check(`${desc}: deleted`, r.deleted, false);
  check(`${desc}: due`, r.due, false);
  check(`${desc}: daysLeft`, r.daysLeft, null);
  check(`${desc}: purgeAt`, r.purgeAt, null);
}

// ── §3 SINIR: tam 30 gun / 1ms once / 1ms sonra ─────────────────────────────
const exact = purgeInfo(agoIso(30), NOW);
check('3a TAM 30 gun -> due', exact.due, true);
check('3b TAM 30 gun -> daysLeft 0', exact.daysLeft, 0);
check('3c TAM 30 gun -> deleted', exact.deleted, true);
check('3d TAM 30 gun -> purgeAt == now', exact.purgeAt?.getTime(), NOW_MS);

const oneMsShort = purgeInfo(new Date(NOW_MS - 30 * DAY + 1).toISOString(), NOW);
check('3e 30 gun - 1ms -> due false', oneMsShort.due, false);
check('3f 30 gun - 1ms -> daysLeft 1 (ceil)', oneMsShort.daysLeft, 1);

const oneMsPast = purgeInfo(new Date(NOW_MS - 30 * DAY - 1).toISOString(), NOW);
check('3g 30 gun + 1ms -> due true', oneMsPast.due, true);
check('3h 30 gun + 1ms -> daysLeft 0', oneMsPast.daysLeft, 0);

// ── §4 ceil davranisi: kismi gun YUKARI yuvarlanir ──────────────────────────
check('4a 29.4 gun once -> daysLeft 1', purgeInfo(agoIso(29.4), NOW).daysLeft, 1);
check('4b 29.4 gun once -> due false', purgeInfo(agoIso(29.4), NOW).due, false);
check('4c 29.6 gun once -> daysLeft 1', purgeInfo(agoIso(29.6), NOW).daysLeft, 1);
check('4d 29 gun once -> daysLeft 1', purgeInfo(agoIso(29), NOW).daysLeft, 1);
check('4e 29 gun once -> due FALSE (esik 30, 29 DEGIL)', purgeInfo(agoIso(29), NOW).due, false);
check('4f 23 gun once -> daysLeft 7', purgeInfo(agoIso(23), NOW).daysLeft, 7);
check('4g 0.5 gun once -> daysLeft 30', purgeInfo(agoIso(0.5), NOW).daysLeft, 30);
check('4h az once silindi -> daysLeft 30', purgeInfo(agoIso(0), NOW).daysLeft, 30);

// ── §5 CLAMP: alt sinir 0, ust sinir YOK ────────────────────────────────────
check('5a 100 gun once -> daysLeft 0 (negatife DUSMEZ)', purgeInfo(agoIso(100), NOW).daysLeft, 0);
check('5b 100 gun once -> due true', purgeInfo(agoIso(100), NOW).due, true);
const future = purgeInfo(new Date(NOW_MS + 5 * DAY).toISOString(), NOW);
check('5c ileri tarihli deleted_at -> due false', future.due, false);
check('5d ileri tarihli deleted_at -> daysLeft 35 (ust clamp YOK, bozukluk GORUNUR)', future.daysLeft, 35);

// ── §6 GIRDI TIPI: Date objesi ile ISO dize AYNI karari verir ───────────────
check(
  '6a Date objesi == ISO dize (due)',
  purgeInfo(new Date(NOW_MS - 31 * DAY), NOW).due,
  purgeInfo(agoIso(31), NOW).due,
);
check(
  '6b Date objesi == ISO dize (daysLeft)',
  purgeInfo(new Date(NOW_MS - 12 * DAY), NOW).daysLeft,
  purgeInfo(agoIso(12), NOW).daysLeft,
);

// ── §7 DST/locale bagimsizligi: saf UTC ms aritmetigi ───────────────────────
//     Avrupa DST gecisini (2026-03-29) iceren bir pencerede 30 gun HALA
//     30*86400000 ms'dir; takvim parcasi (setDate) kullanilsaydi 1 saat kayardi.
const dstDeleted = '2026-03-28T23:30:00.000Z';
const dstInfo = purgeInfo(dstDeleted, new Date('2026-04-27T23:29:59.999Z'));
check('7a DST penceresi: 1ms kala due false', dstInfo.due, false);
check('7b DST penceresi: purgeAt tam 30*DAY sonra', dstInfo.purgeAt?.toISOString(), '2026-04-27T23:30:00.000Z');
check(
  '7c DST penceresi: tam aninda due true',
  purgeInfo(dstDeleted, new Date('2026-04-27T23:30:00.000Z')).due,
  true,
);

// ── §8 isPurgeDue: purge_hold OTOMATIK yolu KESER ───────────────────────────
const overdue = agoIso(45);
check('8a hold=true -> false (vadesi GECMIS olsa bile)', isPurgeDue({ deleted_at: overdue, purge_hold: true }, NOW), false);
check('8b hold=false -> true', isPurgeDue({ deleted_at: overdue, purge_hold: false }, NOW), true);
check('8c hold=null -> true', isPurgeDue({ deleted_at: overdue, purge_hold: null }, NOW), true);
check('8d hold alani YOK -> true', isPurgeDue({ deleted_at: overdue }, NOW), true);
check('8e silinmemis + hold=false -> false', isPurgeDue({ deleted_at: null, purge_hold: false }, NOW), false);
check('8f vadesi DOLMAMIS + hold=false -> false', isPurgeDue({ deleted_at: agoIso(29), purge_hold: false }, NOW), false);
check('8g bos satir -> false', isPurgeDue({}, NOW), false);
check('8h hold TRUE ama tarih bozuk -> false', isPurgeDue({ deleted_at: 'not-a-date', purge_hold: true }, NOW), false);

// ── §9 CIFT-YONLU NEGATIF KONTROL ───────────────────────────────────────────
// Bu modul olmasa cron'a su yazilirdi. Modulden TURETILMEZ; ayni karari vermek
// ZORUNDA. Ayrisirsa modul cagri yerinin yerini almiyor demektir.
function legacyInlineDue(deletedAt: string | null | undefined, now: Date): boolean {
  if (!deletedAt) return false;
  const t = new Date(deletedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() >= t + 30 * 24 * 60 * 60 * 1000;
}

const ORACLE_INPUTS: Array<string | null | undefined> = [
  null, undefined, '', 'not-a-date',
  agoIso(0), agoIso(1), agoIso(15), agoIso(29), agoIso(29.999),
  agoIso(30), agoIso(30.001), agoIso(45), agoIso(365),
  new Date(NOW_MS + 5 * DAY).toISOString(),
];
let oracleTrue = 0;
let oracleFalse = 0;
for (const input of ORACLE_INPUTS) {
  const legacy = legacyInlineDue(input, NOW);
  if (legacy) oracleTrue++;
  else oracleFalse++;
  checkTrue(`9-${String(input)}: modul == inline ikiz`, purgeInfo(input, NOW).due === legacy);
}
// Oracle KOR DEGIL: hem pozitif hem negatif uretmis olmali (yoksa "hep false"
// donen bir oracle tum vakalari sessizce gecirirdi).
checkTrue('9y oracle en az bir TRUE uretti', oracleTrue >= 1);
checkTrue('9z oracle en az bir FALSE uretti', oracleFalse >= 1);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
