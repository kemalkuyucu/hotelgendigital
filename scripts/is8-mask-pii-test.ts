/**
 * IS 8 — LOG PII MASKELEME (maskName) korpusu.
 * GERCEK modul import edilir (kopya fonksiyon YASAK).
 *
 * Bu dosyanin ASIL guvenlik iddiasi §2'dedir: HAM ISIM CIKTIDA GECMEZ.
 * §1 damganin kararliligini/ayirt ediciligini, §3 ise sinir girdileri kapsar.
 */
import { maskName } from '@/lib/utils/mask-pii';
import { normalizeTr } from '@/lib/utils/normalize-tr';

let pass = 0;
const fails: string[] = [];

function check(desc: string, got: unknown, expected: unknown) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
}
function checkTrue(desc: string, cond: boolean) {
  check(desc, cond, true);
}

// ── §1 — DAMGA DAVRANISI ────────────────────────────────────────────────────
const A = maskName('Mehmet Akin');

checkTrue('1a format: #<hex>/<len>', /^#[0-9a-f]{8}\/\d+$/.test(A));
check('1b deterministik: ayni girdi ayni damga', maskName('Mehmet Akin'), A);
check('1c BUYUK/kucuk harf ayni damga (normalizeTr)', maskName('MEHMET AKIN'), A);
check('1d bastaki/sondaki bosluk ayni damga', maskName('  Mehmet Akin  '), A);
checkTrue('1e FARKLI isim FARKLI damga', maskName('Ayse Yilmaz') !== A);
checkTrue(
  '1f diyakritik: normalizeTr ne diyorsa damga da onu der',
  (normalizeTr('Şahin') === normalizeTr('Sahin')) === (maskName('Şahin') === maskName('Sahin')),
);
check('1g uzunluk TRIM sonrasi ham uzunluk', maskName('  Ali  ').split('/')[1], '3');

// ── §2 — GUVENLIK IDDIASI: HAM ISIM SIZMAZ ──────────────────────────────────
// Bu bolum dusen gun maskeleme ISE YARAMIYOR demektir.
const SECRETS = ['Mehmet', 'Akin', 'Ayse', 'Yilmaz', 'Şahin', 'O’Brien', 'Al Saleh', 'Мария', 'محمد'];
for (const s of SECRETS) {
  const out = maskName(s + ' Test');
  checkTrue(`2-${s}: ham ad ciktida GECMEZ`, !out.includes(s));
  checkTrue(`2-${s}: normalize edilmis ad da GECMEZ`, !out.toLowerCase().includes(normalizeTr(s)));
}
checkTrue('2z tam ad ciktida GECMEZ', !maskName('Mehmet Akin').includes('Mehmet Akin'));

// ── §3 — SINIR GIRDILERI ────────────────────────────────────────────────────
check('3a null', maskName(null), '(yok)');
check('3b undefined', maskName(undefined), '(yok)');
check('3c dize olmayan (sayi)', maskName(123 as unknown as string), '(yok)');
check('3d bos dize', maskName(''), '(bos)');
check('3e yalniz bosluk', maskName('   '), '(bos)');
checkTrue('3f tek harf de maskelenir', /^#[0-9a-f]{8}\/1$/.test(maskName('M')));
checkTrue('3g cok uzun ad patlamaz', /^#[0-9a-f]{8}\/200$/.test(maskName('a'.repeat(200))));

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
