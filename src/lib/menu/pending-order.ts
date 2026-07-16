import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * order_pending_text ZARFI — tek kaynak. hk_pending_text damga (v) deseninin
 * (handle-housekeeping-callback.ts) F&B siparis ikizi.
 *
 * Zarf JSON: { v, raw, lines?, total?, currency? }
 *   v        = state damgasi; her yazida artar. Butonlar bu v'yi tasir; callback
 *              bayat/ezilmis butonu (v uyusmaz) reddeder (orderStampAccepts).
 *   raw      = misafirin ham siparis cumlesi (HER ZAMAN yazilir).
 *   lines/total/currency = SADECE kod-bazli sipariste (parseOrder eslesmesi var);
 *              personel kartinda fiyatli ozet + room_service_orders kaydi icin.
 *
 * DIKKAT — ham metin (lines yok) dali "eski kayit" DEGIL: misafir urunu ADIYLA
 * istediginde (kod degil, or. "club sandwich istiyorum") lines olmaz -> structured
 * null. Bu, kodsuz ad-bazli siparisin BIRINCIL canli yoludur. readPendingText
 * garantisi: orderText ASLA ham JSON string olmaz (zarf ici raw'a duser) -> personel
 * kartina JSON blob sizmaz.
 */

export type StructuredOrderLine = {
  code: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type StructuredOrder = {
  raw: string;
  lines: StructuredOrderLine[];
  total: number;
  currency: string;
};

// JSON.parse sinirinda beklenen zarf sekli (tum alanlar opsiyonel — kismi/eski kayit).
type PendingEnvelope = {
  v?: number;
  raw?: string;
  lines?: StructuredOrderLine[];
  total?: number;
  currency?: string;
};

export type ReadPendingResult = {
  v: number | undefined;
  orderText: string;
  structured: StructuredOrder | null;
};

/** Zarfi uretir. raw HER ZAMAN yazilir; lines/total/currency yalniz structured varsa. */
export function buildPendingText(
  v: number,
  raw: string,
  structured: StructuredOrder | null,
): string {
  return JSON.stringify({
    v,
    raw,
    ...(structured
      ? { lines: structured.lines, total: structured.total, currency: structured.currency }
      : {}),
  });
}

/**
 * Zarfi okur — saf/yan-etkisiz (birim testi bunu import eder).
 *   '{' ile baslamiyor VEYA JSON.parse patliyor -> damgasiz eski kayit (ham metin)
 *   JSON + gecerli lines (Array, length>0)       -> structured dolu
 *   JSON + lines yok                             -> structured=null (kodsuz siparis)
 * orderText DAIMA zarf ici raw'a duser (yoksa stored) -> ham JSON string ASLA sizmaz.
 */
export function readPendingText(stored: string | null): ReadPendingResult {
  const trimmed = (stored ?? '').trim();
  if (!trimmed.startsWith('{')) {
    return { v: undefined, orderText: stored ?? '', structured: null };
  }
  let obj: PendingEnvelope;
  try {
    obj = JSON.parse(trimmed) as PendingEnvelope;
  } catch {
    return { v: undefined, orderText: stored ?? '', structured: null };
  }
  const orderText = obj.raw ?? stored ?? '';
  if (Array.isArray(obj.lines) && obj.lines.length > 0) {
    return {
      v: obj.v,
      orderText,
      structured: {
        raw: obj.raw ?? '',
        lines: obj.lines,
        total: Number(obj.total ?? 0),
        currency: obj.currency || 'TRY',
      },
    };
  }
  return { v: obj.v, orderText, structured: null };
}

/**
 * Damga kapisi karari — saf/yan-etkisiz (birim testi bunu import eder).
 * true=KABUL, false=RED. hkStampAccepts ikizi.
 *   ikisi de undefined          -> KABUL (deploy-ani damgasiz eski butonlar)
 *   Number(stampRaw) === stateV -> KABUL (guncel buton)
 *   aksi                        -> RED (bayat/ezilmis buton)
 */
export function orderStampAccepts(
  stampRaw: string | undefined,
  stateV: number | undefined,
): boolean {
  const bothUndefined = stampRaw === undefined && stateV === undefined;
  const stampMatches = stampRaw !== undefined && Number(stampRaw) === stateV;
  return bothUndefined || stampMatches;
}

/** Personel kartinda gorunen ozet — fiyat SADECE burada. */
export function formatOrderSummary(order: StructuredOrder): string {
  const cur = order.currency === 'TRY' ? 'TL' : order.currency;
  const lines = order.lines.map((l) => `• ${l.name} × ${l.qty} = ${l.lineTotal} ${cur}`);
  return `${lines.join('\n')}\n💰 Toplam: ${order.total} ${cur}`;
}

/**
 * order_pending_text'i TAZE okur (null/bozuk guard'li), damgayi +1 artirir, zarfi
 * yazar; yeni v'yi dondurur. AYNI akista uretilen confirm/cancel butonlari bu v'yi
 * tasimali (bkz. orderStampAccepts). Tum yazicilar (route.ts x2, handle-note-callback)
 * bunu kullanir -> tek yazma yolu.
 */
export async function bumpPendingOrder(
  supa: SupabaseClient,
  conversationId: string,
  raw: string,
  structured: StructuredOrder | null,
): Promise<number> {
  const { data: prev } = await supa
    .from('conversations')
    .select('order_pending_text')
    .eq('id', conversationId)
    .maybeSingle();
  const prevText =
    typeof prev?.order_pending_text === 'string' ? prev.order_pending_text : null;
  const v = (readPendingText(prevText).v ?? 0) + 1;
  await supa
    .from('conversations')
    .update({ order_pending: true, order_pending_text: buildPendingText(v, raw, structured) })
    .eq('id', conversationId);
  return v;
}
