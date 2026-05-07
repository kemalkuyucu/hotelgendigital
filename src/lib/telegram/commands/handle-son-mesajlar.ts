import { SupabaseClient } from '@supabase/supabase-js';

interface MessageRow {
  text: string | null;
  direction: string;
  created_at: string;
  conversation: { guest?: { first_name?: string } } | null;
}

export async function handleSonMesajlar(
  hotelClient: SupabaseClient,
  n: number
): Promise<string> {
  const { data: rows } = await hotelClient
    .from('bot_messages')
    .select('text, direction, created_at, conversation:conversations(guest:guests(first_name))')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(n);

  if (!rows || rows.length === 0) {
    return '📨 *Son Mesajlar:* Hiç misafir mesajı yok.';
  }

  const lines = (rows as unknown as MessageRow[]).map((r, i) => {
    const name = r.conversation?.guest?.first_name ?? 'isimsiz';
    const time = new Date(r.created_at).toLocaleString('tr-TR');
    const preview = (r.text ?? '').slice(0, 80);
    return `${i + 1}. *${name}* (${time}):\n   _${preview}_`;
  });

  return `📨 *Son ${n} Misafir Mesajı*\n\n${lines.join('\n\n')}`;
}
