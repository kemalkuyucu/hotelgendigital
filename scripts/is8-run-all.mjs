/**
 * IS 8 kanonik test korpusu kosucusu — `npm run test:is8`.
 *
 * scripts/is8-*-test.ts dosyalarini OTOMATIK bulur ve tek tek kosar (yeni bir test
 * eklerken burayi duzenlemek GEREKMEZ; sadece is8-<konu>-test.ts adiyla ekle).
 *
 * Kapsam: bayrak/karar seviyesi. Testler GERCEK modulleri import eder (kopya
 * fonksiyon YASAK) ve ag/LLM cagrisi YAPMAZ -> API anahtari gerekmez.
 * Telegram butonu, gercek forward karti ve misafire giden LLM metni burada
 * DOGRULANAMAZ; onlar canli UAT konusudur.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(scriptsDir)
  .filter((f) => /^is8-.*-test\.ts$/.test(f))
  .sort();

if (files.length === 0) {
  console.error('IS 8 test dosyasi bulunamadi (scripts/is8-*-test.ts).');
  process.exit(1);
}

// tsx'i CLI girdisinden node ile kosariz: shell YOK (Windows'ta .cmd spawn sorunu ve
// "shell:true + args" deprecation uyarisi olmaz), yol platformdan bagimsiz.
const root = join(scriptsDir, '..');
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const failed = [];
for (const file of files) {
  console.log(`\n──────── ${file} ────────`);
  const res = spawnSync(process.execPath, [tsxCli, join(scriptsDir, file)], {
    stdio: 'inherit',
    cwd: root,
  });
  if (res.status !== 0) failed.push(file);
}

console.log('\n════════ IS 8 KORPUS ════════');
console.log(`${files.length - failed.length}/${files.length} dosya gecti`);
if (failed.length > 0) {
  console.log(`DUSEN: ${failed.join(', ')}`);
  process.exit(1);
}
