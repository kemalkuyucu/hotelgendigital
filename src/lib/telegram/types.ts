// Telegram Bot API tip tanımları (kullandığımız kadarı)

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  voice?: { file_id: string; duration: number; mime_type?: string };
  audio?: { file_id: string; duration: number; mime_type?: string };
  photo?: Array<{ file_id: string; width: number; height: number }>;
  // Medya filtresi için ek tipler (Katman 2)
  video?: { file_id: string; duration?: number; mime_type?: string };
  document?: { file_id: string; file_name?: string; mime_type?: string };
  sticker?: { file_id: string; emoji?: string };
  animation?: { file_id: string; duration?: number; mime_type?: string };
  video_note?: { file_id: string; duration?: number };
  entities?: Array<{ type: string; offset: number; length: number }>;
  reply_to_message?: { message_id: number }; // Modül 11: resepsiyon reply handler için
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export interface SendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_to_message_id?: number;
  disable_web_page_preview?: boolean;
}
