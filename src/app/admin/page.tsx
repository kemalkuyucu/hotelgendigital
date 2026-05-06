import { getCentralServerClient } from '@/lib/supabase/central-server'

interface AuditLogRow {
  action: string
  actor_username: string
  created_at: string
  resource_type: string | null
}

export default async function DashboardPage() {
  const supabase = await getCentralServerClient()

  const [{ count: hotelCount }, { data: recentLogs }] = await Promise.all([
    supabase.from('hotels').select('*', { count: 'exact', head: true }),
    supabase
      .from('audit_log')
      .select('action, actor_username, created_at, resource_type')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">HotelGen merkez yönetim özeti</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Toplam Otel</div>
          <div className="text-4xl font-bold text-blue-600">{hotelCount ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Sistem Durumu</div>
          <div className="text-2xl font-bold text-green-500">✅ Aktif</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Versiyon</div>
          <div className="text-2xl font-bold text-gray-700">v2.0</div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Son Aktiviteler</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recentLogs && recentLogs.length > 0 ? (
            (recentLogs as AuditLogRow[]).map((log, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{log.actor_username}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-blue-600 font-mono text-xs bg-blue-50 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                  {log.resource_type && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{log.resource_type}</span>
                    </>
                  )}
                </div>
                <span className="text-gray-400 text-xs">
                  {new Date(log.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Henüz aktivite kaydı yok.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
