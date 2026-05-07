import { SupabaseClient } from '@supabase/supabase-js';

export async function handleDurum(
  hotelClient: SupabaseClient,
  hotelId: string,
  centralClient: SupabaseClient
): Promise<string> {
  // En son 5 health-check kaydı
  const { data: healthRows } = await centralClient
    .from('system_health')
    .select('check_type, status, latency_ms, checked_at')
    .eq('hotel_id', hotelId)
    .order('checked_at', { ascending: false })
    .limit(5);

  if (!healthRows || healthRows.length === 0) {
    return '⚠️ *Durum:* Hiç health-check kaydı yok.';
  }

  const lines = healthRows.map((r) => {
    const status = r.status as string;
    const icon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
    return `${icon} ${r.check_type}: ${status} (${r.latency_ms ?? '-'}ms) — ${new Date(r.checked_at as string).toLocaleString('tr-TR')}`;
  });

  return `🩺 *Sistem Durumu* (son 5 kontrol)\n\n${lines.join('\n')}`;
}
