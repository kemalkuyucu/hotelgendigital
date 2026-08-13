/**
 * IS 8 — CRON secret dogrulamasi korpusu.
 * GERCEK modul import edilir (kopya fonksiyon YASAK — kopya yesil doner,
 * canli davranisla celisir).
 *
 * `CRON_SECRET` env'i her vakada ACIKCA kurulur/kaldirilir ve SONRA geri
 * yuklenir: kosucunun ortamindan sizan bir deger testi sessizce yesile
 * cevirebilirdi.
 *
 * §6 CIFT-YONLU NEGATIF KONTROL: `legacyInlineAuth` = bu modul YOKKEN iki
 * cron'da duran ELLE yazilmis ikiz (`header !== \`Bearer ${secret}\``).
 * Modulden TURETILMEZ; secret TANIMLIYKEN ayni karari vermek ZORUNDA.
 * TEK bilincli ayrisma "secret YOK" halidir: eski 401, yeni 500 (fail-closed).
 */
import { verifyCronRequest, cronAuthMessage } from '@/lib/cron/verify-cron-secret';

let pass = 0;
const fails: string[] = [];

function check(desc: string, got: unknown, expected: unknown) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${JSON.stringify(got)} (beklenen ${JSON.stringify(expected)})`);
}
function checkTrue(desc: string, cond: boolean) {
  check(desc, cond, true);
}

const SECRET = 'cron-secret-abcdef-0123456789';

/** Gercek `Headers` gibi BUYUK/kucuk harf ayirt etmez. */
function fakeReq(headers: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { headers: { get: (name: string) => lower[name.toLowerCase()] ?? null } };
}

/** env'i vaka suresince kurar, SONRA eski degeri AYNEN geri koyar. */
function withSecret<T>(secret: string | undefined, fn: () => T): T {
  const prev = process.env.CRON_SECRET;
  if (secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secret;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
}

/** console.error'u yutar ve KAC KEZ cagrildigini sayar (iz birakma kontrolu). */
let errorLogCount = 0;
function quiet<T>(fn: () => T): T {
  const real = console.error;
  console.error = () => {
    errorLogCount++;
  };
  try {
    return fn();
  } finally {
    console.error = real;
  }
}

/** status alani yoksa 'ok' doner -> tek bir degerle karsilastirilabilir. */
function statusOf(res: { ok: boolean } & { status?: number }): number | 'ok' {
  return res.ok ? 'ok' : (res.status as number);
}

const goodHeader = { authorization: `Bearer ${SECRET}` };

// ── §1 FAIL-CLOSED: CRON_SECRET YOKSA is KOSMAZ (401 DEGIL, 500) ────────────
const noEnv = quiet(() => withSecret(undefined, () => verifyCronRequest(fakeReq(goodHeader))));
check('1a env yok -> ok false', noEnv.ok, false);
check('1b env yok -> status 500', statusOf(noEnv), 500);

const emptyEnv = quiet(() => withSecret('', () => verifyCronRequest(fakeReq(goodHeader))));
check('1c bos dize env -> 500', statusOf(emptyEnv), 500);

const noEnvNoHeader = quiet(() => withSecret(undefined, () => verifyCronRequest(fakeReq({}))));
check('1d env yok + header yok -> 500 (401 DEGIL)', statusOf(noEnvNoHeader), 500);
checkTrue('1e fail-closed red IZ BIRAKIR (console.error cagrildi)', errorLogCount >= 3);

// ── §2 HEADER YOK / BICIM BOZUK -> 401 ──────────────────────────────────────
const BAD_HEADERS: Array<[string, Record<string, string>]> = [
  ['2a header YOK', {}],
  ['2b bos dize header', { authorization: '' }],
  ['2c "Bearer " oneki EKSIK (ciplak secret)', { authorization: SECRET }],
  ['2d kucuk harf "bearer " oneki', { authorization: `bearer ${SECRET}` }],
  ['2e "Basic " semasi', { authorization: `Basic ${SECRET}` }],
  ['2f "Bearer" + bosluk YOK', { authorization: `Bearer${SECRET}` }],
  ['2g "Bearer " + bos deger', { authorization: 'Bearer ' }],
  ['2h yanlis header adi (x-cron-secret)', { 'x-cron-secret': SECRET }],
];
for (const [desc, headers] of BAD_HEADERS) {
  check(desc, withSecret(SECRET, () => statusOf(verifyCronRequest(fakeReq(headers)))), 401);
}

// ── §3 YANLIS SECRET -> 401 (uzunluk farkinda THROW ETMEZ) ──────────────────
const WRONG_SECRETS: Array<[string, string]> = [
  ['3a tamamen farkli, AYNI uzunluk', 'x'.repeat(SECRET.length)],
  ['3b tek karakter farkli', `${SECRET.slice(0, -1)}X`],
  ['3c DAHA KISA (farkli uzunluk)', SECRET.slice(0, 5)],
  ['3d DAHA UZUN (farkli uzunluk)', `${SECRET}extra`],
  ['3e sonda fazladan bosluk', `${SECRET} `],
  ['3f bosluk + secret (cift bosluk)', ` ${SECRET}`],
];
for (const [desc, value] of WRONG_SECRETS) {
  let threw = false;
  let status: number | 'ok' = 'ok';
  try {
    status = withSecret(SECRET, () => statusOf(verifyCronRequest(fakeReq({ authorization: `Bearer ${value}` }))));
  } catch {
    threw = true;
  }
  check(`${desc}: 401`, status, 401);
  check(`${desc}: THROW ETMEZ`, threw, false);
}

// ── §4 DOGRU SECRET -> ok ───────────────────────────────────────────────────
const okRes = withSecret(SECRET, () => verifyCronRequest(fakeReq(goodHeader)));
check('4a dogru secret -> ok true', okRes.ok, true);
checkTrue('4b ok sonucunda status alani YOK', !('status' in okRes));
check(
  '4c header adi BUYUK harf de olsa okunur',
  withSecret(SECRET, () => statusOf(verifyCronRequest(fakeReq({ Authorization: `Bearer ${SECRET}` })))),
  'ok',
);
check(
  '4d secret icinde bosluk olsa da tam eslesme gecer',
  withSecret('two words secret', () =>
    statusOf(verifyCronRequest(fakeReq({ authorization: 'Bearer two words secret' }))),
  ),
  'ok',
);

// ── §5 ISTEMCIYE DONEN METIN ────────────────────────────────────────────────
check('5a 401 metni', cronAuthMessage(401), 'unauthorized');
check('5b 500 metni', cronAuthMessage(500), 'cron secret not configured');

// ── §6 CIFT-YONLU NEGATIF KONTROL (eski inline kontrolun ELLE yazilmis ikizi) ─
function legacyInlineAuth(header: string | null, secret: string | undefined): 401 | 'ok' {
  if (!secret || header !== `Bearer ${secret}`) return 401;
  return 'ok';
}

const ORACLE_HEADERS: Array<string | null> = [
  null,
  '',
  SECRET,
  `Bearer ${SECRET}`,
  `bearer ${SECRET}`,
  `Bearer ${SECRET} `,
  `Bearer ${SECRET.slice(0, 5)}`,
  `Bearer ${SECRET}extra`,
  `Bearer ${'x'.repeat(SECRET.length)}`,
  'Bearer ',
  `Basic ${SECRET}`,
  `Bearer${SECRET}`,
];
let oracleOk = 0;
let oracle401 = 0;
for (const header of ORACLE_HEADERS) {
  const legacy = legacyInlineAuth(header, SECRET);
  if (legacy === 'ok') oracleOk++;
  else oracle401++;
  const mine = withSecret(SECRET, () =>
    statusOf(verifyCronRequest(fakeReq(header === null ? {} : { authorization: header }))),
  );
  checkTrue(`6-${JSON.stringify(header)}: modul == inline ikiz`, mine === legacy);
}
// Oracle KOR DEGIL: hem gecen hem reddedilen uretmis olmali.
checkTrue('6y oracle en az bir "ok" uretti', oracleOk >= 1);
checkTrue('6z oracle en az bir 401 uretti', oracle401 >= 1);

// TEK BILINCLI AYRISMA: secret YOKKEN eski kod 401 derdi, yeni kod 500 der.
check('6-div eski ikiz: secret yok -> 401', legacyInlineAuth(`Bearer ${SECRET}`, undefined), 401);
check(
  '6-div yeni modul: secret yok -> 500 (fail-closed)',
  statusOf(quiet(() => withSecret(undefined, () => verifyCronRequest(fakeReq(goodHeader))))),
  500,
);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
