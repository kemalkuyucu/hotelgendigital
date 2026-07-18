import { normalizeTr } from '@/lib/utils/normalize-tr';

export interface RaporRange {
  startIso: string;
  endIso: string;
  label: string;
}

const TR_MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
};

const NUM_WORDS: Record<string, number> = {
  bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7,
  sekiz: 8, dokuz: 9, on: 10, onbes: 15, yirmi: 20, otuz: 30,
};

// Turkiye UTC+3 (DST yok): now +3s kaydirilir, UTC getter'lari Istanbul takvim gununu verir.
function istNow(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
interface Ymd { y: number; m: number; d: number; }
function ymd(shifted: Date): Ymd {
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}
function fmtY(p: Ymd): string {
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`; // yil tasiyan token
}
function wordToNum(w?: string): number {
  if (!w) return 1;
  if (/^\d+$/.test(w)) return Number(w);
  return NUM_WORDS[w] ?? 0;
}

/**
 * Metin/sesli ortak: "GG.AA" veya "GG.AA.YYYY" cifti -> ISO aralik.
 * Yil verilmezse simdiki yil; baslangic takvimsel olarak bitisten sonraysa onceki yil
 * (yil-tasmasi, "28.12 03.01"). Yil verilirse (sesli goreli aralik) aynen kullanilir.
 */
export function parseRaporRange(
  arg1?: string,
  arg2?: string,
  now: Date = istNow(),
): RaporRange | null {
  if (!arg1 || !arg2) return null;
  const re = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/;
  const m1 = re.exec(arg1);
  const m2 = re.exec(arg2);
  if (!m1 || !m2) return null;
  const d1 = Number(m1[1]);
  const mo1 = Number(m1[2]);
  const d2 = Number(m2[1]);
  const mo2 = Number(m2[2]);
  if (mo1 < 1 || mo1 > 12 || d1 < 1 || d1 > 31) return null;
  if (mo2 < 1 || mo2 > 12 || d2 < 1 || d2 > 31) return null;
  const endYear = m2[3] ? Number(m2[3]) : now.getUTCFullYear();
  const startYear = m1[3]
    ? Number(m1[3])
    : mo1 > mo2 || (mo1 === mo2 && d1 > d2)
      ? endYear - 1
      : endYear;
  const startDate = new Date(`${startYear}-${pad(mo1)}-${pad(d1)}T00:00:00+03:00`);
  const endDate = new Date(`${endYear}-${pad(mo2)}-${pad(d2)}T23:59:59+03:00`);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    label: `${arg1} - ${arg2}`,
  };
}

/**
 * Sesli yol: dogal Turkce -> parseRaporRange'in tuketecegi tarih dizesi.
 * Hesaplanan (goreli) araliklar YIL TASIYAN "GG.AA.YYYY GG.AA.YYYY" doner (yil sinirinda
 * dogru; Ocak'ta "gecen ay" -> gecen yil Aralik). Ay-adli acik tarihler yilsiz "GG.AA GG.AA".
 * son N gun = (bugun-(N-1))..bugun. Destek: son N gun/hafta/ay, son gun/hafta/ay, son 24 saat,
 * bugun, dun, bu/gecen hafta, bu/gecen ay, tek/cift ay-adi. Yoksa null (-> son 24 saat).
 */
export function parseVoiceDateRange(
  transcribed: string,
  now: Date = istNow(),
): string | null {
  const norm = normalizeTr(transcribed);
  const today = now;
  const pairY = (a: Ymd, b: Ymd) => `${fmtY(a)} ${fmtY(b)}`;

  // gun
  let m = norm.match(/son\s+(?:(\w+)\s+)?gun/);
  if (m) {
    const n = wordToNum(m[1]);
    if (n > 0) return pairY(ymd(addDays(today, -(n - 1))), ymd(today));
  }
  if (/son\s+24\s+saat/.test(norm)) return pairY(ymd(today), ymd(today));
  if (/\bbugun/.test(norm)) return pairY(ymd(today), ymd(today));
  if (/\bdun(ku|den|u)?\b/.test(norm)) {
    const y = ymd(addDays(today, -1));
    return pairY(y, y);
  }

  // hafta
  m = norm.match(/son\s+(?:(\w+)\s+)?hafta/);
  if (m) {
    const n = wordToNum(m[1]);
    if (n > 0) return pairY(ymd(addDays(today, -(7 * n - 1))), ymd(today));
  }
  const dow = (today.getUTCDay() + 6) % 7; // Pazartesi=0
  if (/\bbu\s+hafta/.test(norm)) return pairY(ymd(addDays(today, -dow)), ymd(today));
  if (/\bgecen\s+hafta/.test(norm)) {
    return pairY(ymd(addDays(today, -dow - 7)), ymd(addDays(today, -dow - 1)));
  }

  // ay
  m = norm.match(/son\s+(?:(\w+)\s+)?ay(?:in|i|lik|lar|larin)?\b/);
  if (m) {
    const n = wordToNum(m[1]);
    if (n > 0) {
      const s = new Date(today.getTime());
      s.setUTCMonth(s.getUTCMonth() - n);
      return pairY(ymd(s), ymd(today));
    }
  }
  if (/\bbu\s+ay(?:in|i)?\b/.test(norm)) {
    return pairY({ y: today.getUTCFullYear(), m: today.getUTCMonth() + 1, d: 1 }, ymd(today));
  }
  if (/\bgecen\s+ay(?:in|i)?\b/.test(norm)) {
    const cy = today.getUTCFullYear();
    const cm0 = today.getUTCMonth();
    let py = cy;
    let pm0 = cm0 - 1;
    if (pm0 < 0) { pm0 = 11; py -= 1; }
    const lastDay = new Date(Date.UTC(cy, cm0, 0)).getUTCDate();
    return pairY({ y: py, m: pm0 + 1, d: 1 }, { y: py, m: pm0 + 1, d: lastDay });
  }

  // acik ay-adli tarihler (yilsiz) — BASELINE: cift; YENI: tek
  const monthNames = Object.keys(TR_MONTHS).join('|');
  const re = new RegExp(`(\\d{1,2})\\s+(${monthNames})`, 'g');
  const pairs: { day: number; month: number }[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(norm)) !== null) {
    pairs.push({ day: Number(mm[1]), month: TR_MONTHS[mm[2]] });
  }
  if (pairs.length >= 2) {
    const [a, b] = pairs;
    return `${pad(a.day)}.${pad(a.month)} ${pad(b.day)}.${pad(b.month)}`;
  }
  if (pairs.length === 1) {
    const a = pairs[0];
    return `${pad(a.day)}.${pad(a.month)} ${pad(a.day)}.${pad(a.month)}`;
  }

  return null;
}
