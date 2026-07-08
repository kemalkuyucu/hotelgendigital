import { getCentralSupabase } from '@/lib/supabase-client'

// ─── Glassmorphism kart stilleri (tüm admin sayfalarında ortak) ───────────────
// Kart: rgba(255,255,255,0.06) bg + backdrop-blur-xl + border rgba(255,255,255,0.12)
// Bu sabit inline style nesneleri kullanılarak tutarlılık sağlanır.

interface AuditLogRow {
  action: string
  actor_username: string
  created_at: string
  resource_type: string | null
}

export default async function DashboardPage() {
  const supabase = getCentralSupabase()

  const [{ count: hotelCount }, { data: recentLogs }, { data: hotelRows }] = await Promise.all([
    supabase.from('hotels').select('*', { count: 'exact', head: true }),
    supabase
      .from('audit_log')
      .select('action, actor_username, created_at, resource_type')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('hotels')
      .select('name, version, status')
      .neq('status', 'deleted')
      .order('version', { ascending: false }),
  ])

  const versionGroups: Record<string, string[]> = {}
  for (const h of (hotelRows ?? []) as { name: string; version: string | null }[]) {
    const v = h.version ?? 'v4'
    if (!versionGroups[v]) versionGroups[v] = []
    versionGroups[v].push(h.name)
  }
  const sortedVersions = Object.keys(versionGroups).sort().reverse()

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>HotelGen merkez yönetim özeti</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Toplam Otel</div>
          <div className="text-4xl font-bold" style={{ color: '#60a5fa' }}>{hotelCount ?? 0}</div>
        </div>
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Sistem Durumu</div>
          <div className="text-2xl font-bold text-green-400">✅ Aktif</div>
        </div>
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="text-sm mb-1" style={{ color: '#94a3b8' }}>Versiyon</div>
          <div className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>v5.0</div>
        </div>
      </div>

      {/* Versiyon Dagilimi */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Versiyon Dağılımı</h2>
        </div>
        <div className="p-6 space-y-5">
          {sortedVersions.length > 0 ? (
            sortedVersions.map((v) => (
              <div key={v}>
                <div className="text-sm font-bold mb-2" style={{ color: '#60a5fa' }}>{v}</div>
                <div className="flex flex-col gap-1">
                  {versionGroups[v].map((hn, i) => (
                    <div key={i} className="text-sm pl-3" style={{ color: '#cbd5e1' }}>• {hn}</div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm" style={{ color: '#64748b' }}>Otel yok.</div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Son Aktiviteler</h2>
        </div>
        <div>
          {recentLogs && recentLogs.length > 0 ? (
            (recentLogs as AuditLogRow[]).map((log, i) => (
              <div
                key={i}
                className="px-6 py-4 flex items-center justify-between text-sm"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium" style={{ color: '#e2e8f0' }}>{log.actor_username}</span>
                  <span style={{ color: '#475569' }}>·</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.15)' }}>
                    {log.action}
                  </span>
                  {log.resource_type && (
                    <>
                      <span style={{ color: '#475569' }}>·</span>
                      <span style={{ color: '#64748b' }}>{log.resource_type}</span>
                    </>
                  )}
                </div>
                <span className="text-xs" style={{ color: '#475569' }}>
                  {new Date(log.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>
              Henüz aktivite kaydı yok.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
