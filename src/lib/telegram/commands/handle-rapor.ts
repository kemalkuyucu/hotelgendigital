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
  // KANIT: gercek forward kaydi sla_events'te (kart dusen talep). forwarded_messages
  // SLA yolunda skipGroupMessage=true nedeniyle 'sent' grup satiri yazmaz -> TUM ZAMAN 0.
  let fwdSentQ = hotelClient
    .from('sla_events')
    .select('id', { count: 'exact', head: true })
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

  // ── SLA DETAY (sla_events) — mevcut ai_intents/forward bolumlerinden BAGIMSIZ ─────
  // Kolon adlari migrations/tenant/003_sla_events.sql'den dogrulandi.
  let slaQ = hotelClient
    .from('sla_events')
    .select('department_code, forwarded_at, responded_at, final_status, request_text, reception_response_text')
    .gte('created_at', isoStart);
  if (isoEnd) slaQ = slaQ.lte('created_at', isoEnd);
  const { data: slaRows } = await slaQ;
  const slaList = (slaRows ?? []) as {
    department_code: string | null;
    forwarded_at: string | null;
    responded_at: string | null;
    final_status: string | null;
    request_text: string | null;
    reception_response_text: string | null;
  }[];

  // Departman bazli: talep sayisi + ortalama yanit dk (responded_at - forwarded_at)
  const slaDeptMap = new Map<string, { toplam: number; yanitDkToplam: number; yanitSayisi: number }>();
  for (const r of slaList) {
    const dept = r.department_code ?? '(bilinmeyen)';
    if (!slaDeptMap.has(dept)) slaDeptMap.set(dept, { toplam: 0, yanitDkToplam: 0, yanitSayisi: 0 });
    const d = slaDeptMap.get(dept)!;
    d.toplam++;
    if (r.responded_at && r.forwarded_at) {
      const diff = new Date(r.responded_at).getTime() - new Date(r.forwarded_at).getTime();
      if (diff >= 0) {
        d.yanitDkToplam += diff / 60000;
        d.yanitSayisi++;
      }
    }
  }
  const slaDeptLines =
    slaDeptMap.size === 0
      ? '  <i>(SLA talebi yok)</i>'
      : Array.from(slaDeptMap.entries())
          .sort((a, b) => b[1].toplam - a[1].toplam)
          .map(([k, v]) => {
            const ortDk = v.yanitSayisi > 0 ? `${Math.round(v.yanitDkToplam / v.yanitSayisi)} dk` : '—';
            return `  • <code>${escapeHtml(k)}</code>: ${v.toplam} talep · ort. yanit ${ortDk}`;
          })
          .join('\n');

  // final_status='no_response' sayisi + liste; her biri icin reception_response_text AYNEN
  const noResp = slaList.filter((r) => r.final_status === 'no_response');
  const noRespLines =
    noResp.length === 0
      ? '  <i>(yok)</i>'
      : noResp
          .map((r) => {
            const talep = escapeHtml(r.request_text ?? '—');
            const acik = escapeHtml(r.reception_response_text ?? '—');
            return `  • "${talep}"\n    ↳ Resepsiyon: ${acik}`;
          })
          .join('\n');

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
  ❌ Başarısız: <b>${fwdFailedCount ?? 0}</b>

📋 <b>SLA Detay</b>
${slaDeptLines}
  ⚠️ Cevapsız (no_response): <b>${noResp.length}</b>
${noRespLines}`;
}
