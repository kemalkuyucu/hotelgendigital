import { getCentralServerClient } from '@/lib/supabase/central-server'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  actor_username: string
  action: string
  resource_type: string | null
  hotel_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; hotel?: string }>
}) {
  const sp = await searchParams
  const supabase = await getCentralServerClient()

  let query = supabase
    .from('audit_log')
    .select(
      'id, actor_username, action, resource_type, hotel_id, details, ip_address, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (sp.action) query = query.eq('action', sp.action)
  if (sp.hotel) query = query.eq('hotel_id', sp.hotel)

  const { data: logs } = await query
  const typedLogs = (logs as AuditRow[] | null) ?? []

  // Action badge renkleri
  const actionColor = (action: string) => {
    if (action.startsWith('hotel.')) return 'bg-blue-100 text-blue-700'
    if (action.startsWith('bridge.')) return 'bg-purple-100 text-purple-700'
    if (action.startsWith('credentials.')) return 'bg-amber-100 text-amber-700'
    if (action.startsWith('auth.')) return 'bg-green-100 text-green-700'
    if (action.startsWith('vip.')) return 'bg-pink-100 text-pink-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">
          Sistemdeki tüm yönetici işlemlerinin kaydı — son 100 kayıt gösteriliyor
        </p>
      </div>

      {/* Filtreler */}
      <form className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Action filtrele
          </label>
          <input
            name="action"
            defaultValue={sp.action ?? ''}
            placeholder="örn: hotel.create, bridge.test"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Hotel ID filtrele
          </label>
          <input
            name="hotel"
            defaultValue={sp.hotel ?? ''}
            placeholder="Hotel UUID"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Filtrele
        </button>
        {(sp.action || sp.hotel) && (
          <a
            href="/admin/audit-log"
            className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg text-sm border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Filtreyi Temizle ✕
          </a>
        )}
      </form>

      {/* Log Tablosu */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">İşlem Kayıtları</h2>
          <span className="text-sm text-gray-400">{typedLogs.length} kayıt</span>
        </div>
        {typedLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {sp.action || sp.hotel
              ? 'Bu filtrelere uyan kayıt bulunamadı.'
              : 'Henüz audit log kaydı yok.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Zaman</th>
                <th className="px-6 py-3">Kullanıcı</th>
                <th className="px-6 py-3">İşlem</th>
                <th className="px-6 py-3">Kaynak</th>
                <th className="px-6 py-3">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {typedLogs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-800">{l.actor_username}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${actionColor(l.action)}`}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {l.resource_type ?? '—'}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-400 truncate max-w-xs">
                    {l.details ? JSON.stringify(l.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
