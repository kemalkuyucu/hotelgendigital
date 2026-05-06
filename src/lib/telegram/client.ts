import type { SendMessageParams, TelegramMessage } from './types';

const TG_API = 'https://api.telegram.org/bot';

export class TelegramClient {
  constructor(private token: string) {
    if (!token) throw new Error('TelegramClient: token gerekli');
  }

  private async call<T>(method: string, params: object = {}): Promise<T> {
    const res = await fetch(`${TG_API}${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!json.ok) {
      throw new Error(`Telegram API ${method} error: ${json.description ?? 'unknown'}`);
    }
    return json.result as T;
  }

  sendMessage(params: SendMessageParams): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', params);
  }

  getMe(): Promise<{ id: number; username: string; first_name: string }> {
    return this.call('getMe');
  }

  setWebhook(params: {
    url: string;
    secret_token?: string;
    allowed_updates?: string[];
    drop_pending_updates?: boolean;
  }): Promise<boolean> {
    return this.call<boolean>('setWebhook', params);
  }

  deleteWebhook(): Promise<boolean> {
    return this.call<boolean>('deleteWebhook');
  }

  getWebhookInfo(): Promise<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }> {
    return this.call('getWebhookInfo');
  }
}
