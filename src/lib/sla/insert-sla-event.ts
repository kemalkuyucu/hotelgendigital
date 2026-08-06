import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { isUniqueViolation } from '@/lib/utils/pg-error';
import { notifyDuplicateRequest } from './notify-duplicate';

/**
 * sla_events INSERT'inin TEK KAYNAGI + 23505 (UNIQUE) BACKSTOP'u.
 *
 * KOK SORUN (§3 tekrarlanan karar tek kaynakta): ayni INSERT + `.select('id')
 * .single()` + hata dali DORT ayri yerde elle yaziliydi (F&B siparis onayi,
 * housekeeping forward, genel forward, re-verify forward). Dordu de ayni sekli
 * uretiyordu; besincisi yazildiginda biri sessizce kayardi. Ustelik DB-seviyesi
 * bir cift-kayit korumasi eklenecekse (partial UNIQUE index) ihlali YAKALAYAN
 * dalin da tek yerde yasamasi gerekir — bugun repoda `sla_events` yolunda HIC
 * 23505 yakalama YOK.
 *
 * BUGUN 23505 DALI OLU KODDUR: `migrations/tenant/031` HENUZ UYGULANMADI, yani
 * tabloda PK disinda benzersizlik yok ve `isUniqueViolation` asla true donmez.
 * Dolayisiyla bu gecis DAVRANIS-KORUYUCUDUR; dal ancak index uygulandiginda
 * canlanir. Index uygulanmadan once/sonra AYNI kod kosar — surum ayrimi YOK.
 *
 * FAIL-SAFE YONU (§3): backstop bir talebi ASLA sessizce dusurmez. 23505'te
 * (i) cakisan ACIK kart bulunur ve `onDuplicate` ile personele iz birakilir
 * (SESSIZ YUTMA YASAGI), (ii) cagirana `duplicate: true` doner — ne yapacagina
 * (misafire ne denecegi, dongude `continue` mi return mi) CAGIRAN karar verir;
 * her akisin bugunku dedup dali farklidir, helper onu genellestirmez.
 */

/** sla_events'e yazilan satir — dort cagri yerinin ORTAK payload'i (BIREBIR). */
export type SlaEventInsert = {
  conversation_id: string;
  inhouse_guest_id: string | null;
  department_code: string;
  department_chat_id: string;
  request_text: string;
  room_number: string | null;
  guest_full_name: string;
  forwarded_at: string;
  sla_deadline: string;
};

/** 23505'te bulunan cakisan ACIK kart (personel bildirimi bunun altina duser). */
export type OpenSlaConflict = {
  id: string;
  department_chat_id: string | null;
  department_message_id: number | null;
};

export type InsertSlaEventResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: true }
  | { ok: false; duplicate: false; error: PostgrestError | null };

/**
 * Cakisan ACIK kayit sorgusu — 031 index'inin kosuluyla AYNI kume:
 *   (conversation_id, department_code, request_text) + responded_at/closed_at NULL.
 *
 * Index `md5(request_text)` uzerinden benzersizlik kurar; PostgREST filtrede
 * fonksiyon cagiramadigi icin burada TAM METIN esitligi kullanilir. Ayni satirlari
 * secer (md5 esitligi metin esitliginin uygulamadaki karsiligidir); fark yalnizca
 * index'in daha kisa anahtar tutmasidir.
 *
 * `.order().limit(1).maybeSingle()` deseni PGRST116'yi onler (§4).
 */
async function findOpenConflict(
  supa: SupabaseClient,
  row: SlaEventInsert,
): Promise<OpenSlaConflict | null> {
  const { data, error } = await supa
    .from('sla_events')
    .select('id, department_chat_id, department_message_id')
    .eq('conversation_id', row.conversation_id)
    .eq('department_code', row.department_code)
    .eq('request_text', row.request_text)
    .is('responded_at', null)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Cakisma VAR ama acik kart bulunamadi: bildirim reply'siz gider (fallback
    // chat id ile), akis KIRILMAZ. PII yok — request_text loglanmaz.
    console.error('[sla-insert] cakisan acik kart sorgusu hatasi:', error.message);
    return null;
  }
  return (data as OpenSlaConflict | null) ?? null;
}

export async function insertSlaEvent(
  supa: SupabaseClient,
  row: SlaEventInsert,
  onDuplicate?: (existing: OpenSlaConflict | null) => Promise<void>,
): Promise<InsertSlaEventResult> {
  const { data, error } = await supa
    .from('sla_events')
    .insert(row)
    .select('id')
    .single();

  if (isUniqueViolation(error)) {
    const existing = await findOpenConflict(supa, row);
    if (onDuplicate) {
      try {
        await onDuplicate(existing);
      } catch (e) {
        // Bildirim hatasi karari DEGISTIRMEZ: satir zaten yazilmadi.
        console.error('[sla-insert] onDuplicate hatasi:', e instanceof Error ? e.message : e);
      }
    }
    console.log('[sla-insert] 23505 UNIQUE — yeni kart acilmadi', {
      conversationId: row.conversation_id,
      dept: row.department_code,
      openConflictId: existing?.id ?? null,
    });
    return { ok: false, duplicate: true };
  }

  if (error || !data) {
    return { ok: false, duplicate: false, error: error ?? null };
  }
  return { ok: true, id: data.id as string };
}

/**
 * 23505 dalinin STANDART bildirimi — "cakisan acik kartin altina reply" karari
 * TEK YERDE. Cagri yeri yalnizca kendi baglamini (botToken + o departmanin
 * fallback chat id'si + tekrarlanan metin) verir; dort sitede ayni cagri
 * kopyalanmaz.
 *
 * `existing` null ise (kart bulunamadi / sorgu hatasi) bildirim reply'siz ama
 * YINE DE gider — SESSIZ YUTMA YASAGI: dusen talep iz birakmali.
 */
export function notifyOpenDuplicate(
  botToken: string,
  fallbackChatId: string | null,
  repeatText: string,
  repeatTextTr?: string | null,
): (existing: OpenSlaConflict | null) => Promise<void> {
  return async (existing) => {
    const chatId = existing?.department_chat_id ?? fallbackChatId;
    if (!chatId) {
      console.warn('[sla-insert] duplicate bildirimi atlandi — chat_id yok');
      return;
    }
    await notifyDuplicateRequest({
      botToken,
      chatId,
      messageId: existing?.department_message_id ?? null,
      repeatText,
      repeatTextTr,
    });
  };
}
