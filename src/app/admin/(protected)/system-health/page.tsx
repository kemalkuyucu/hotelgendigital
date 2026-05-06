import Link from 'next/link'
import { getCentralServerClient } from '@/lib/supabase/central-server'

export const dynamic = 'force-dynamic'

interface BridgeCredRow {
  is_healthy: boolean | null
  last_verified_at: string | null
}

interface HotelRow {
  id: string
  name: string
  slug: string
  status: string
  bridge_credentials: BridgeCredRow | BridgeCredRow[] | null
}

interface SystemHealthRow {
  hotel_id: string
  check_type: string
  status: string
  details: Record<string, unknown> | null
  checked_at: string
}

export default async function SystemHealthPage() {
  const supabase = await getCentralServerClient()
  const [{ data: hotels }, { data: recentChecks }] = await Promise.all([
    supabase
      .from('hotels')
      .select('id, name, slug, status, bridge_credentials(is_healthy, last_verified_at)')
      .order('name'),
    supabase
      .from('system_health')
      .select('hotel_id, check_type, status, details, checked_at')
      .order('checked_at', { ascending: false })
      .limit(50),
  ])

  const typedHotels = (hotels as HotelRow[] | null) ?? []
  const typedChecks = (recentChecks as SystemHealthRow[] | null) ?? []

  const healthyCount = typedHotels.filter((h) => {
    const bc = Array.isArray(h.bridge_credentials)
      ? h.bridge_credentials[0]
      : h.bridge_credentials
    return bc?.is_healthy === true
  }).length
  const unhealthyCount = typedHotels.filter((h) => {
    const bc = Array.isArray(h.bridge_credentials)
      ? h.bridge_credentials[0]
      : h.bridge_credentials
    return bc?.is_healthy === false
  }).length
  const pendingCount = typedHotels.length - healthyCount - unhealthyCount

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sistem Sağlığı</h1>
        <p className="text-gray-500 text-sm mt-1">Tüm otellerin bridge bağlantı durumlarını izleyin</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-green-700">{healthyCount}</div>
          <div className="text-sm text-green-600 mt-1">✅ Sağlıklı Bağlantı</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-red-700">{unhealthyCount}</div>
          <div className="text-sm text-red-600 mt-1">❌ Bağlantı Hatası</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-700">{pendingCount}</div>
          <div className="text-sm text-gray-600 mt-1">⏳ Test Bekleniyor</div>
        </div>
      </div>

      {/* Hotels Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Otel Bağlantı Durumları</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Otel</th>
              <th className="px-6 py-3">Bridge Sağlığı</th>
              <th className="px-6 py-3">Son Kontrol</th>
              <th className="px-6 py-3">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {typedHotels.map((h) => {
              const bc = Array.isArray(h.bridge_credentials)
                ? h.bridge_credentials[0]
                : h.bridge_credentials
              const isHealthy = bc?.is_healthy === true
              const isUnhealthy = bc?.is_healthy === false
              const lastVerified = bc?.last_verified_at

              return (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{h.name}</div>
                    <div className="text-xs text-gray-400">{h.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    {bc === null || bc === undefined ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        — Henüz test edilmedi
                      </span>
                    ) : isHealthy ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ✅ Sağlıklı
                      </span>
                    ) : isUnhealthy ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        ❌ Hata
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        ⏳ Bilinmiyor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {lastVerified
                      ? new Date(lastVerified).toLocaleString('tr-TR')
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/hotels/${h.id}/credentials`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Test &amp; Yönet →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent Checks */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Son 50 Kontrol Kaydı</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {typedChecks.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Henüz bridge testi yapılmadı.
            </div>
          )}
          {typedChecks.map((c, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4 text-sm">
              <span className="text-base">{c.status === 'healthy' ? '✅' : '❌'}</span>
              <span className="font-mono text-xs text-gray-400 w-36 shrink-0">
                {new Date(c.checked_at).toLocaleString('tr-TR')}
              </span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                {c.check_type}
              </span>
              <span className="text-gray-600 truncate flex-1">
                {(c.details as Record<string, unknown>)?.message as string ?? '—'}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {(c.details as Record<string, unknown>)?.latencyMs as number ?? 0} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
