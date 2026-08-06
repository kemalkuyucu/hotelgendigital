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
 * COK-KOLONLU cagri yerleri icin `getFrontOfficeRow` (asagida) vardir — onlari
 * bu fonksiyona baglamak TEK sorguyu IKIYE bolerdi (backlog #20).
 */
export async function getFrontOfficeChatId(supa: SupabaseClient): Promise<string | null> {
  const row = await getFrontOfficeRow<{ telegram_chat_id?: string | number | null }>(
    supa,
    'telegram_chat_id',
  );
  const raw = row?.telegram_chat_id;
  return raw ? String(raw) : null;
}

/**
 * ON BURO SATIRI, ISTENEN KOLONLARLA — cok-kolonlu cagri yerleri icin (backlog #20).
 *
 * KOK SORUN: `getFrontOfficeChatId` (yukarisi) yalniz chat_id ceker; ayni satirdan
 * BASKA kolon da isteyen uc cagri yeri (asagida) ona BAGLANAMIYOR ve "departments +
 * code='front_office'" desenini ELLE tekrarliyordu. Bu fonksiyon lookup'in SEKLINI
 * (tablo · filtre · maybeSingle · error'u okumama) tek kaynakta toplar; SECILEN
 * KOLONLARI cagirana birakir, boylece tek sorgu TEK KALIR.
 *
 * `enabledOnly` — BILINCLI olarak opsiyonel ve VARSAYILANI false: uc cagri yerinden
 * yalniz `sla/handle-callback.ts` `.eq('is_enabled', true)` filtresini tasir, yani
 * `is_enabled=false` bir on buroda O cagri yeri digerlerinden FARKLI davranir.
 * Bu fark BUGUNKU CANLI DAVRANISTIR; helper'a tasinirken KORUNDU (varsayilan true
 * yapmak sessiz bir davranis degisikligi olurdu).
 *
 * `error` OKUNMAZ — cagri yerlerinin hicbiri okumuyordu; supabase-js hatada
 * `data: null` doner ve hepsi zaten null-guard'a dalleniyor.
 */
export async function getFrontOfficeRow<T>(
  supa: SupabaseClient,
  columns: string,
  opts: { enabledOnly?: boolean } = {},
): Promise<T | null> {
  const base = supa.from('departments').select(columns).eq('code', 'front_office');
  const { data } = await (opts.enabledOnly ? base.eq('is_enabled', true) : base).maybeSingle();
  return (data as T | null) ?? null;
}
