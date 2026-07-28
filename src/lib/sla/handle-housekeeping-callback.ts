import { SupabaseClient } from '@supabase/supabase-js';
import { labelForHousekeepingCode } from '@/lib/ai/department-brains';
import { forwardHousekeepingItems } from './housekeeping-forward';
import { guestText, readPreferredLang, resolvePreferredLang } from '@/lib/i18n/guest-text';

// Housekeeping COKLU esya buton callback'i. State conversations.hk_pending (bool) +
// hk_pending_text (JSON): { items: [{ c, q, a }], i, p?, pl?, v? }
//   c=code, q=qty|null, a=ambiguous, i=su an sorulan esyanin index'i,
//   p=odadaki pax, pl=pax lookup yapildi mi, v=damga (state versiyonu).
//
// callback_data (damga = o karti ureten state'in v'si; legacy butonda yok):
//   hk:s:<code>:<convId>:<v>   -> aktif esyanin TIPI secildi
//   hk:q:<qty>:<convId>:<v>    -> aktif esyanin ADEDI secildi
//   hk:noop                    -> route.ts'te ele aliniyor (buraya gelmez)

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

// callback_data parse — saf/yan-etkisiz (birim testi bunu import eder).
//   hk:<action>:<value>:<convId>:<stamp?>
// convId bir UUID'dir, icinde ':' YOKTUR -> parts[3] tek basina yeterli
// (eski slice(3).join(':') gereksizdi). stamp legacy butonda undefined.
export function parseHkCallbackData(data: string): {
  action: string;
  value: number;
  convId: string;
  stampRaw: string | undefined;
} {
  const parts = data.split(':');
  return { action: parts[1], value: parseInt(parts[2], 10), convId: parts[3], stampRaw: parts[4] };
}

// Damga kapisi karari — saf/yan-etkisiz (birim testi bunu import eder).
// true = KABUL, false = RED.
//   ikisi de undefined            -> KABUL (deploy anindaki damgasiz eski butonlar)
//   Number(stampRaw) === stateV   -> KABUL (guncel buton)
//   aksi                          -> RED (bayat/ezilmis buton)
export function hkStampAccepts(stampRaw: string | undefined, stateV: number | undefined): boolean {
  const bothUndefined = stampRaw === undefined && stateV === undefined;
  const stampMatches = stampRaw !== undefined && Number(stampRaw) === stateV;
  return bothUndefined || stampMatches;
}

interface HkStateItem {
  c: number;
  q: number | null;
  a: boolean;
}
interface HkState {
  items: HkStateItem[];
  i: number;
  p?: number | null; // odadaki kisi sayisi (null = bilinmiyor)
  pl?: boolean; // pax lookup yapildi mi
  v?: number; // damga: her state yazisinda artar; bayat/ezilmis buton reddi icin
  cm?: boolean; // sikayet akisi mi — final forward'da 'sikayet/yenileme' notu icin
}

interface HkCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string;
  callbackChatId: number | string; // butonun basildigi chat (misafir DM)
  callbackMessageId: number;
}

async function answer(token: string, id: string, text: string, showAlert = false) {
  await fetch(TG(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text, ...(showAlert ? { show_alert: true } : {}) }),
  }).catch(() => {});
}

// Butonu tek 'noop'a cevir (order-callback deseni) — cift basim korumasi.
async function editCard(token: string, chatId: number | string, msgId: number, label: string) {
  await fetch(TG(token, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'hk:noop' }]] },
    }),
  }).catch(() => {});
}

async function sendGuest(token: string, chatId: string, text: string) {
  await fetch(TG(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

// State'i i'den bagimsiz olarak tarar: once cozulmemis ilk TIP (a===true), sonra
// ilk ADET (q===null) icin butonla sorar; hepsi tamsa forwardHousekeepingItems.
// route.ts (ilk soru — language TR/EN/DE) ve callback (sonraki sorular — TR) cagirir.
export async function advanceHousekeeping(p: {
  supa: SupabaseClient;
  botToken: string;
  convId: string;
  guestChatId: string | number;
  state: HkState;
  language?: string;
}): Promise<void> {
  const { supa, botToken, convId, guestChatId, state } = p;
  // IS 10 — KALICI DIL: metadata.preferred_language TEK KAYNAK; route.ts'ten gelen
  // `language` (o turda tespit edilen dil) yalnizca FALLBACK. Callback'ten gelindiginde
  // parametre HIC yoktur — eski kod bu yolda sessizce 'tr'ye dusuyordu.
  const { data: langRow } = await supa
    .from('conversations')
    .select('metadata')
    .eq('id', convId)
    .maybeSingle();
  // p.language route.ts'ten gelir ve ARAYUZ dili DEGIL, o turda classify'in mesaj
  // METNINDEN tespit ettigi guestLang'dir (route.ts: advanceHousekeeping cagrisi) —
  // bu yuzden `detected` slotuna verilir: TAZE tespit, metadata'daki kalici (bir
  // onceki turdan kalma) degeri EZMELIDIR. Callback'ten gelindiginde parametre YOKTUR,
  // o zaman stored devreye girer.
  // Fallback 'tr' BILINCLI: hicbir bilgi yoksa (kalici dil henuz yazilmamis ESKI
  // konusma) eski davranis TR idi; 'en'e dusurmek orada regresyon olurdu.
  const lang = resolvePreferredLang({
    detected: p.language,
    stored: readPreferredLang(langRow?.metadata),
    interfaceLang: 'tr',
  });
  const multi = state.items.length > 1;
  const prefixFor = (idx: number) => (multi ? `(${idx + 1}/${state.items.length}) ` : '');

  // Odadaki kisi sayisi (pax) — ilk cagride lookup, state'e cache'le.
  if (state.pl !== true) {
    const { data: ih } = await supa
      .from('inhouse_guests_v2')
      .select('guest_count')
      .eq('telegram_id', String(guestChatId))
      .eq('status', 'active')
      .maybeSingle();
    const raw = ih?.guest_count as number | null | undefined;
    state.p = typeof raw === 'number' && raw >= 1 ? raw : null;
    state.pl = true;
    console.log('[hk-pax]', { convId, guest_count: raw ?? null, pax: state.p });
  }
  const pax = state.p ?? 2; // bilinmiyorsa 2 -> bugunku davranis BIREBIR korunur
  const btnMax = Math.min(pax + 1, 6); // butonlar 1..btnMax (son buton = esik asimi)

  // 1) tip gerektiren ilk esya -> TIP butonlari (havlu tipleri)
  const typeIdx = state.items.findIndex((it) => it.a === true);
  if (typeIdx !== -1) {
    state.i = typeIdx;
    state.v = (state.v ?? 0) + 1; // damga: ONCE artir + yaz, SONRA kart gonder
    await supa.from('conversations').update({ hk_pending_text: JSON.stringify(state) }).eq('id', convId);
    const askText = prefixFor(typeIdx) + guestText('hk_ask_towel_type', lang);
    await fetch(TG(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: guestChatId,
        text: askText,
        reply_markup: {
          inline_keyboard: [
            [{ text: guestText('hk_lbl_bath_towel', lang), callback_data: `hk:s:1:${convId}:${state.v}` }],
            [{ text: guestText('hk_lbl_face_towel', lang), callback_data: `hk:s:2:${convId}:${state.v}` }],
            [{ text: guestText('hk_lbl_foot_towel', lang), callback_data: `hk:s:3:${convId}:${state.v}` }],
          ],
        },
      }),
    }).catch(() => {});
    await supa.from('bot_messages').insert({
      conversation_id: convId, direction: 'outbound', text: askText, message_type: 'text',
    });
    console.log('[hk-cb] tip soruldu', { convId, i: typeIdx });
    return;
  }

  // 2) adet gerektiren ilk esya -> ADET butonlari [1][2][3]
  const qtyIdx = state.items.findIndex((it) => it.q === null);
  if (qtyIdx !== -1) {
    state.i = qtyIdx;
    state.v = (state.v ?? 0) + 1; // damga: ONCE artir + yaz, SONRA kart gonder
    await supa.from('conversations').update({ hk_pending_text: JSON.stringify(state) }).eq('id', convId);
    const label = labelForHousekeepingCode(state.items[qtyIdx].c) ?? '';
    // Etiket VARSA soruda kalir (hangi esya icin soruldugu kaybolmasin), yoksa sade
    // adet sorusu. TR metin mevcut satirla BIREBIR ayni anlam; ASCII "Kac adet" TAM
    // Turkce bicime cevrildi (misafire donuk metin kurali).
    const askText =
      prefixFor(qtyIdx) +
      (label ? guestText('hk_ask_qty_labeled', lang, { esya: label }) : guestText('hk_ask_qty', lang));
    const nums = Array.from({ length: btnMax }, (_, i) => i + 1);
    const rows: unknown[][] = [];
    for (let i = 0; i < nums.length; i += 3)
      rows.push(nums.slice(i, i + 3).map((n) => ({ text: String(n), callback_data: `hk:q:${n}:${convId}:${state.v}` })));
    await fetch(TG(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: guestChatId,
        text: askText,
        reply_markup: { inline_keyboard: rows },
      }),
    }).catch(() => {});
    await supa.from('bot_messages').insert({
      conversation_id: convId, direction: 'outbound', text: askText, message_type: 'text',
    });
    console.log('[hk-cb] adet soruldu', { convId, i: qtyIdx });
    return;
  }

  // 3) hepsi tamam -> forward
  await supa.from('conversations').update({ hk_pending: false, hk_pending_text: null }).eq('id', convId);
  const items = state.items.map((it) => ({ code: it.c, qty: it.q, ambiguous: it.a }));
  // SIKAYET ETIKETI: zincir sikayet onayiyla baslamissa (cm) kartta ve dedup
  // metninde 'sikayet/yenileme' isareti kalir — adet artik butondan geldigi icin
  // etiket state uzerinden tasinir (eski auto q=1 dalindaki sabit not kaldirildi).
  const res = await forwardHousekeepingItems({
    supa, botToken, convId, items, pax, paxKnown: state.p !== null,
    note: state.cm === true ? 'sikayet/yenileme' : undefined,
  });
  const msg = res.duplicate
    ? guestText('hk_fwd_duplicate', lang)
    : res.ok
      ? guestText('hk_fwd_ok', lang)
      : guestText('hk_fwd_error', lang);
  await sendGuest(botToken, String(guestChatId), msg);
  console.log('[hk-cb] forward sonucu', { convId, ok: res.ok, duplicate: res.duplicate });
}

// SIKAYET ONAY SORUSU (IS 8). Esya BELLI oldugu icin tip/adet SORULMAZ; tek soru:
// "simdi mi, sonra mi". Saat/gunduz-gece mantigi YOK — secim MISAFIRDE. Damga
// disiplini advanceHousekeeping ile BIREBIR: v ONCE artir + yaz, SONRA kart gonder.
export async function askHousekeepingComplaintConfirm(p: {
  supa: SupabaseClient;
  botToken: string;
  convId: string;
  guestChatId: string | number;
  state: HkState;
  /** Opsiyonel fallback — metadata'da kalici dil yoksa kullanilir (advanceHousekeeping deseni). */
  language?: string;
}): Promise<void> {
  const { supa, botToken, convId, guestChatId, state } = p;
  const { data: langRow } = await supa
    .from('conversations')
    .select('metadata')
    .eq('id', convId)
    .maybeSingle();
  const lang = resolvePreferredLang({
    detected: p.language,                // route.ts'ten gelen guestLang = O TURUN tespiti
    stored: readPreferredLang(langRow?.metadata),
    interfaceLang: 'tr',                 // bkz. advanceHousekeeping: eski davranis TR
  });
  state.v = (state.v ?? 0) + 1;
  await supa.from('conversations').update({ hk_pending_text: JSON.stringify(state) }).eq('id', convId);
  const askText = guestText('hk_complaint_confirm_ask', lang);
  await fetch(TG(botToken, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: guestChatId,
      text: askText,
      reply_markup: {
        inline_keyboard: [
          [{ text: guestText('hk_lbl_yes_now', lang), callback_data: `hk:c:1:${convId}:${state.v}` }],
          [{ text: guestText('hk_lbl_later', lang), callback_data: `hk:c:0:${convId}:${state.v}` }],
        ],
      },
    }),
  }).catch(() => {});
  await supa.from('bot_messages').insert({
    conversation_id: convId, direction: 'outbound', text: askText, message_type: 'text',
  });
  console.log('[hk-cb] sikayet onayi soruldu', { convId, code: state.items[0]?.c, v: state.v });
}

export async function handleHousekeepingCallback(params: HkCallbackParams): Promise<void> {
  const { action, value, convId, stampRaw } = parseHkCallbackData(params.callbackData);
  console.log('[hk-cb] START', { action, data: params.callbackData });

  if ((action !== 's' && action !== 'q' && action !== 'c') || Number.isNaN(value) || !convId) {
    // convId cozulemedi -> kalici dil okunamaz; eski davranisla ayni: TR.
    await answer(params.botToken, params.callbackQueryId, guestText('hk_toast_invalid', 'tr'));
    return;
  }

  // conv + state oku (IS 10: metadata da cekilir — callback'te dil BASKA yerden bilinemez)
  const { data: conv, error: convErr } = await params.supa
    .from('conversations')
    .select('id, telegram_chat_id, hk_pending, hk_pending_text, metadata')
    .eq('id', convId)
    .maybeSingle();
  if (convErr) console.error('[hk-cb] conv lookup hatasi:', convErr.message);
  const lang = resolvePreferredLang({ stored: readPreferredLang(conv?.metadata), interfaceLang: 'tr' });
  if (!conv || conv.hk_pending !== true || !conv.hk_pending_text) {
    await answer(params.botToken, params.callbackQueryId, guestText('cb_already_processed', lang));
    return;
  }
  const guestChatId = conv.telegram_chat_id as string;

  let state: HkState;
  try {
    state = JSON.parse(conv.hk_pending_text as string) as HkState;
  } catch {
    await answer(params.botToken, params.callbackQueryId, guestText('cb_already_processed', lang));
    return;
  }
  if (!state?.items?.length || typeof state.i !== 'number' || !state.items[state.i]) {
    await answer(params.botToken, params.callbackQueryId, guestText('cb_already_processed', lang));
    return;
  }

  // ── DAMGA KAPISI ──────────────────────────────────────────────────────────
  // State okundu, HENUZ hicbir sey degismedi. Buton kendi damgasini (stampRaw)
  // tasir; canli state.v ile eslesmezse bu buton BAYAT/EZILMIS demektir (misafir
  // cevaplamadan yeni talep yazdi -> state ezildi, ekranda eski buton kaldi).
  // Karar hkStampAccepts'te (saf fonksiyon). RED'de state'e DOKUNMA, forward YOK;
  // misafir show_alert ile bilgilendirilir (SESSIZ YUTMA YASAGI).
  if (!hkStampAccepts(stampRaw, state.v)) {
    await answer(
      params.botToken,
      params.callbackQueryId,
      guestText('cb_stale_button', lang),
      true,
    );
    console.log('[hk-cb] RED bayat damga', { stamp: stampRaw, stateV: state.v, convId });
    return;
  }

  // ── SIKAYET ONAYI (hk:c) ──────────────────────────────────────────────────
  // Damga kapisini GECTI. Otomatik onay YASAK: sistem misafirin yerine "simdi"
  // secemez; iki dal da misafirin secimiyle acilir.
  //
  // value=1 (Evet, simdi): DOGRUDAN forward YAPILMAZ. Odada 3-4 kisi olabilir ->
  //   adet SECILMELI. Normal cozum makinesi (advanceHousekeeping) baslatilir:
  //   esya ambiguous ise TIP (banyo/yuz/ayak) -> ADET -> forward. Yeni bir akis
  //   kurulmaz, normal talep akisiyla BIREBIR ayni zincir. State KAPATILMAZ.
  //   Cift-tik korumasi damgadan gelir: advanceHousekeeping ilk soruyu sorarken
  //   v'yi artirir -> ekranda kalan onay butonu bayatlar, ikinci basim damga
  //   kapisinda RED alir (misafir show_alert ile bilgilendirilir).
  // value=0 (Simdi degil, sonra): state kapanir, forward YOK.
  if (action === 'c') {
    if (value === 1) {
      await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('hk_lbl_selected', lang));
      await answer(params.botToken, params.callbackQueryId, guestText('hk_toast_selected', lang));
      console.log('[hk-cb] sikayet onaylandi -> cozum zinciri basliyor', {
        convId, code: state.items[0]?.c, ambiguous: state.items[0]?.a,
      });
      await advanceHousekeeping({
        supa: params.supa,
        botToken: params.botToken,
        convId,
        guestChatId,
        state,
      });
      return;
    }
    await params.supa
      .from('conversations')
      .update({ hk_pending: false, hk_pending_text: null })
      .eq('id', convId);
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('hk_lbl_selected', lang));
    await answer(params.botToken, params.callbackQueryId, guestText('hk_toast_selected', lang));
    await sendGuest(params.botToken, guestChatId, guestText('hk_complaint_later', lang));
    console.log('[hk-cb] sikayet ertelendi (forward YOK)', { convId });
    return;
  }

  // aktif esyayi guncelle
  if (action === 's') {
    state.items[state.i].c = value;
    state.items[state.i].a = false;
  } else {
    state.items[state.i].q = value;
  }
  await params.supa
    .from('conversations')
    .update({ hk_pending_text: JSON.stringify(state) })
    .eq('id', convId);

  // basilan butonu isaretle + answer
  await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('hk_lbl_selected', lang));
  await answer(params.botToken, params.callbackQueryId, guestText('hk_toast_selected', lang));

  // sonraki adim / forward
  await advanceHousekeeping({
    supa: params.supa,
    botToken: params.botToken,
    convId,
    guestChatId,
    state,
  });
}
