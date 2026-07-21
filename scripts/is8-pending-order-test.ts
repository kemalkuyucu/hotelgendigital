/**
 * IS 12 — readPendingText matematik self-heal regresyon testi (local, is8 korpusu).
 *
 * GERCEK readPendingText import edilir (src/lib/menu/pending-order.ts) — kopya YOK
 * (kopya yesil doner, canli davranisla celisir; bu tuzak bir kez yasandi). Ag/LLM cagrisi YOK.
 *
 * Kapsanan KARAR (is12 self-heal): zarf server-yazimi ama koru koru guvenilmez;
 * lineTotal=unitPrice*qty ve total=Sigma(lineTotal) YENIDEN turetilir; depolanan uyumsuz/eksikse
 * [rs-total-fix] loglanir ve TURETILEN deger kullanilir (crash DEGIL). Ham/damgasiz/bozuk-JSON/
 * lines-bos -> structured=null (eski davranis KORUNUR).
 *
 * Not: b/c/d vakalarinda [rs-total-fix] uyarisi BEKLENEN cikti (self-heal loglanir).
 */
import { readPendingText } from '@/lib/menu/pending-order';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

type LineOver = Partial<{ code: string; name: string; unitPrice: number; qty: number; lineTotal: number }>;
const line = (over: LineOver) => ({ code: 'RS01', name: 'Kahve', unitPrice: 50, qty: 2, lineTotal: 100, ...over });

// a) Gecerli zarf (total = Sigma lineTotal) -> heal YOK, deger korunur
{
  const stored = JSON.stringify({ v: 1, raw: 'RS01 2', lines: [line({})], total: 100, currency: 'TRY' });
  const r = readPendingText(stored);
  check('a total korunur', r.structured?.total, 100);
  check('a lineTotal korunur', r.structured?.lines[0]?.lineTotal, 100);
  check('a v korunur', r.v, 1);
  check('a orderText raw', r.orderText, 'RS01 2');
}

// b) total NULL -> derivedTotal (Sigma lineTotal)
{
  const stored = JSON.stringify({ v: 1, raw: 'RS01 2', lines: [line({})], currency: 'TRY' }); // total yok
  const r = readPendingText(stored);
  check('b total turetildi', r.structured?.total, 100);
}

// c) total yanlis (stored != Sigma) -> derivedTotal (self-heal)
{
  const stored = JSON.stringify({ v: 1, lines: [line({})], total: 999, currency: 'TRY' });
  const r = readPendingText(stored);
  check('c total self-heal', r.structured?.total, 100);
}

// d) lineTotal yanlis (unitPrice*qty != stored) -> o satir turetilir
{
  const stored = JSON.stringify({ v: 1, lines: [line({ lineTotal: 77 })], total: 77, currency: 'TRY' });
  const r = readPendingText(stored);
  check('d lineTotal self-heal', r.structured?.lines[0]?.lineTotal, 100); // 50*2
  check('d total turetilen-line uzerinden', r.structured?.total, 100);
}

// d2) coklu satir: biri dogru biri bozuk -> yalniz bozuk satir + total turetilir
{
  const stored = JSON.stringify({
    v: 3,
    lines: [
      line({ code: 'RS01', unitPrice: 50, qty: 2, lineTotal: 100 }),
      line({ code: 'RS02', name: 'Cay', unitPrice: 30, qty: 3, lineTotal: 5 }),
    ],
    total: 105, currency: 'TRY',
  });
  const r = readPendingText(stored);
  check('d2 dogru satir korunur', r.structured?.lines[0]?.lineTotal, 100);
  check('d2 bozuk satir turetildi', r.structured?.lines[1]?.lineTotal, 90); // 30*3
  check('d2 total turetildi', r.structured?.total, 190); // 100+90
}

// e) JSON degil / damgasiz ham metin -> structured=null (eski davranis)
{
  const r = readPendingText('club sandwich istiyorum');
  check('e structured null', r.structured, null);
  check('e orderText ham', r.orderText, 'club sandwich istiyorum');
  check('e v undefined', r.v, undefined);
}

// e2) bozuk JSON (parse fail) -> structured=null, ham metin korunur
{
  const r = readPendingText('{bozuk json');
  check('e2 structured null', r.structured, null);
  check('e2 orderText ham', r.orderText, '{bozuk json');
}

// f) lines yok / bos -> structured=null (v korunur)
{
  const r1 = readPendingText(JSON.stringify({ v: 2, raw: 'merhaba' })); // lines yok
  check('f1 structured null', r1.structured, null);
  check('f1 v korunur', r1.v, 2);
  const r2 = readPendingText(JSON.stringify({ v: 4, lines: [] })); // lines bos
  check('f2 structured null', r2.structured, null);
  check('f2 v korunur', r2.v, 4);
}

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
