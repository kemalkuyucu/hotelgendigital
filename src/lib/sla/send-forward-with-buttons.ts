/**
 * Modül 11 — Departmana inline button'lı forward mesajı gönderir.
 *
 * Buton callback data formatı:
 *   sla:respond:{slaEventId}:immediate
 *   sla:respond:{slaEventId}:delayed
 *
 * Return: telegram message_id (sla_events.department_message_id'ye yazılır).
 */

interface SendForwardParams {
  botToken: string;
  chatId: string; // Departman grup chat_id
  html: string;   // formatGroupMessage çıktısı
  slaEventId: string; // Yeni oluşturulan sla_events.id
}

export async function sendForwardWithSlaButtons(
  params: SendForwardParams
): Promise<{ messageId: number | null; ok: boolean }> {
  const inlineKeyboard = [
    [
      {
        text: '🟢 Hemen ilgileniyoruz',
        callback_data: `sla:respond:${params.slaEventId}:immediate`,
      },
    ],
    [
      {
        text: '🟡 Biraz sonra ilgileniyoruz',
        callback_data: `sla:respond:${params.slaEventId}:delayed`,
      },
    ],
  ];

  const res = await fetch(
    `https://api.telegram.org/bot${params.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.html,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    }
  );

  const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
  if (!data.ok) {
    console.error('[sla-forward] send error:', data);
    return { messageId: null, ok: false };
  }

  return { messageId: data.result?.message_id ?? null, ok: true };
}
