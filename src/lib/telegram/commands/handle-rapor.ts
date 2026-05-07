import { SupabaseClient } from '@supabase/supabase-js';

export async function handleRapor(hotelClient: SupabaseClient): Promise<string> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isoStart = todayStart.toISOString();

  const { count: inboundCount } = await hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .gte('created_at', isoStart);

  const { count: outboundCount } = await hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', isoStart);

  const { data: intentDist } = await hotelClient
    .from('ai_intents')
    .select('classified_department')
    .gte('created_at', isoStart);

  const distMap = new Map<string, number>();
  for (const row of intentDist ?? []) {
    const key = (row.classified_department as string | null) ?? '(sınıflandırılamadı)';
    distMap.set(key, (distMap.get(key) ?? 0) + 1);
  }

  const distLines =
    distMap.size === 0
      ? '_(bugün intent yok)_'
      : Array.from(distMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  • ${k}: ${v}`)
          .join('\n');

  return `📊 *Bugünkü Rapor*

📥 Gelen mesaj: *${inboundCount ?? 0}*
📤 Giden mesaj: *${outboundCount ?? 0}*

🏷 Intent dağılımı:
${distLines}`;
}
