import { SupabaseClient } from '@supabase/supabase-js';
import { sendForwardWithSlaButtons } from './send-forward-with-buttons';
import { translateToTurkish } from '@/lib/ai/translate-to-turkish';
import { extractOrderNote } from '@/lib/menu/parse-order';
import { readPendingText, orderStampAccepts, formatOrderSummary, isStructuredOrder } from '@/lib/menu/pending-order';
import { guestText, readPreferredLang, resolvePreferredLang, type GuestLang } from '@/lib/i18n/guest-text';
import { isDuplicateRequest } from './duplicate-guard';
import { notifyDuplicateRequest } from './notify-duplicate';

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

// "Bu siparis zaten islendi" cevabi IKI yerden verilir: bayrak zaten kapaliysa
// (seri ikinci basim) ve M1 atomik claim RED'inde (es zamanli ikinci invocation).
// Tek yerde durur — iki kopya olsa biri degisince digeri sessizce kayardi.
async function replyAlreadyProcessed(p: OrderCallbackParams, lang: GuestLang): Promise<void> {
  await answer(p.botToken, p.callbackQueryId, guestText('order_already_processed', lang));
  await editCard(p.botToken, p.callbackChatId, p.callbackMessageId, guestText('cb_lbl_processed', lang));
}

// order_pending_text ZARFI ve tum yardimcilari src/lib/menu/pending-order.ts'te
// (readPendingText / orderStampAccepts / formatOrderSummary / bumpPendingOrder) —
// hk_pending_text damga deseninin ikizi. parsePendingOrder KALKTI: readPendingText
// hem structured'i cozer hem orderText'i (zarf ici raw) ham JSON blob'a dusmeden verir.

// Misafire donuk metinler guest-text.ts'te (TEK KAYNAK, 5 dil). Buradaki eski
// en/de/tr ucluleri KALKTI: dil callback'te lang='tr' HARDCODE oldugu icin en/de
// dallari CANLIDA HIC calismiyordu (olu kod) — Rus/Arap misafir Turkce cevap aliyordu.

export async function handleOrderCallback(params: OrderCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // confirm | cancel
  const conversationId = parts[2]; // convId UUID — ic ':' yok (slice/join gereksiz)
  const stampRaw = parts[3]; // damga; legacy (damgasiz) butonda undefined

  // conversation + guest bilgisi cek
  const { data: conv, error: convErr } = await params.supa
    .from('conversations')
    .select('id, order_pending, order_pending_text, telegram_chat_id, metadata')
    .eq('id', conversationId)
    .maybeSingle();
  if (convErr) console.error('[order-callback] conv lookup hatasi:', convErr.message);

  if (!conv) {
    // Konusma okunamadi -> kalici dil de okunamaz; eski davranisla ayni: TR.
    await answer(params.botToken, params.callbackQueryId, guestText('cb_conv_missing', 'tr'));
    return;
  }

  // IS 10 — KALICI DIL: callback'te mesaj metni YOK, dil tespit EDILEMEZ. Konusmaya
  // yazilmis preferred_language okunur (route.ts classify sonrasi yazar). Kayit yoksa
  // resolver guest-text varsayilanina duser. Eski `const lang = 'tr'` HARDCODE KALKTI.
  // Fallback 'tr': kalici dil henuz yazilmamis ESKI konusmalarda eski davranis TR idi.
  const lang = resolvePreferredLang({ stored: readPreferredLang(conv.metadata), interfaceLang: 'tr' });

  // idempotency — bayrak zaten kapaliysa islenmistir. DIKKAT: bu okuma-sonra-yazma
  // kapisi yalniz SERI ikinci basimi keser; es zamanli iki invocation ikisi de
  // `true` okur -> asil koruma confirm dalindaki ATOMIK CLAIM'dir (M1).
  if (!conv.order_pending) {
    await replyAlreadyProcessed(params, lang);
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
      guestText('cb_stale_button', lang),
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
    // ── ATOMIK CLAIM (backlog #2) — confirm dalindaki M1 deseninin IKIZI ──────
    // Ustteki `!conv.order_pending` kapisi yalniz SERI ikinci basimi keser; es
    // zamanli iki iptal iki AYRI invocation'da kosar, ikisi de `true` OKUR ve
    // kosulsuz UPDATE ikisini de gecirir -> misafire IKI iptal mesaji gider.
    // Kosul UPDATE'in ICINE tasinir: satiri yalniz BIRI alir (0 satir = kaybetti).
    // Kayit uretmedigi icin zarar M1'deki kadar agir DEGIL (cift kart yok), ama
    // korumanin iki dalda ayni olmasi tercih edildi.
    const { data: cancelClaimed, error: cancelClaimErr } = await params.supa
      .from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId)
      .eq('order_pending', true)
      .select('id');
    if (cancelClaimErr) {
      // DB hatasi "baskasi aldi" DEMEK DEGILDIR (M1 ile ayni gerekce): burada
      // cikmak iptali SESSIZCE YUTARDI -> eski davranis (devam et) korunur.
      console.error('[order-cancel] claim UPDATE hatasi, akis devam ediyor:', cancelClaimErr.message);
    } else if (!cancelClaimed || cancelClaimed.length === 0) {
      console.log('[order-cb] RED atomik claim (cancel, baska invocation aldi)', { conversationId });
      await replyAlreadyProcessed(params, lang);
      return;
    }
    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: guestText('order_cancelled_guest', lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('order_lbl_cancelled', lang));
    await answer(params.botToken, params.callbackQueryId, guestText('order_toast_cancelled', lang));
    return;
  }

  if (action === 'confirm') {
    // ── M1: ATOMIK CLAIM (bayragi KAPAT) ──────────────────────────────────
    // Kosul UPDATE'in ICINDE: `.eq('order_pending', true)`. Es zamanli iki
    // callback (hizli cift tik / Telegram retry) iki AYRI invocation'da kosar ve
    // ikisi de yukarida `order_pending=true` OKUR; kosulsuz UPDATE ikisini de
    // gecirir -> cift sla_events + cift room_service_orders + cift kart. Kosul
    // veritabanina tasindiginda satiri YALNIZ BIRI alir (0 satir donen kaybeder).
    // Yerel state GUVENDE: siparis verisi (structured/orderText/requestText) zaten
    // yukarida okundu; order_pending_text'i null'lamak INSERT'leri etkilemez.
    const { data: claimed, error: claimErr } = await params.supa.from('conversations')
      .update({ order_pending: false, order_pending_text: null })
      .eq('id', conversationId)
      .eq('order_pending', true)
      .select('id');
    if (claimErr) {
      // DB hatasi "baskasi aldi" DEMEK DEGILDIR. Burada "zaten islendi" deyip
      // cikmak siparisi SESSIZCE YUTARDI -> eski davranis (devam et) korunur.
      console.error('[order-confirm] claim UPDATE hatasi, akis devam ediyor:', claimErr.message);
    } else if (!claimed || claimed.length === 0) {
      console.log('[order-cb] RED atomik claim (baska invocation aldi)', { conversationId });
      await replyAlreadyProcessed(params, lang);
      return;
    }

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
      await answer(params.botToken, params.callbackQueryId, guestText('cb_generic_error', lang));
      return;
    }

    // ── M2: DEDUP — ayni siparis kisa sure icinde IKINCI kez mi onaylandi? ──
    // M1 AYNI kartin es zamanli iki callback'ini keser; BURAYA dusen vaka AYRI bir
    // akistir (misafir siparisi yeniden yazdi -> yeni kart -> yeniden onayladi).
    // Benzerlik karari duplicate-guard.ts'te (SAF); pencere + aday seti BURADA.
    //
    // KAPI — YALNIZ YAPILI (kod-bazli) SIPARIS (isStructuredOrder, saf):
    //   Bulanik Jaccard SERBEST METINDE gercek ikinci siparisi BLOKLUYORDU:
    //   "bir kahve daha istiyorum" vs "kahve istiyorum" = kesisim 2 / birlesim 4
    //   = TAM 0.5 -> esige denk gelir -> tekrar sanilir. Yon FAIL-SAFE'in TERSI
    //   (kayip talep) oldugu icin serbest metin M2'yi ATLAR; o yolda cift-tik /
    //   Telegram retry korumasi M1 atomik claim'dedir (ayni kart, ayni damga).
    //   Yapili sipariste karsilastirilan metin kalem+adet+FIYAT ozetidir, ayrisma
    //   nettir ("• Kahve × 2 = 100 TL..." vs "× 3 = 150 TL..." -> 0.43 < 0.5).
    //   Serbest metnin ANLAMSAL tekrari (LLM isi) AYRI bir backlog maddesidir.
    //
    // PENCERE 3 dk — HK'nin 10 dk'si DEGIL: siparis tekrari mesru bir istektir
    //   ("bir kahve daha"); genis pencere gercek ikinci siparisi yutardi.
    // ADAY yalniz ACIK F&B eventleri: personel karta bastiysa (responded_at dolu)
    //   is akmistir, sonraki siparis ayri bir istir.
    // minTokenLength 1 — F&B'de MIKTAR gercek bir siparis farkidir ("2 kahve" !=
    //   "3 kahve"); HK'nin varsayilani (3) tek haneli rakamlari eler.
    //
    // KONUM: INSERT'lerden once ama inhouse/alerjen sorgularindan da ONCE — dup
    // dalinda kart GONDERILMEDIGI icin o iki adimin ciktisi (oda/isim, alerji
    // uyarisi) kullanilmaz; alerjen dalindaki translateToTurkish bosa bir LLM
    // cagrisi olur ve callback'i uzatarak Telegram retry riskini buyutur.
    if (isStructuredOrder(structured)) {
      const ORDER_DEDUP_WINDOW_MS = 3 * 60 * 1000;
      const dedupSince = new Date(Date.now() - ORDER_DEDUP_WINDOW_MS).toISOString();
      const { data: openDupEvents } = await params.supa
        .from('sla_events')
        .select('id, request_text, department_chat_id, department_message_id')
        .eq('conversation_id', conversationId)
        .eq('department_code', 'fb')
        .is('responded_at', null)
        .is('closed_at', null)
        .gte('created_at', dedupSince)
        .order('created_at', { ascending: false })
        .limit(5);
      const dupEvent = (openDupEvents ?? []).find((ev) =>
        isDuplicateRequest(requestText, [String(ev.request_text ?? '')], {
          threshold: 0.5,
          minTokenLength: 1,
        }),
      );
      if (dupEvent) {
        // PERSONEL: yeni kart ACILMAZ, sla_events'e DOKUNULMAZ (SLA saati ve
        // eskalasyon korunur); acik kartin ALTINA reply duser — housekeeping ile ayni
        // desen. SESSIZ YUTMA YASAGI: bir talep kapida dusuyorsa iz birakmalidir.
        await notifyDuplicateRequest({
          botToken: params.botToken,
          chatId: (dupEvent.department_chat_id as string) ?? fbChatId,
          messageId: (dupEvent.department_message_id as number | null) ?? null,
          repeatText: requestText,
        });
        // MISAFIR: ne oldugu ACIKCA soylenir; "iletildi" DENMEZ (SAHTE VAAT YASAGI).
        await fetch(TG(params.botToken, 'sendMessage'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: guestChatId, text: guestText('order_duplicate_recent', lang) }),
        }).catch(() => {});
        await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('cb_lbl_processed', lang));
        await answer(params.botToken, params.callbackQueryId, guestText('order_already_processed', lang));
        console.log('[order-confirm] DEDUP: INSERT atlandi, yeni kart acilmadi', {
          conversationId,
          dupEventId: dupEvent.id,
        });
        return;
      }
    } else {
      // Serbest metin: M2 hic calismadi. Talep DUSMEZ — normal INSERT yoluna devam
      // eder; bu satir canli UAT'de kapinin isledigini gosteren tek izdir.
      console.log('[order-confirm] DEDUP atlandi: serbest-metin siparis', { conversationId });
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
      await answer(params.botToken, params.callbackQueryId, guestText('cb_generic_error', lang));
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
      await answer(params.botToken, params.callbackQueryId, guestText('order_forward_failed', lang));
      return;
    }

    await fetch(TG(params.botToken, 'sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: guestChatId, text: guestText('order_sent_guest', lang) }),
    }).catch(() => {});
    await editCard(params.botToken, params.callbackChatId, params.callbackMessageId, guestText('order_lbl_approved', lang));
    await answer(params.botToken, params.callbackQueryId, guestText('order_toast_sent', lang));
    return;
  }

  await answer(params.botToken, params.callbackQueryId, guestText('cb_unknown_action', lang));
}
