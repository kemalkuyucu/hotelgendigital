import type React from 'react'
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

// ─── Ortak glassmorphism kart stili ─────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
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
        <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Sistem Sağlığı</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Tüm otellerin bridge bağlantı durumlarını izleyin</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-5"
          style={{
            background: 'rgba(34,197,94,0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(34,197,94,0.25)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="text-2xl font-bold text-green-400">{healthyCount}</div>
          <div className="text-sm mt-1 text-green-300">✅ Sağlıklı Bağlantı</div>
        </div>
        <div
          className="rounded-xl p-5"
          style={{
            background: 'rgba(239,68,68,0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="text-2xl font-bold text-red-400">{unhealthyCount}</div>
          <div className="text-sm mt-1 text-red-300">❌ Bağlantı Hatası</div>
        </div>
        <div className="rounded-xl p-5" style={glassCard}>
          <div className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{pendingCount}</div>
          <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>⏳ Test Bekleniyor</div>
        </div>
      </div>

      {/* Hotels Table */}
      <div className="rounded-xl overflow-hidden" style={glassCard}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Otel Bağlantı Durumları</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>Otel</th>
              <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>Bridge Sağlığı</th>
              <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>Son Kontrol</th>
              <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {typedHotels.map((h) => {
              const bc = Array.isArray(h.bridge_credentials)
                ? h.bridge_credentials[0]
                : h.bridge_credentials
              const isHealthy = bc?.is_healthy === true
              const isUnhealthy = bc?.is_healthy === false
              const lastVerified = bc?.last_verified_at

              return (
                <tr
                  key={h.id}
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium" style={{ color: '#f1f5f9' }}>{h.name}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>{h.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    {bc === null || bc === undefined ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
                      >
                        — Henüz test edilmedi
                      </span>
                    ) : isHealthy ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                      >
                        ✅ Sağlıklı
                      </span>
                    ) : isUnhealthy ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                      >
                        ❌ Hata
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}
                      >
                        ⏳ Bilinmiyor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: '#64748b' }}>
                    {lastVerified ? new Date(lastVerified).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/hotels/${h.id}/credentials`}
                      className="text-sm font-medium"
                      style={{ color: '#60a5fa' }}
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
      <div className="rounded-xl overflow-hidden" style={glassCard}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Son 50 Kontrol Kaydı</h2>
        </div>
        <div>
          {typedChecks.length === 0 && (
            <div className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>
              Henüz bridge testi yapılmadı.
            </div>
          )}
          {typedChecks.map((c, i) => (
            <div
              key={i}
              className="px-6 py-3 flex items-center gap-4 text-sm hover:bg-white/5 transition-colors"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="text-base">{c.status === 'healthy' ? '✅' : '❌'}</span>
              <span className="font-mono text-xs w-36 shrink-0" style={{ color: '#64748b' }}>
                {new Date(c.checked_at).toLocaleString('tr-TR')}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
              >
                {c.check_type}
              </span>
              <span className="truncate flex-1" style={{ color: '#cbd5e1' }}>
                {(c.details as Record<string, unknown>)?.message as string ?? '—'}
              </span>
              <span className="text-xs shrink-0" style={{ color: '#475569' }}>
                {(c.details as Record<string, unknown>)?.latencyMs as number ?? 0} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
