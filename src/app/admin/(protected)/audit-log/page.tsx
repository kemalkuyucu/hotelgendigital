import type React from 'react'
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

// ─── Action badge renk haritası (dark theme) ─────────────────────────────────
function actionBadgeStyle(action: string): React.CSSProperties {
  if (action.startsWith('hotel.'))       return { background: 'rgba(59,130,246,0.18)', color: '#93c5fd' }
  if (action.startsWith('bridge.'))      return { background: 'rgba(168,85,247,0.18)', color: '#c4b5fd' }
  if (action.startsWith('credentials.')) return { background: 'rgba(245,158,11,0.18)', color: '#fcd34d' }
  if (action.startsWith('auth.'))        return { background: 'rgba(34,197,94,0.18)',  color: '#86efac' }
  if (action.startsWith('vip.'))         return { background: 'rgba(236,72,153,0.18)', color: '#f9a8d4' }
  return { background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Audit Log</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Sistemdeki tüm yönetici işlemlerinin kaydı — son 100 kayıt gösteriliyor
        </p>
      </div>

      {/* Filtreler */}
      <form className="rounded-xl p-5 flex flex-wrap gap-3 items-end" style={glassCard}>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
            Action filtrele
          </label>
          <input
            name="action"
            defaultValue={sp.action ?? ''}
            placeholder="örn: hotel.create, bridge.test"
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#f1f5f9',
            }}
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
            Hotel ID filtrele
          </label>
          <input
            name="hotel"
            defaultValue={sp.hotel ?? ''}
            placeholder="Hotel UUID"
            className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#f1f5f9',
            }}
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
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Filtreyi Temizle ✕
          </a>
        )}
      </form>

      {/* Log Tablosu */}
      <div className="rounded-xl overflow-hidden" style={glassCard}>
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>İşlem Kayıtları</h2>
          <span className="text-sm" style={{ color: '#64748b' }}>{typedLogs.length} kayıt</span>
        </div>
        {typedLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#64748b' }}>
            {sp.action || sp.hotel
              ? 'Bu filtrelere uyan kayıt bulunamadı.'
              : 'Henüz audit log kaydı yok.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                }}
              >
                <th className="px-6 py-3">Zaman</th>
                <th className="px-6 py-3">Kullanıcı</th>
                <th className="px-6 py-3">İşlem</th>
                <th className="px-6 py-3">Kaynak</th>
                <th className="px-6 py-3">Detay</th>
              </tr>
            </thead>
            <tbody>
              {typedLogs.map((l) => (
                <tr
                  key={l.id}
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="px-6 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#64748b' }}>
                    {new Date(l.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-6 py-3 font-medium" style={{ color: '#e2e8f0' }}>{l.actor_username}</td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium"
                      style={actionBadgeStyle(l.action)}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs" style={{ color: '#64748b' }}>
                    {l.resource_type ?? '—'}
                  </td>
                  <td className="px-6 py-3 text-xs truncate max-w-xs" style={{ color: '#475569' }}>
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
