import type { SupabaseClient } from '@supabase/supabase-js';

interface MenuOfferCallbackParams {
  supa: SupabaseClient;
  botToken: string;
  callbackQueryId: string;
  callbackData: string; // menu:show:<convId> | menu:no:<convId>
  callbackChatId: number | string;
  callbackMessageId: number;
}

export async function handleMenuOfferCallback(params: MenuOfferCallbackParams): Promise<void> {
  const parts = params.callbackData.split(':');
  const action = parts[1]; // show | no
  const conversationId = parts.slice(2).join(':');

  // answerCallbackQuery (butona basildi geri bildirimi)
  await fetch(`https://api.telegram.org/bot${params.botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: params.callbackQueryId }),
  });

  // Konusmayi cek (saklanan menu listesi + dil icin)
  const { data: conv } = await params.supa
    .from('conversations')
    .select('menu_offer_pending, menu_offer_text')
    .eq('id', conversationId)
    .single();

  // Cift basim korumasi: bayrak zaten kapaliysa hicbir sey yapma
  if (!conv || conv.menu_offer_pending !== true) {
    return;
  }

  // Bayragi kapat (her iki dalda da)
  await params.supa
    .from('conversations')
    .update({ menu_offer_pending: false })
    .eq('id', conversationId);

  if (action === 'show') {
    // Saklanan "yok + liste" cevabini misafire gonder
    const listText =
      conv.menu_offer_text && conv.menu_offer_text.trim().length > 0
        ? conv.menu_offer_text
        : 'Su an menumuzu goruntuleyemiyorum, lutfen restoran ekibimize danisin.';
    await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: params.callbackChatId, text: listText }),
    });
    await params.supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      text: listText,
      message_type: 'text',
    });
    console.log(`[menu-offer] show — saklanan liste gonderildi. conv=${conversationId}`);
  } else {
    // menu:no — nazik kapanis
    const noText = 'Tabii, baska bir konuda yardimci olabilirsem buradayim.';
    await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: params.callbackChatId, text: noText }),
    });
    await params.supa.from('bot_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      text: noText,
      message_type: 'text',
    });
    console.log(`[menu-offer] no — kapanis gonderildi. conv=${conversationId}`);
  }
}
