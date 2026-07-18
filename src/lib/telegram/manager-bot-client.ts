export interface SendManagerMessageInput {
  chatId: number;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

// Telegram sendMessage 4096 karakter siniri. 4000'de guvenli parcala (marj birak).
// '\n' sinirlarinda bol; tek satir limit'ten uzunsa sert kes. '\n' karakteri parcada
// KORUNUR -> parts.join('') === text (birlesim orijinali AYNEN korur). Saf fonksiyon.
export function splitForTelegram(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    // limit-1 icindeki son '\n' + 1 -> '\n' parcaya dahil edilerek kesilir
    let cut = rest.lastIndexOf('\n', limit - 1) + 1;
    if (cut <= 0) cut = limit; // limit icinde uygun '\n' yok -> sert kes
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

// HTML fallback: gercek tag'leri soy, sonra entity decode -> parse_mode'suz duz metin.
// SIRA: once tag soy (encoded &lt; henuz tag degil, yanlislikla soyulmaz), sonra decode;
// &amp; EN SON (cift-decode onler).
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export async function sendManagerMessage(input: SendManagerMessageInput, token: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const parseMode = input.parseMode ?? 'Markdown';
  // 4096 limitini asan raporlar tek mesajda 400 alip throw etmesin: <=4000'lik parcalara
  // bol, SIRAYLA gonder. Kisa mesaj -> tek parca -> eski davranis birebir korunur.
  const parts = splitForTelegram(input.text, 4000);

  for (const part of parts) {
    // 1) Normal deneme — mevcut parse_mode ile.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: part,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) continue;

    // 2) Non-ok (or. entity-parse 400): ayni parcayi BIR KEZ duz metin dene (parse_mode YOK).
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: stripHtml(part),
        disable_web_page_preview: true,
      }),
    });
    if (res2.ok) continue;

    // 3) Duz metin de non-ok: gercek hata yuzeye ciksin (eski davranis).
    const err = await res2.text();
    throw new Error(`Telegram sendMessage failed: ${res2.status} ${err}`);
  }
}

/**
 * Manager bot uzerinden dosya (xlsx vb.) gonder.
 * sendManagerMessage ile AYNI token'i kullanir. Hata durumunda yutar+loglar.
 */
export async function sendManagerDocument(
  chatId: number | string,
  fileBuffer: Buffer,
  fileName: string,
  token: string,
  caption?: string
): Promise<void> {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([new Uint8Array(fileBuffer)]), fileName);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[manager-bot] sendDocument failed: ${res.status} ${err}`);
    }
  } catch (err) {
    console.error('[manager-bot] sendDocument hatası:', err);
  }
}
