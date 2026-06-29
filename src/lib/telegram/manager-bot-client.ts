export interface SendManagerMessageInput {
  chatId: number;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export async function sendManagerMessage(input: SendManagerMessageInput): Promise<void> {
  const token = process.env.TELEGRAM_MANAGER_BOT_TOKEN_DEMO;
  if (!token) {
    throw new Error('TELEGRAM_MANAGER_BOT_TOKEN_DEMO env değişkeni yok');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode ?? 'Markdown',
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
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
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_MANAGER_BOT_TOKEN_DEMO;
  if (!token) {
    throw new Error('TELEGRAM_MANAGER_BOT_TOKEN_DEMO env değişkeni yok');
  }

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
