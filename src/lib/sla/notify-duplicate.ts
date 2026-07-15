// Dedup yakalandiginda ikinci kart ACILMAZ; acik kartin altina reply olarak
// bildirim duser. sla_events DEGISMEZ -> SLA saati ve escalation korunur.
export async function notifyDuplicateRequest(p: {
  botToken: string;
  chatId: string | number;   // departman grup chat id
  messageId: number | null;  // acik kartin message_id (yoksa reply'siz gider)
  repeatText: string;
  repeatTextTr?: string | null;
}): Promise<void> {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const saat = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  const trLine = p.repeatTextTr && p.repeatTextTr.trim() && p.repeatTextTr.trim() !== p.repeatText.trim()
    ? `\n🇹🇷 <b>Ceviri:</b> ${esc(p.repeatTextTr)}` : '';
  const text =
    `🔁 <b>Misafir talebini tekrarladi</b> (${saat})\n` +
    `"${esc(p.repeatText)}"${trLine}\n\n` +
    `Ayni talep HALA ACIK. Lutfen yukaridaki kartin butonuna basin.`;
  const body: Record<string, unknown> = {
    chat_id: p.chatId, text, parse_mode: 'HTML', allow_sending_without_reply: true,
  };
  if (p.messageId) body.reply_to_message_id = p.messageId;
  await fetch(`https://api.telegram.org/bot${p.botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).catch(() => {});
  console.log('[dup-notify] gonderildi', { chatId: p.chatId, replyTo: p.messageId });
}
