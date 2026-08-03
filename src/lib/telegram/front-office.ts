import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ON BURO (front_office) GRUP chat_id'si — TEK KAYNAK (backlog #6).
 *
 * KOK SORUN: ayni dort satir (`departments` -> `.eq('code','front_office')` ->
 * `telegram_chat_id` -> null guard) ALTI ayri yerde ELLE tekrarlaniyordu. Kopyalar
 * bugun ayni davranisi uretiyor (o yuzden sessiz risk DEGIL), ama yedincisi
 * yazildiginda biri sessizce kayabilir — §3 "tekrarlanan karar tek kaynakta".
 *
 * DONUS: HAM string (`telegram_chat_id` bigint'tir, supabase-js STRING dondurur)
 * ya da null. COERCE BURADA YAPILMAZ: cagri yerlerinin bir kismi Telegram API'ye
 * `Number(...)` ile gonderiyor, bir kismi ham degeri kayda yaziyor — donusumu
 * cagirana birakmak mevcut davranisi BIREBIR korur.
 *
 * null = "chat_id yok": satir yok · kolon bos · DB hatasi. Cagri yerlerinin TAMAMI
 * zaten `if (!chatId)` ile bu duruma dallaniyordu; falsy degerler (0 / '') de burada
 * null'a katlanir ki eski `!chatId` guard'i ile sonuc AYNI kalsin.
 *
 * `error` BILINCLI olarak okunmuyor/loglanmiyor — kopyalarin hicbiri okumuyordu;
 * supabase-js hatada `data: null` doner, o da null'a duser. Fazladan log ya da
 * try/catch eklemek DAVRANIS DEGISIKLIGI olurdu (bu sevk salt konsolidasyon).
 *
 * KAPSAM DISI (bilincli): ayni satirdan BASKA kolon da ceken cagri yerleri bu
 * helper'i KULLANMAZ — tek sorguyu ikiye bolerdi:
 *   · route.ts [reverify-forward] -> `telegram_chat_id, sla_minutes`
 *   · sla/check-runner.ts         -> `telegram_chat_id, reception_sla_minutes`
 *   · sla/handle-callback.ts      -> `telegram_chat_id, display_name` + `.eq('is_enabled', true)`
 */
export async function getFrontOfficeChatId(supa: SupabaseClient): Promise<string | null> {
  const { data } = await supa
    .from('departments')
    .select('telegram_chat_id')
    .eq('code', 'front_office')
    .maybeSingle();

  const raw = (data as { telegram_chat_id?: string | number | null } | null)?.telegram_chat_id;
  return raw ? String(raw) : null;
}
