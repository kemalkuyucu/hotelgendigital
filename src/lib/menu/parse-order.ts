/**
 * Siparis metninden urun kodlarini + adetleri deterministik olarak cikarir ve
 * menu_items katalogu ile eslestirir (AI'ya guvenmeden, regex + DB).
 *
 * Kod formati: harf(ler) + rakam(lar) -- RS01, RS12, A5. Case-insensitive.
 * Hic kod yakalanmazsa lines bos doner; cagiran taraf eski (serbest metin)
 * davranisina duser.
 *
 * Adet cozumu housekeeping matchHousekeepingItems desenini izler: tum kod
 * occurrence'lari bulunur, her kod icin adet cozulur, TUKETILEN bolge (kod + adedi)
 * isaretlenir; kalan artik = misafirin serbest notu. extractCodes ve extractOrderNote
 * AYNI tokenizasyonu paylasir -> "RS01 2 adet" hem qty=2 verir hem "2 adet"i nottan siler.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ParsedOrderLine = {
  code: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  isBeverage: boolean;
};

export type ParsedOrder = {
  lines: ParsedOrderLine[];
  total: number;
  currency: string;
  unmatched: string[];
};

// Kod: 1-4 harf + 1-4 rakam (RS01). (?!\d) sonraki rakami koda katmaz; \b kod sinirini korur.
const CODE_RE = /\b[a-z]{1,4}\d{1,4}(?!\d)/gi;

type CodeQty = { code: string; qty: number };
type OrderToken = { code: string; qty: number; start: number; end: number };

/**
 * Tum kod occurrence'larini pozisyonlariyla bulur; her kod icin adet cozer ve TUKETILEN
 * [start,end) bolgesini (kod + adedi) dondurur. Adet cozme sirasi (her kod icin):
 *   1) ONCE leading: kodun hemen ONUNDE (max 4 karakter, onceki tokeni asmadan) rakam.
 *   2) YOKSA trailing: kodun hemen ARDINDA (rakam ~6 karakter icinde) rakam + opsiyonel
 *      birim (adet/tane/porsiyon).
 *   3) Trailing rakamin ARDINDAN dogrudan (yalnizca bosluk/x ile) BASKA BIR KOD geliyorsa,
 *      o rakam sonraki kodun leading'idir -> trailing sayilmaz.
 *   4) Hicbiri yoksa qty=1.
 */
function tokenizeOrder(text: string): OrderToken[] {
  const src = text ?? '';
  const rawMatches: { code: string; ci: number; cend: number }[] = [];
  for (const m of src.matchAll(CODE_RE)) {
    if (m.index == null) continue;
    rawMatches.push({ code: m[0].toUpperCase(), ci: m.index, cend: m.index + m[0].length });
  }

  // "RS01 x2" / "A5 X3" -> "x2"/"X3" bir CARPAN (qty) isaretidir, AYRI kod DEGIL. CODE_RE
  // bunu kod sanir (1 harf + rakam); onceki kodu SADECE boslukla takip eden [xX]\d+ tokeni
  // elenir (trailing adet cozumu ham metinden "x2"yi zaten tuketir). Bastaki "X2" gercek kod.
  const MULT_RE = /^[xX]\d{1,3}$/;
  const codeMatches = rawMatches.filter((m, idx) => {
    if (!MULT_RE.test(src.slice(m.ci, m.cend))) return true;
    const prev = rawMatches[idx - 1];
    if (!prev) return true;
    return !/^\s*$/.test(src.slice(prev.cend, m.ci));
  });

  const tokens: OrderToken[] = [];
  let prevEnd = 0; // onceki tokenin tuketilen bolgesinin sonu -> leading penceresini sinirlar
  for (let i = 0; i < codeMatches.length; i++) {
    const { code, ci, cend } = codeMatches[i];
    let qty = 1;
    let start = ci;
    let end = cend;

    // 1) leading: onceki tokeni ASMADAN, kodun onunde max 12 karakter
    //    ("2 adet RS01", "2 porsiyon RS01" sigar; birim kelimesi opsiyonel)
    const before = src.slice(Math.max(0, ci - 12, prevEnd), ci);
    const lead = before.match(/(\d{1,3})\s*(?:adet|tane|porsiyon)?\s*[x*]?\s*$/i);
    if (lead) {
      qty = Number(lead[1]);
      start = ci - lead[0].length;
    } else {
      // 2) trailing: rakam ~6 karakter icinde + opsiyonel birim
      const after = src.slice(cend, cend + 20);
      const trail = after.match(/^\s{0,2}[x*]?\s{0,2}(\d{1,3})\s*(?:adet|tane|porsiyon)?/i);
      if (trail) {
        // 3) rakamdan hemen sonra (yalnizca bosluk/x ile) BASKA KOD geliyorsa -> sonraki
        //    kodun leading'i; trailing sayma
        const afterDigit = cend + trail[0].indexOf(trail[1]) + trail[1].length;
        const next = codeMatches[i + 1];
        const gap = next ? src.slice(afterDigit, next.ci) : null;
        const digitIsNextLeading = next != null && gap != null && /^\s*[x*]?\s*$/i.test(gap);
        if (!digitIsNextLeading) {
          qty = Number(trail[1]);
          end = cend + trail[0].length;
        }
      }
    }
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    tokens.push({ code, qty, start, end });
    prevEnd = end;
  }
  return tokens;
}

/** Kod + adetleri cikarir. Ayni kod tekrar gecerse adetler toplanir. */
function extractCodes(text: string): CodeQty[] {
  const order: string[] = [];
  const qtyByCode = new Map<string, number>();

  for (const t of tokenizeOrder(text ?? '')) {
    if (!qtyByCode.has(t.code)) order.push(t.code);
    qtyByCode.set(t.code, (qtyByCode.get(t.code) ?? 0) + t.qty);
  }

  return order.map((code) => ({ code, qty: qtyByCode.get(code) ?? 1 }));
}

export async function parseOrder(text: string, supa: SupabaseClient): Promise<ParsedOrder> {
  const empty: ParsedOrder = { lines: [], total: 0, currency: 'TRY', unmatched: [] };

  const codes = extractCodes(text ?? '');
  if (codes.length === 0) return empty;

  const { data } = await supa
    .from('menu_items')
    .select('item_code, item_name, price, currency, is_active, is_beverage')
    .eq('is_active', true);

  const catalog = new Map<string, { name: string; price: number; currency: string; isBeverage: boolean }>();
  for (const row of data ?? []) {
    const code = String(row.item_code ?? '').trim().toUpperCase();
    if (!code) continue;
    catalog.set(code, {
      name: row.item_name ?? code,
      price: Number(row.price ?? 0),
      currency: row.currency ?? 'TRY',
      isBeverage: Boolean(row.is_beverage),
    });
  }

  const lines: ParsedOrderLine[] = [];
  const unmatched: string[] = [];
  let currency = '';

  for (const { code, qty } of codes) {
    const item = catalog.get(code);
    if (!item) {
      unmatched.push(code);
      continue;
    }
    if (!currency) currency = item.currency;
    lines.push({
      code,
      name: item.name,
      unitPrice: item.price,
      qty,
      lineTotal: item.price * qty,
      isBeverage: item.isBeverage,
    });
  }

  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { lines, total, currency: currency || 'TRY', unmatched };
}

/**
 * Ham siparis metninden urun kodlarini + adet ifadelerini temizler, geriye misafirin
 * serbest notunu birakir ("RS01 2 adet sogansiz olsun" -> "sogansiz olsun"). Not yoksa
 * bos string doner. extractCodes ile AYNI tokenizasyonu (tokenizeOrder) kullanir:
 * tuketilen [start,end) bolgeleri metinden cikarilir, kalan = not (tek dogruluk kaynagi).
 */
export function extractOrderNote(raw: string): string {
  if (!raw) return '';

  const tokens = tokenizeOrder(raw);
  let out: string;
  if (tokens.length === 0) {
    out = raw; // kod yok -> tuketilecek token yok, ham metin not adayi
  } else {
    const sorted = [...tokens].sort((a, b) => a.start - b.start);
    let acc = '';
    let cursor = 0;
    for (const t of sorted) {
      if (t.start > cursor) acc += raw.slice(cursor, t.start);
      cursor = Math.max(cursor, t.end);
    }
    acc += raw.slice(cursor);
    out = acc;
  }

  const cleaned = out
    .replace(/[,;.\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) return '';
  return cleaned;
}
