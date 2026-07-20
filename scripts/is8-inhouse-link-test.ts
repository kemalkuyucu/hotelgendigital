/**
 * C1 — bayat inhouse link birim testi (local, gitignored).
 * GERCEK isInhouseRowLinkable import edilir (kopya YOK).
 *
 * Vaka 1 CANLI BUG'in birebir kopyasi: konusma ARSIVLI satira isaret ediyordu
 * (oda 312, check_out gelecekte) -> eskiden "bagli" sayiliyordu -> 17.c acilmiyordu.
 */
import { isInhouseRowLinkable, type InhouseLinkRow } from '@/lib/verification/inhouse-link';

const TODAY = '2026-07-20';

const CASES: [string, InhouseLinkRow | null, boolean][] = [
  // [aciklama, satir, beklenen linkable]
  ['CANLI BUG: arsivli satir, check_out gelecekte', { status: 'archived', check_out_date: '2026-11-11' }, false],
  ['saglikli: active + gelecek check_out', { status: 'active', check_out_date: '2026-11-22' }, true],
  ['sinir: active + check_out BUGUN', { status: 'active', check_out_date: TODAY }, true],
  ['konaklama bitmis: active + dun', { status: 'active', check_out_date: '2026-07-19' }, false],
  ['satir silinmis (null)', null, false],
  ['satir yok (undefined)', undefined as unknown as InhouseLinkRow, false],
  ['active ama check_out NULL', { status: 'active', check_out_date: null }, false],
  ['active ama check_out bos string', { status: 'active', check_out_date: '' }, false],
  ['status yok', { check_out_date: '2026-11-22' }, false],
  ['bilinmeyen status', { status: 'checked_out', check_out_date: '2026-11-22' }, false],
];

let pass = 0;
const fails: string[] = [];
for (const [desc, row, expected] of CASES) {
  const got = isInhouseRowLinkable(row, TODAY);
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" → ${got} (beklenen ${expected})`);
}

for (const f of fails) console.log(f);
console.log(`\n${pass}/${CASES.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
