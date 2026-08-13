/**
 * Otel KALICI SILME (purge) — TEK KAYNAK.
 *
 * Hem CRON (otomatik, retention dolunca) hem PANEL ("Kalici Sil") bu modulu
 * cagirir. Ikinci bir silme yolu YAZILMAZ: silme sirasi tek yerde yasamazsa
 * biri gunun birinde bir tabloyu atlar ve yetim satir birakir.
 *
 * NE SILER: Central'daki otel satiri + ona bagli Central kayitlari.
 * NE SILMEZ:
 *   - Otelin KENDI Supabase PROJESI (tenant DB). Onu silmek Supabase Management
 *     API'si ister; burada YAPILMAZ. Proje referansi hotel_purge_log'a yazilir ki
 *     "hangi proje ortada kaldi" sorusu cevapsiz kalmasin.
 *   - audit_log SATIRLARI. Denetim izi silinmez; yalniz hotel_id NULL'lanir
 *     (kayit KORUNUR, silinmis otele isaret eden bagi kalkar).
 *
 * ISLEM (transaction) YOK: supabase-js cok-deyimli transaction ACAMAZ. Bunun
 * yerine MEZAR TASI ONCE yazilir (note='planned') -> silmeler kosar -> log
 * kapatilir. Boylece surec ortasinda dusulse bile geride "ne yapilmaya
 * calisiliyordu" kaydi KALIR (§3 SESSIZ YUTMA YASAGI'nin veri tarafi).
 */

import { getCentralSupabase } from '@/lib/supabase-client';
import { decryptCredential } from '@/lib/encryption';
import { purgeInfo, isPurgeDue, PURGE_RETENTION_DAYS } from '@/lib/hotels/retention';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Bir kosuda silinecek EN FAZLA otel. Fazlasi sonraki kosuya kalir (WARN loglanir). */
export const PURGE_BATCH_CAP = 5;

/** Log'a ve panele giden sabit hatirlatma — tenant projesi ELDE kalir. */
const MANUAL_PROJECT_NOTE = 'Supabase projesi elle silinecek';

export interface PurgeQueueItem {
  id: string;
  slug: string;
  name: string;
  deleted_at: string;
  deleted_by: string | null;
  purge_hold: boolean;
  /** Sunucu saatiyle hesaplandi — istemci saatine ASLA guvenilmez. */
  days_left: number;
  purge_at: string;
  due: boolean;
}

export type PurgeFailReason = 'not_found' | 'not_deleted' | 'hold' | 'db_error';

export type PurgeResult =
  | { ok: true; slug: string; purgeLogId: string | null; centralDeleted: Record<string, number> }
  | { ok: false; slug: string; reason: PurgeFailReason; step?: string };

/** Hangi adimda dusuldugunu tasiyan hata — mesaj ISTEMCIYE GITMEZ, log'a gider. */
class PurgeStepError extends Error {
  constructor(readonly step: string, message: string) {
    super(message);
    this.name = 'PurgeStepError';
  }
}

/**
 * Silme SIRASI — bagli kayitlar ONCE, otel satiri EN SON.
 * Central'da bu tablolarda FK YOKTUR (central/010: "hotels soft-delete
 * edilebiliyor, CASCADE istemeyiz") -> temizlik UYGULAMA katmaninin isidir.
 * FK sonradan eklenirse de bu sira dogru kalir.
 */
const DEPENDENT_TABLES = ['channel_routing', 'bridge_credentials', 'group_hotel_links'] as const;

/** `https://<ref>.supabase.co` -> `<ref>`. Cozulemezse null (fail-safe). */
function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const first = host.split('.')[0];
    return first && first !== 'supabase' ? first : null;
  } catch {
    return null;
  }
}

/** Tenant projesinin referansini bridge SILINMEDEN ONCE okur. Basarisizlik AKISI KIRMAZ. */
async function readProjectRef(supa: SupabaseClient, hotelId: string): Promise<string | null> {
  try {
    const { data } = await supa
      .from('bridge_credentials')
      .select('supabase_url_encrypted')
      .eq('hotel_id', hotelId)
      .maybeSingle();
    const enc = data?.supabase_url_encrypted as string | undefined;
    if (!enc) return null;
    // NOT: cozulen URL LOGLANMAZ; yalnizca proje referansi (public bir tanimlayici) tutulur.
    return projectRefFromUrl(await decryptCredential(enc));
  } catch {
    return null;
  }
}

async function deleteByHotelId(supa: SupabaseClient, table: string, hotelId: string): Promise<number> {
  const { data, error } = await supa.from(table).delete().eq('hotel_id', hotelId).select('id');
  if (error) throw new PurgeStepError(table, `${error.code ?? '?'} ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Soft-deleted otellerin kalici-silme kuyrugu. Geri sayim SUNUCUDA hesaplanir.
 * Bozuk `deleted_at` tasiyan satir kuyruga GIRMEZ (purgeInfo fail-safe).
 */
export async function listPurgeQueue(now: Date): Promise<PurgeQueueItem[]> {
  const supa = getCentralSupabase();
  const { data, error } = await supa
    .from('hotels')
    .select('id, name, slug, deleted_at, deleted_by, purge_hold')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: true });

  if (error) {
    console.error('[hotel-purge] kuyruk sorgusu hatasi:', error.code, error.message);
    throw new Error('purge kuyrugu okunamadi');
  }

  const out: PurgeQueueItem[] = [];
  for (const row of data ?? []) {
    const info = purgeInfo(row.deleted_at as string, now);
    if (!info.deleted || !info.purgeAt || info.daysLeft === null) {
      console.warn('[hotel-purge] deleted_at okunamadi, kuyruga alinmadi slug=', row.slug);
      continue;
    }
    out.push({
      id: row.id as string,
      slug: row.slug as string,
      name: (row.name as string) ?? (row.slug as string),
      deleted_at: row.deleted_at as string,
      deleted_by: (row.deleted_by as string) ?? null,
      purge_hold: row.purge_hold === true,
      days_left: info.daysLeft,
      purge_at: info.purgeAt.toISOString(),
      due: isPurgeDue({ deleted_at: row.deleted_at as string, purge_hold: row.purge_hold as boolean }, now),
    });
  }
  return out;
}

/**
 * TEK oteli kalici siler.
 *
 * GUARD'LAR (sirayla):
 *   - otel yok            -> not_found
 *   - deleted_at NULL     -> not_deleted (soft-delete edilmemis otel ASLA purge edilmez)
 *   - mode='auto' + hold  -> hold (otomatik yol kilidi ASMAZ)
 *   - mode='auto' + vade dolmamis -> not_deleted degil, `hold` da degil: `db_error`
 *     yerine acik bir red donmesi icin retention kontrolu de burada yapilir.
 *   - mode='manual'       -> hold'u ASAR, ama note'a YAZAR ve retention'i beklemez
 *     (super admin bilincli olarak "simdi sil" dedi).
 */
export async function purgeHotel(params: {
  slug: string;
  mode: 'auto' | 'manual';
  actor: string;
  now: Date;
}): Promise<PurgeResult> {
  const { slug, mode, actor, now } = params;
  const supa = getCentralSupabase();

  // ── 1) Satiri oku + guard'lar ────────────────────────────────────────────
  const { data: hotel, error: selErr } = await supa
    .from('hotels')
    .select('id, name, slug, deleted_at, purge_hold')
    .eq('slug', slug)
    .maybeSingle();

  if (selErr) {
    console.error('[hotel-purge] adim=select slug=%s hata=%s %s', slug, selErr.code, selErr.message);
    return { ok: false, slug, reason: 'db_error', step: 'select' };
  }
  if (!hotel) return { ok: false, slug, reason: 'not_found' };

  const deletedAt = (hotel.deleted_at as string) ?? null;
  if (!deletedAt) return { ok: false, slug, reason: 'not_deleted' };

  const held = hotel.purge_hold === true;
  if (mode === 'auto') {
    if (held) return { ok: false, slug, reason: 'hold' };
    if (!isPurgeDue({ deleted_at: deletedAt, purge_hold: false }, now)) {
      // Cron kuyrugu zaten filtreliyor; bu ikinci kapi yaris/bayat veri icin.
      return { ok: false, slug, reason: 'not_deleted', step: 'retention' };
    }
  }

  const hotelId = hotel.id as string;
  const hotelName = (hotel.name as string) ?? null;
  const info = purgeInfo(deletedAt, now);

  // ── 2) Proje referansini bridge SILINMEDEN ONCE oku ──────────────────────
  const projectRef = await readProjectRef(supa, hotelId);

  // ── 3) MEZAR TASI ONCE (transaction yok -> yarim kalirsa iz KALIR) ───────
  const noteParts = [MANUAL_PROJECT_NOTE];
  if (mode === 'manual' && held) noteParts.push('purge_hold ASILDI (manuel silme)');
  if (mode === 'manual' && !info.due) {
    noteParts.push(`retention DOLMADAN silindi (kalan ${info.daysLeft ?? '?'} gun / ${PURGE_RETENTION_DAYS})`);
  }

  const { data: logRow, error: logErr } = await supa
    .from('hotel_purge_log')
    .insert({
      hotel_id: hotelId,
      slug,
      hotel_name: hotelName,
      deleted_at: deletedAt,
      purged_by: actor,
      mode,
      supabase_project_ref: projectRef,
      note: `planned — ${noteParts.join(' · ')}`,
    })
    .select('id')
    .maybeSingle();

  if (logErr) {
    console.error('[hotel-purge] adim=plan_log slug=%s hata=%s %s', slug, logErr.code, logErr.message);
    return { ok: false, slug, reason: 'db_error', step: 'plan_log' };
  }
  const purgeLogId = (logRow?.id as string) ?? null;

  // ── 4) Bagli kayitlar -> otel satiri ─────────────────────────────────────
  const centralDeleted: Record<string, number> = {};
  try {
    for (const table of DEPENDENT_TABLES) {
      centralDeleted[table] = await deleteByHotelId(supa, table, hotelId);
    }

    // audit_log SILINMEZ — yalniz bag koparilir (denetim izi korunur).
    const { data: detached, error: detachErr } = await supa
      .from('audit_log')
      .update({ hotel_id: null })
      .eq('hotel_id', hotelId)
      .select('id');
    if (detachErr) throw new PurgeStepError('audit_detach', `${detachErr.code ?? '?'} ${detachErr.message}`);
    centralDeleted['audit_log_detached'] = detached?.length ?? 0;

    const { data: gone, error: hotelErr } = await supa
      .from('hotels')
      .delete()
      .eq('id', hotelId)
      .select('id');
    if (hotelErr) throw new PurgeStepError('hotels', `${hotelErr.code ?? '?'} ${hotelErr.message}`);
    centralDeleted['hotels'] = gone?.length ?? 0;
  } catch (err) {
    const step = err instanceof PurgeStepError ? err.step : 'unknown';
    const detail = err instanceof Error ? err.message : String(err);
    // Istemciye DETAY gitmez; server log'u hangi adimda kalindigini soyler.
    console.error('[hotel-purge] KISMI HATA slug=%s adim=%s detay=%s', slug, step, detail);
    if (purgeLogId) {
      await supa
        .from('hotel_purge_log')
        .update({
          central_deleted: centralDeleted,
          note: `BASARISIZ adim=${step} — ELLE TEMIZLIK GEREKIR · ${noteParts.join(' · ')}`,
        })
        .eq('id', purgeLogId);
    }
    return { ok: false, slug, reason: 'db_error', step };
  }

  // ── 5) Mezar tasini kapat ────────────────────────────────────────────────
  if (purgeLogId) {
    const { error: closeErr } = await supa
      .from('hotel_purge_log')
      .update({ central_deleted: centralDeleted, note: noteParts.join(' · ') })
      .eq('id', purgeLogId);
    if (closeErr) {
      // Silme GERCEKLESTI; yalniz not guncellenemedi -> yutma, ama basarisiz sayma.
      console.error('[hotel-purge] adim=close_log slug=%s hata=%s %s', slug, closeErr.code, closeErr.message);
    }
  }

  // ── 6) Denetim kaydi ─────────────────────────────────────────────────────
  const { error: auditErr } = await supa.from('audit_log').insert({
    actor_type: 'master_admin',
    actor_username: actor,
    action: mode === 'auto' ? 'hotel.purge.auto' : 'hotel.purge.manual',
    resource_type: 'hotel',
    resource_id: hotelId,
    hotel_id: null, // otel satiri ARTIK YOK
    details: {
      hotel_slug: slug,
      hotel_name: hotelName,
      deleted_at: deletedAt,
      central_deleted: centralDeleted,
      supabase_project_ref: projectRef,
      note: noteParts.join(' · '),
    },
  });
  if (auditErr) {
    console.error('[hotel-purge] adim=audit slug=%s hata=%s %s', slug, auditErr.code, auditErr.message);
  }

  console.log('[hotel-purge] TAMAM slug=%s mode=%s adimlar=%s', slug, mode, JSON.stringify(centralDeleted));
  return { ok: true, slug, purgeLogId, centralDeleted };
}

export interface PurgeRunSummary {
  checked: number;
  due: number;
  purged: string[];
  failed: Array<{ slug: string; reason: PurgeFailReason; step?: string }>;
  deferred: string[];
  held: string[];
}

/**
 * CRON girisi: vadesi dolan otelleri siler. Bir kosuda EN FAZLA
 * `PURGE_BATCH_CAP` otel; fazlasi WARN loglanir ve sonraki kosuya kalir
 * (sessiz kirpma YASAK — atlanan slug'lar `deferred` icinde de doner).
 */
export async function purgeDueHotels(params: { now: Date; actor: string }): Promise<PurgeRunSummary> {
  const { now, actor } = params;
  const queue = await listPurgeQueue(now);
  const dueItems = queue.filter((q) => q.due);
  const held = queue.filter((q) => q.purge_hold && !q.due).map((q) => q.slug);
  const heldOverdue = queue
    .filter((q) => q.purge_hold && purgeInfo(q.deleted_at, now).due)
    .map((q) => q.slug);

  const batch = dueItems.slice(0, PURGE_BATCH_CAP);
  const deferred = dueItems.slice(PURGE_BATCH_CAP).map((q) => q.slug);
  if (deferred.length > 0) {
    console.warn(
      '[hotel-purge] BATCH CAP %d asildi: %d otel sonraki kosuya kaldi (%s)',
      PURGE_BATCH_CAP,
      deferred.length,
      deferred.join(', '),
    );
  }
  if (heldOverdue.length > 0) {
    console.warn('[hotel-purge] purge_hold ACIK, vadesi gecmis otel ATLANDI: %s', heldOverdue.join(', '));
  }

  const purged: string[] = [];
  const failed: PurgeRunSummary['failed'] = [];
  for (const item of batch) {
    const res = await purgeHotel({ slug: item.slug, mode: 'auto', actor, now });
    if (res.ok) purged.push(res.slug);
    else failed.push({ slug: res.slug, reason: res.reason, step: res.step });
  }

  return {
    checked: queue.length,
    due: dueItems.length,
    purged,
    failed,
    deferred,
    held: [...new Set([...held, ...heldOverdue])],
  };
}
