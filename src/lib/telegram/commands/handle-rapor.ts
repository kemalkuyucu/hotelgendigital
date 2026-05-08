import { SupabaseClient } from '@supabase/supabase-js';

/** HTML özel karakterleri kaçır (&, <, >) */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function handleRapor(hotelClient: SupabaseClient): Promise<string> {
  // Son 24 saat — UTC güvenli (setHours lokal saat bazlıydı, UTC'de hatalıydı)
  const isoStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

  // Modül 7.1: Intent key'leri <code> ile sar — underscore italik render bug fix
  const distLines =
    distMap.size === 0
      ? '<i>(bugün intent yok)</i>'
      : Array.from(distMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  • <code>${escapeHtml(k)}</code>: ${v}`)
          .join('\n');

  // Forward özeti (Modül 6.1)
  const { count: fwdSentCount } = await hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', isoStart);

  const { count: fwdOffHoursCount } = await hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_off_hours', true)
    .gte('created_at', isoStart);

  const { count: fwdFailedCount } = await hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', isoStart);

  // Modül 7.1: KB'den cevaplanan soru sayısı
  const { count: kbAnsweredCount } = await hotelClient
    .from('knowledge_answers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', isoStart);

  return `📊 <b>Son 24 Saat Raporu</b>

📥 Gelen mesaj: <b>${inboundCount ?? 0}</b>
📤 Giden mesaj: <b>${outboundCount ?? 0}</b>

🏷 Intent dağılımı:
${distLines}

🧠 <b>Bilgi Bankası</b>
  ✅ KB'den cevaplanan: <b>${kbAnsweredCount ?? 0}</b>

📨 <b>Forward Özeti</b>
  ✅ Gönderilen: <b>${fwdSentCount ?? 0}</b>
  🌙 Off-hours: <b>${fwdOffHoursCount ?? 0}</b>
  ❌ Başarısız: <b>${fwdFailedCount ?? 0}</b>`;
}
