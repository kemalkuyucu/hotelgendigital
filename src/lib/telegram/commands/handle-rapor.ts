import { SupabaseClient } from '@supabase/supabase-js';

/** HTML özel karakterleri kaçır (&, <, >) */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function handleRapor(
  hotelClient: SupabaseClient,
  range?: { startIso: string; endIso: string; label: string }
): Promise<string> {
  // Son 24 saat — UTC güvenli (setHours lokal saat bazlıydı, UTC'de hatalıydı)
  // range verilmişse start/end penceresi kullanılır; verilmemişse ESKI son-24-saat davranışı.
  const isoStart = range ? range.startIso : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const isoEnd = range ? range.endIso : null;

  let inboundQ = hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .gte('created_at', isoStart);
  if (isoEnd) inboundQ = inboundQ.lte('created_at', isoEnd);
  const { count: inboundCount } = await inboundQ;

  let outboundQ = hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', isoStart);
  if (isoEnd) outboundQ = outboundQ.lte('created_at', isoEnd);
  const { count: outboundCount } = await outboundQ;

  let intentQ = hotelClient
    .from('ai_intents')
    .select('classified_department')
    .gte('created_at', isoStart);
  if (isoEnd) intentQ = intentQ.lte('created_at', isoEnd);
  const { data: intentDist } = await intentQ;

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
  let fwdSentQ = hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', isoStart);
  if (isoEnd) fwdSentQ = fwdSentQ.lte('created_at', isoEnd);
  const { count: fwdSentCount } = await fwdSentQ;

  let fwdOffHoursQ = hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_off_hours', true)
    .gte('created_at', isoStart);
  if (isoEnd) fwdOffHoursQ = fwdOffHoursQ.lte('created_at', isoEnd);
  const { count: fwdOffHoursCount } = await fwdOffHoursQ;

  let fwdFailedQ = hotelClient
    .from('forwarded_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', isoStart);
  if (isoEnd) fwdFailedQ = fwdFailedQ.lte('created_at', isoEnd);
  const { count: fwdFailedCount } = await fwdFailedQ;

  // Modül 7.1: KB'den cevaplanan soru sayısı
  let kbQ = hotelClient
    .from('knowledge_answers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', isoStart);
  if (isoEnd) kbQ = kbQ.lte('created_at', isoEnd);
  const { count: kbAnsweredCount } = await kbQ;

  const baslik = range
    ? `📊 <b>Rapor (${escapeHtml(range.label)})</b>`
    : '📊 <b>Son 24 Saat Raporu</b>';

  return `${baslik}

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
