import { SupabaseClient } from '@supabase/supabase-js';

interface GuestRow {
  first_name?: string;
  last_name?: string;
  telegram_username?: string;
}

interface ConversationRow {
  id: string;
  last_message_at: string;
  guest: GuestRow | null;
}

export async function handleAktifKonusmalar(hotelClient: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await hotelClient
    .from('conversations')
    .select('id, last_message_at, guest:guests(first_name, last_name, telegram_username)')
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) {
    return '💬 *Aktif Konuşmalar:* Son 24 saatte aktif konuşma yok.';
  }

  const lines = (rows as unknown as ConversationRow[]).map((r, i) => {
    const guest = r.guest;
    const name = guest
      ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || guest.telegram_username || 'isimsiz'
      : 'isimsiz';
    const time = new Date(r.last_message_at).toLocaleString('tr-TR');
    return `${i + 1}. *${name}* — ${time}`;
  });

  return `💬 *Aktif Konuşmalar* (son 24 saat)\n\n${lines.join('\n')}`;
}
