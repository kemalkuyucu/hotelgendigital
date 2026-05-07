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
