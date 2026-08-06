/**
 * IS 8 — UNIQUE ihlali (SQLSTATE 23505) karari korpusu.
 * GERCEK modul import edilir (kopya fonksiyon YASAK).
 *
 * Vaka listesi SABIT ve ELLE yazilmistir — modulden/kaynaktan TURETILMEZ.
 * Turetilseydi kod sabiti degistiginde beklenti de birlikte kayar ve test
 * KENDINI dogrulardi (STOP_WORDS korpusunda bir kez bu tuzaga dusulmustu).
 *
 * §3 CIFT-YONLU NEGATIF KONTROL: `legacyInlineCheck` = bu modul YOKKEN cagri
 * yerine yazilacak olan inline kontrolun ELLE yazilmis ikizi. Her vakada
 * (i) iki taraf AYNI karari vermeli (modul inline'in yerini BIREBIR aliyor) ve
 * (ii) oracle KOR OLMAMALI (hem true hem false uretmis olmali).
 */
import { isUniqueViolation } from '@/lib/utils/pg-error';

let pass = 0;
const fails: string[] = [];

function check(desc: string, got: unknown, expected: unknown) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
}
function checkTrue(desc: string, cond: boolean) {
  check(desc, cond, true);
}

// SABIT beklenti tablosu — kaynaktan TURETILMEZ, elle yazilir.
const CASES: Array<{ desc: string; input: { code?: unknown } | null | undefined; expected: boolean }> = [
  // ── §1 POZITIF: 23505 ─────────────────────────────────────────────────────
  { desc: '1a yalin { code: 23505 }', input: { code: '23505' }, expected: true },
  {
    desc: '1b gercek PostgrestError sekli (ek alanlar karari DEGISTIRMEZ)',
    input: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "uq_sla_events_open_request"',
      details: 'Key (conversation_id, department_code, md5(request_text))=(...) already exists.',
      hint: null,
    },
    expected: true,
  },

  // ── §2 NEGATIF: baska kod / sinir girdisi ─────────────────────────────────
  { desc: '2a 23503 (foreign_key_violation)', input: { code: '23503' }, expected: false },
  { desc: '2b 23502 (not_null_violation)', input: { code: '23502' }, expected: false },
  { desc: '2c PGRST116 (satir yok)', input: { code: 'PGRST116' }, expected: false },
  { desc: '2d 2350 — prefix eslesmesi YOK', input: { code: '2350' }, expected: false },
  { desc: '2e 235050 — suffix/genisleme eslesmesi YOK', input: { code: '235050' }, expected: false },
  { desc: '2f SAYI 23505 (string degil) — tip KATI', input: { code: 23505 as unknown }, expected: false },
  { desc: '2g null', input: null, expected: false },
  { desc: '2h undefined', input: undefined, expected: false },
  { desc: '2i bos nesne {}', input: {}, expected: false },
  { desc: '2j code: null', input: { code: null }, expected: false },
  { desc: '2k code: undefined', input: { code: undefined }, expected: false },
  { desc: '2l code: bos dize', input: { code: '' }, expected: false },
  {
    desc: '2m yalniz MESAJ 23505 der, kod BASKA — mesaj olcut DEGIL',
    input: { code: '23503', message: 'duplicate key value violates unique constraint' },
    expected: false,
  },
  {
    desc: '2n kod alani YOK, mesaj duplicate der — mesaj olcut DEGIL',
    input: { message: 'duplicate key value violates unique constraint' } as { code?: unknown },
    expected: false,
  },
];

for (const c of CASES) {
  check(c.desc, isUniqueViolation(c.input), c.expected);
}

// ── §3 — CIFT-YONLU NEGATIF KONTROL (elle yazilmis inline ikiz) ─────────────
// Bu modul olmasa cagri yerine su yazilirdi. Modulden TURETILMEZ; birebir ayni
// karari vermek ZORUNDA. Ayrisirsa modul cagri yerinin yerini almiyor demektir.
function legacyInlineCheck(e: unknown): boolean {
  if (e === null || e === undefined) return false;
  if (typeof e !== 'object') return false;
  const code = (e as Record<string, unknown>).code;
  return typeof code === 'string' && code === '23505';
}

let oracleTrue = 0;
let oracleFalse = 0;
for (const c of CASES) {
  const legacy = legacyInlineCheck(c.input);
  if (legacy) oracleTrue++;
  else oracleFalse++;
  checkTrue(`3-${c.desc}: modul == inline ikiz`, isUniqueViolation(c.input) === legacy);
}
// Oracle KOR DEGIL: hem pozitif hem negatif uretmis olmali (yoksa "hep false"
// donen bir oracle tum vakalari sessizce gecirirdi).
checkTrue('3y oracle en az bir TRUE uretti', oracleTrue >= 1);
checkTrue('3z oracle en az bir FALSE uretti', oracleFalse >= 1);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
