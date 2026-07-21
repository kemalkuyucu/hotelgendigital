// scripts/doctor.mjs — HOTELGEN kontrol asistani ("doctor"). Tek komut: npm run doctor
//
// 4 kontrol -> PASS/FAIL/WARN + OVERALL (yesil/sari/kirmizi). FAIL varsa exit 1.
//   [A] TSC        : npx tsc --noEmit -> 0 hata = PASS
//   [B] test:is8   : npm run test:is8 -> tum vakalar gecti = PASS (gercek sayi yazilir)
//   [C] TENANT SEMA: migrations/tenant create-table seti vs canli information_schema
//                    (tsql.js ile AYNI mekanizma/kimlik: tenant.env; KIMLIK HARDCODE YOK).
//                    tenant.env yoksa WARN-skip (crash yok).
//   [D] SABIT-MARKA: src/** (scripts/, *.md, node_modules HARIC) sabit tenant literal taramasi.
//
// NOT: [D] yalniz src/ tarar -> bu dosyanin kendi NEEDLES listesi false-positive URETMEZ.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

const results = [];
const add = (id, name, status, line) => results.push({ id, name, status, line });

// ─────────────────────────────── [A] TSC ───────────────────────────────
function checkTsc() {
  const r = spawnSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', shell: true });
  const ok = r.status === 0;
  add('A', 'TSC', ok ? 'PASS' : 'FAIL', ok ? 'tip-kontrolu temiz (0 hata)' : `tsc EXIT ${r.status} (hata var)`);
}

// ────────────────────────────── [B] test:is8 ──────────────────────────────
function checkTests() {
  const r = spawnSync('npm', ['run', 'test:is8'], { cwd: ROOT, encoding: 'utf8', shell: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  let pass = 0, total = 0;
  for (const m of out.matchAll(/(\d+)\/(\d+)\s+PASS/g)) { pass += +m[1]; total += +m[2]; }
  const files = out.match(/(\d+)\/(\d+)\s+dosya gecti/);
  const ok = r.status === 0 && total > 0 && pass === total;
  add('B', 'test:is8', ok ? 'PASS' : 'FAIL', `${pass}/${total} vaka${files ? `, ${files[0]}` : ''}`);
}

// ──────────────────────────── [C] TENANT SEMA ────────────────────────────
const EXEC_SQL_JSON = `
CREATE OR REPLACE FUNCTION public.exec_sql_json(query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE result jsonb;
BEGIN
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$fn$;`;

async function checkTenantSchema() {
  // GEREKLI: migrations/tenant/*.sql icindeki tum create-table adlari
  const migDir = join(ROOT, 'migrations', 'tenant');
  const required = new Set();
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(migDir, f), 'utf8');
    // `\s*\(` sart: gercek "CREATE TABLE name (" yakalanir; "-- ... CREATE TABLE IF NOT EXISTS,"
    // yorumunda parantez YOK -> "if" gibi keyword false-positive'i elenir.
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["'`]?(\w+)["'`]?\s*\(/gi)) {
      required.add(m[1].toLowerCase());
    }
  }

  // MEVCUT: tenant DB (tsql.js ile AYNI mekanizma/kimlik — tenant.env; KIMLIK HARDCODE YOK)
  const envPath = process.env.TENANT_ENV || 'C:/Users/ozgur/hg-scratch/tenant.env';
  if (!existsSync(envPath)) {
    add('C', 'TENANT SEMA', 'WARN', `tenant.env yok (${envPath}) -> DB kontrolu atlandi; GEREKLI ${required.size} tablo (migration)`);
    return;
  }
  const env = {};
  for (const ln of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const mm = ln.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (mm) env[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  const url = env.TENANT_URL;
  const key = env.TENANT_SERVICE_KEY;
  if (!url || !key) {
    add('C', 'TENANT SEMA', 'WARN', 'tenant.env icinde TENANT_URL / TENANT_SERVICE_KEY eksik -> atlandi');
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: fnErr } = await db.rpc('exec_sql', { sql: EXEC_SQL_JSON });
    if (fnErr) throw new Error(`exec_sql_json kurulamadi: ${fnErr.message}`);
    try { await db.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }); } catch { /* yoksay */ }

    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const callJson = async (query, tries = 8) => {
      for (let i = 0; i < tries; i++) {
        const { data, error } = await db.rpc('exec_sql_json', { query });
        if (!error) return data;
        if (/schema cache/i.test(error.message || '') && i < tries - 1) { await sleep(1000); continue; }
        throw new Error(error.message);
      }
      return [];
    };

    const tblRows = await callJson("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const present = new Set((tblRows || []).map((r) => String(r.table_name).toLowerCase()));
    const missing = [...required].filter((t) => !present.has(t));
    const linkRows = await callJson('SELECT count(*)::int AS c FROM reservation_links WHERE is_active=true');
    const linkCount = linkRows?.[0]?.c ?? 0;
    const roomRates = present.has('room_rates');

    const ok = missing.length === 0 && linkCount >= 1;
    add('C', 'TENANT SEMA', ok ? 'PASS' : 'FAIL',
      `GEREKLI ${required.size} / MEVCUT ${present.size}; migration-eksik: [${missing.join(', ') || 'yok'}]; ` +
      `reservation_links(aktif)=${linkCount}${linkCount >= 1 ? '' : ' (<1 UYARI)'}; ` +
      `room_rates=${roomRates ? 'VAR' : 'YOK (IS11 bosluk: kod hotel-context sorguluyor)'}`);
  } catch (e) {
    add('C', 'TENANT SEMA', 'WARN', `DB erisilemedi -> atlandi: ${e.message}`);
  }
}

// ─────────────────────────── [D] SABIT-MARKA TARAMASI ───────────────────────────
const NEEDLES = [
  'Regnum', 'Barboon', 'bnhotels', 'BN Hotel', 'BN_HOTELS', 'jsvtswxuigvmlfxhqhjz',
  '8504961295', '8940532150', '758605940',
  '-5499358971', '-5305818738', '-5366737876', '-5483118599',
  '-5538957680', '-5300956372', '-5353858826',
  'regnum-hotels-belek', 'v5-pro-test-oteli',
  '6f2ec28a-4206-4c9c-a9b9-bc3156aca65d', 'bnhotels.com.tr',
];

function walkSrc(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSrc(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

function checkHardcoded() {
  const files = walkSrc(join(ROOT, 'src'));
  const hits = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((ln, i) => {
      for (const n of NEEDLES) {
        if (ln.includes(n)) hits.push({ file: rel(f), line: i + 1, needle: n, text: ln.trim().slice(0, 100) });
      }
    });
  }
  add('D', 'SABIT-MARKA', hits.length === 0 ? 'PASS' : 'FAIL',
    hits.length === 0 ? '0 sabit-marka isabeti' : `${hits.length} isabet (asagida listeleniyor)`);
  return hits;
}

// ─────────────────────────────────── main ───────────────────────────────────
(async () => {
  console.log('HOTELGEN DOCTOR — kontrol asistani\n');
  checkTsc();
  checkTests();
  await checkTenantSchema();
  const hits = checkHardcoded();

  for (const r of results) {
    console.log(`[${r.id}] ${r.name.padEnd(12)}: ${r.status.padEnd(4)} | ${r.line}`);
  }
  if (hits.length > 0) {
    console.log('\n[D] SABIT-MARKA ISABETLERI:');
    for (const h of hits) console.log(`  ${h.file}:${h.line}  <${h.needle}>  ${h.text}`);
  }

  const anyFail = results.some((r) => r.status === 'FAIL');
  const anyWarn = results.some((r) => r.status === 'WARN');
  const overall = anyFail ? 'KIRMIZI (FAIL)' : anyWarn ? 'SARI (WARN)' : 'YESIL (PASS)';
  console.log(`\nOVERALL: ${overall}`);
  process.exit(anyFail ? 1 : 0);
})();
