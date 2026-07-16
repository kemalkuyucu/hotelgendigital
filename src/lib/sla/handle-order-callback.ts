import { SupabaseClient } from '@supabase/supabase-js';
import { sendForwardWithSlaButtons } from './send-forward-with-buttons';
import { translateToTurkish } from '@/lib/ai/translate-to-turkish';
import { extractOrderNote } from '@/lib/menu/parse-order';
import { readPendingText, orderStampAccepts, formatOrderSummary } from '@/lib/menu/pending-order';

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;

interface OrderCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string; // order:confirm:<convId>:<v> | order:cancel:<convId>:<v> (v=damga, legacy'de yok)
  callbackChatId: number | string;
  callbackMessageId: number;
}

async function answer(token: string, id: string, text: string, showAlert = false) {
  await fetch(TG(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text, ...(showAlert ? { show_alert: true } : {}) }),
  }).catch(() => {});
}

async function editCard(token: string, chatId: number | string, msgId: number, label: string) {
  await fetch(TG(token, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'order:noop' }]] },
    }),
  }).catch(() => {});
}

// order_pending_text ZARFI ve tum yardimcilari src/lib/menu/pending-order.ts'te
// (readPendingText / orderStampAccepts / formatOrderSummary / bumpPendingOrder) —
// hk_pending_text damga deseninin ikizi. parsePendingOrder KALKTI: readPendingText
// hem structured'i cozer hem orderText'i (zarf ici raw) ham JSON blob'a dusmeden verir.

const msgConfirmed = (lang: string) =>
  lang === 'en' ? 'Your order has been sent to our team. They will assist you shortly.'
  : lang === 'de' ? 'Ihre Bestellung wurde an unser Team gesendet. Wir kuemmern uns gleich darum.'
  : 'Siparisiniz ilgili ekibe iletildi. En kisa surede ilgileniyoruz.';

const msgCancelled = (lang: string) =>
  lang === 'en' ? 'No problem, I am here if you need anything.'
  : lang === 'de' ? 'Kein Problem, ich bin fuer Sie da.'
  : 'Tabii, bilgi icin buradayim.';

export async function handleOrderCallback(params: OrderCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // confirm | cancel
  const conversationId = parts[2]; // convId UUID — ic ':' yok (slice/join gereksiz)
  const stampRaw = parts[3]; // damga; legacy (damgasiz) butonda undefined

  // conversation + guest bilgisi cek
  const { data: conv, error: convErr } = await params.supa
    .from('conversations')
    .select('id, order_pending, order_pending_text, telegram_chat_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (convErr) console.error('[order-callback] conv lookup hatasi:', convErr.message);

  if (!conv) { await answer(params.botToken, params.callbackQueryId, 'Kayit bulunamadi.'); return; }

  // dil: order_pending_text icerigine gore degil, basit fallback (callback'te detectLanguage yok)
  const lang = 'tr';

  // idempotency — bayrak zaten kapaliysa islenmistir
  if (!conv.order_pending) {
    await answer(params.botToken, params.callbackQueryId, 'Bu siparis zaten islendi.');
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, 'Islendi');
    return;
  }

  const storedText = typeof conv.order_pending_text === 'string' ? conv.order_pending_text : null;
  const { v: stateV, orderText, structured } = readPendingText(storedText);

  // ── DAMGA KAPISI ──────────────────────────────────────────────────────────
  // State okundu, HENUZ hicbir sey degismedi. Buton kendi damgasini (stampRaw)
  // tasir; canli stateV ile eslesmezse bu buton BAYAT/EZILMIS demektir (misafir
  // cevaplamadan yeni siparis yazdi -> state ezildi, ekranda eski buton kaldi).
  // Karar orderStampAccepts'te (saf fonksiyon). RED'de state'e DOKUNMA, forward YOK,
  // sla_events YOK; misafir show_alert ile bilgilendirilir (SESSIZ YUTMA YASAGI).
  if (!orderStampAccepts(stampRaw, stateV)) {
    await answer(
      params.botToken,
      params.callbackQueryId,
      'Bu buton güncel değil. Lütfen mesajın en altındaki güncel butonu kullanın.',
      true,
    );
    console.log('[order-cb] RED bayat damga', { stamp: stampRaw, stateV, conversationId });
    return;
  }

  const guestChatId = conv.telegram_chat_id as string;
  // Kartta ve sla_events.request_text'te gorunecek metin: kod bazliysa fiyatli ozet,
  // degilse ham cumle (readPendingText orderText'i zarf ici raw'dan verir — JSON blob DEGIL).
  const requestText = structured ? formatOrderSummary(structured) : orderText;

  if (action === 'cancel') {
    await params.supa.from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId);
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: msgCancelled(lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, 'Iptal edildi');
    await answer(params.botToken, params.callbackQueryId, 'Iptal edildi.');
    return;
  }

  if (action === 'confirm') {
    // bayragi KAPAT (cift basim korumasi icin once)
    await params.supa.from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId);

    // F&B grup chat_id — departments tablosundan (otel-bazli; hardcode YOK).
    // sla_events.department_chat_id NOT NULL → chat_id yoksa insert'e hic girme.
    const { data: fbDept } = await params.supa
      .from('departments')
      .select('telegram_chat_id, sla_minutes')
      .eq('code', 'fb')
      .maybeSingle();
    const fbChatId = (fbDept?.telegram_chat_id as string | null) ?? null;
    const fbSlaMinutes = (fbDept?.sla_minutes as number | null) ?? 15;
    if (!fbChatId) {
      console.error('[order-confirm] departments.fb telegram_chat_id yok — siparis iletilemedi');
      await answer(params.botToken, params.callbackQueryId, 'Bir sorun olustu, tekrar deneyin.');
      return;
    }

    // guest oda/isim — inhouse_guests_v2'den (telegram_id ile)
    let roomNumber: string | null = null;
    let guestName = '';
    const { data: inhouse } = await params.supa
      .from('inhouse_guests_v2')
      .select('room_number, guest_name')
      .eq('telegram_id', String(guestChatId))
      .eq('status', 'active')
      .maybeSingle();
    if (inhouse) {
      roomNumber = (inhouse.room_number as string) ?? null;
      guestName = (inhouse.guest_name as string) ?? '';
    }

    // ALERJEN UYARISI (Modul 4 kapsam): guest_allergens'te aktif kayit varsa
    // personel kartina uyari satiri eklenir. Alici/forward mantigina DOKUNMAZ,
    // sadece kart icerigini zenginlestirir. Sorgu hatasi akisi kesmez.
    let allergenWarnHtml = '';
    try {
      const { data: allergenRow } = await params.supa
        .from('guest_allergens')
        .select('allergen_text')
        .eq('platform', 'telegram')
        .eq('platform_user_id', String(guestChatId))
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const allergenText = (allergenRow?.allergen_text as string | undefined)?.trim();
      if (allergenText) {
        const escA = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const trAllergen = await translateToTurkish(allergenText).catch(() => allergenText);
        allergenWarnHtml =
          `\n\n⚠️ <b>ALERJI UYARISI:</b> ${escA(allergenText)}` +
          (trAllergen && trAllergen !== allergenText ? `\n🇹🇷 <b>${escA(trAllergen)}</b>` : '');
      }
    } catch (e) {
      console.error('[order-confirm] allergen lookup hatasi:', (e as Error).message);
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + fbSlaMinutes * 60 * 1000); // departments.sla_minutes

    const { data: slaEvent, error: slaErr } = await params.supa
      .from('sla_events')
      .insert({
        conversation_id: conversationId,
        inhouse_guest_id: null,
        department_code: 'fb',
        department_chat_id: fbChatId,
        request_text: requestText,
        room_number: roomNumber,
        guest_full_name: guestName,
        forwarded_at: now.toISOString(),
        sla_deadline: deadline.toISOString(),
      })
      .select('id')
      .single();

    if (slaErr || !slaEvent) {
      console.error('[order-confirm] sla_events INSERT FAILED', slaErr);
      await answer(params.botToken, params.callbackQueryId, 'Bir sorun olustu, tekrar deneyin.');
      return;
    }

    // Kod bazli siparis: siparis kalemlerini + tutari kaydet (kayit IKINCIL — hata
    // akisi kesmez, kart yine de gider). Serbest metinde kalem yok => yazma.
    if (structured) {
      const { error: orderErr } = await params.supa.from('room_service_orders').insert({
        conversation_id: conversationId,
        room_number: roomNumber,
        guest_name: guestName,
        platform: 'telegram',
        platform_user_id: String(guestChatId),
        items: structured.lines,
        total_amount: structured.total,
        currency: structured.currency,
        status: 'confirmed',
      });
      if (orderErr) console.error('[order-confirm] room_service_orders INSERT hatasi:', orderErr.message);
    }

    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const roomTxt = roomNumber ? `${esc(roomNumber)} numarali oda` : 'Oda bilinmiyor';
    const body = structured
      ? esc(formatOrderSummary(structured))
      : `<b>Talep:</b> ${esc(orderText)}`;

    // MISAFIR NOTU: kod bazli siparise eklenen serbest not ( or. "sogansiz olsun").
    // raw'dan kodlar temizlenir, kalan not varsa Turkce'ye cevrilip karta eklenir.
    let orderNoteHtml = '';
    if (structured) {
      const note = extractOrderNote(structured.raw);
      if (note) {
        const escN = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const trNote = await translateToTurkish(note).catch(() => note);
        orderNoteHtml =
          `\n\n📝 <b>Misafir notu:</b> ${escN(note)}` +
          (trNote && trNote !== note ? `\n🇹🇷 <b>${escN(trNote)}</b>` : '');
      }
    }

    const html =
      `🍽 <b>Room Service Siparisi</b>\n\n` +
      `<b>${esc(guestName || 'Misafir')}</b> — ${roomTxt}\n\n` +
      body +
      orderNoteHtml +
      allergenWarnHtml;

    const { messageId, ok } = await sendForwardWithSlaButtons({
      botToken: params.botToken,
      chatId: fbChatId,
      html,
      slaEventId: slaEvent.id as string,
      variant: 'normal',
    });

    if (ok && messageId) {
      await params.supa.from('sla_events')
        .update({ department_message_id: messageId })
        .eq('id', slaEvent.id as string);
    } else {
      // ROLLBACK — forward basarisiz, orphan sla_event birak
      console.error('[order-confirm] forward FAILED, rollback', { ok, messageId });
      await params.supa.from('sla_events').delete().eq('id', slaEvent.id as string);
      await answer(params.botToken, params.callbackQueryId, 'Iletim basarisiz, tekrar deneyin.');
      return;
    }

    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: msgConfirmed(lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, '✅ Onaylandi');
    await answer(params.botToken, params.callbackQueryId, 'Siparis iletildi.');
    return;
  }

  await answer(params.botToken, params.callbackQueryId, 'Bilinmeyen islem.');
}
