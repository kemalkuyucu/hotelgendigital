/**
 * Siparis metninden urun kodlarini + adetleri deterministik olarak cikarir ve
 * menu_items katalogu ile eslestirir (AI'ya guvenmeden, regex + DB).
 *
 * Kod formati: harf(ler) + rakam(lar) -- RS01, RS12, A5. Case-insensitive.
 * Hic kod yakalanmazsa lines bos doner; cagiran taraf eski (serbest metin)
 * davranisina duser.
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

// Onek adet ("2 RS01", "2x RS01", "2 x RS01") + kod + sonek adet ("RS01 x2", "RS01 *2")
// (?!\d) => "RS01" icinde "RS0" yakalanmaz; rakamlar sonuna kadar yenir.
const ORDER_TOKEN_RE = /(?:(\d{1,3})\s*[x*]?\s*)?\b([a-z]{1,4}\d{1,4})(?!\d)(?:\s*[x*]\s*(\d{1,3}))?/gi;

type CodeQty = { code: string; qty: number };

/** Metinden kodlari + adetleri cikarir. Ayni kod tekrar gecerse adetler toplanir. */
function extractCodes(text: string): CodeQty[] {
  const order: string[] = [];
  const qtyByCode = new Map<string, number>();

  for (const match of text.matchAll(ORDER_TOKEN_RE)) {
    const code = match[2].toUpperCase();
    const qty = Number(match[1] ?? match[3] ?? 1);
    if (!Number.isFinite(qty) || qty < 1) continue;

    if (!qtyByCode.has(code)) order.push(code);
    qtyByCode.set(code, (qtyByCode.get(code) ?? 0) + qty);
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
 * Ham siparis metninden urun kodlarini + adet ifadelerini temizler, geriye
 * misafirin serbest notunu birakir ("2 RS01, sogansiz olsun" -> "sogansiz olsun").
 * Not yoksa bos string doner. Regex ORDER_TOKEN_RE ile ayni temizleme mantigi.
 */
export function extractOrderNote(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/(?:(?:\d{1,3})\s*[x*]?\s*)?\b[a-z]{1,4}\d{1,4}(?!\d)(?:\s*[x*]\s*(?:\d{1,3}))?/gi, ' ')
    .replace(/[,;.\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) return '';
  return cleaned;
}
