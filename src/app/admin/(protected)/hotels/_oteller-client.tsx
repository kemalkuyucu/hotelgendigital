'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ParticleBackground = dynamic(
  () => import('@/components/landing/ParticleBackground'),
  { ssr: false }
)

type PackageRef = { display_name: string }

interface Hotel {
  id: string
  name: string
  slug: string
  status: string
  is_demo: boolean
  package_id: string | null
  packages: unknown
  deleted_at: string | null
  deleted_by: string | null
}

function getPackageName(packages: unknown): string | null {
  if (!packages) return null
  if (Array.isArray(packages)) return (packages as PackageRef[])[0]?.display_name ?? null
  return (packages as PackageRef).display_name ?? null
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-600',
    deleted: 'bg-red-200 text-red-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

// ─── Delete Confirmation Modal ──────────────────────────────────────────────

interface DeleteModalProps {
  hotel: Hotel
  onClose: () => void
  onDeleted: () => void
}

function DeleteModal({ hotel, onClose, onDeleted }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const isMatch = confirmText === hotel.name

  async function handleDelete() {
    setError('')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotels/${hotel.id}/delete`, { method: 'POST' })
        const data = await res.json() as { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Silme işlemi başarısız')
          return
        }
        onDeleted()
      } catch {
        setError('Ağ hatası, lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        border: '1px solid #fee2e2',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            background: '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>⚠️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Otel Silinecek
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Bu işlem 30 gün içinde geri alınabilir
            </p>
          </div>
        </div>

        {/* Hotel name highlight */}
        <div style={{
          background: '#fef3f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#9ca3af' }}>Silinecek otel</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#dc2626', letterSpacing: '-0.5px' }}>
            {hotel.name}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>
            /{hotel.slug}
          </p>
        </div>

        {/* Warning */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#92400e',
          lineHeight: 1.5,
        }}>
          🕐 Bu işlem 30 gün içinde <strong>Silinmiş Oteller</strong> sekmesinden geri alınabilir.
          30 günü geçen silmeler kalıcı hale gelir.
        </div>

        {/* Confirm input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Onaylamak için otel ismini AYNEN yazın:
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={hotel.name}
            autoComplete="off"
            style={{
              width: '100%',
              border: `2px solid ${isMatch ? '#22c55e' : confirmText.length > 0 ? '#f87171' : '#d1d5db'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          {confirmText.length > 0 && !isMatch && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ef4444' }}>
              ✗ Otel ismiyle eşleşmiyor
            </p>
          )}
          {isMatch && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#22c55e' }}>
              ✓ Eşleşti
            </p>
          )}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#dc2626', marginBottom: '16px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            İptal
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || isPending}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '8px',
              border: 'none',
              background: isMatch && !isPending ? '#dc2626' : '#d1d5db',
              color: isMatch && !isPending ? '#fff' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isMatch && !isPending ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isPending ? 'Siliniyor...' : '🗑 Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Restore / Hard Delete buttons ─────────────────────────────────────────

function RestoreButton({ hotelId, onDone }: { hotelId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    startTransition(async () => {
      await fetch(`/api/admin/hotels/${hotelId}/restore`, { method: 'POST' })
      onDone()
    })
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      className="text-green-600 hover:text-green-700 font-medium text-sm disabled:opacity-50"
    >
      {isPending ? '...' : '↩ Geri Yükle'}
    </button>
  )
}

// ─── Main Client Component ──────────────────────────────────────────────────

interface OtellerClientProps {
  hotels: Hotel[]
}

export default function OtellerClient({ hotels }: OtellerClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'active' | 'deleted'>('active')
  const [deleteTarget, setDeleteTarget] = useState<Hotel | null>(null)

  const activeHotels = hotels.filter((h) => !h.deleted_at)
  const deletedHotels = hotels.filter((h) => !!h.deleted_at)

  const displayed = tab === 'active' ? activeHotels : deletedHotels

  function refresh() {
    setDeleteTarget(null)
    router.refresh()
  }

  const tabBtn = (active: boolean) => ({
    padding: '8px 20px',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#1e40af' : 'transparent',
    color: active ? '#fff' : '#6b7280',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0a0f1e 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Particle background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <ParticleBackground
          particleId="hotels-admin-particles"
          opacity={0.35}
          particleCount={40}
          speed={0.35}
          linkOpacity={0.10}
          fpsLimit={30}
          disableOnMobile={true}
        />
      </div>

      {/* Content layer */}
      <div className="p-8 space-y-6" style={{ position: 'relative', zIndex: 10 }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Oteller</h1>
          <p className="mt-1" style={{ color: '#94a3b8' }}>
            {activeHotels.length} aktif
            {deletedHotels.length > 0 && ` · ${deletedHotels.length} silinmiş`}
          </p>
        </div>
        <Link
          href="/admin/hotels/onboarding"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Yeni Otel
        </Link>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'inline-flex',
        background: '#f3f4f6',
        borderRadius: '10px',
        padding: '4px',
        gap: '2px',
      }}>
        <button id="tab-active-hotels" style={tabBtn(tab === 'active')} onClick={() => setTab('active')}>
          🏨 Aktif
          <span style={{
            marginLeft: '6px',
            background: tab === 'active' ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
            color: tab === 'active' ? '#fff' : '#6b7280',
            borderRadius: '999px',
            padding: '1px 7px',
            fontSize: '12px',
          }}>{activeHotels.length}</span>
        </button>
        <button id="tab-deleted-hotels" style={tabBtn(tab === 'deleted')} onClick={() => setTab('deleted')}>
          🗑 Silinmiş
          {deletedHotels.length > 0 && (
            <span style={{
              marginLeft: '6px',
              background: tab === 'deleted' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
              color: tab === 'deleted' ? '#fff' : '#dc2626',
              borderRadius: '999px',
              padding: '1px 7px',
              fontSize: '12px',
              fontWeight: 600,
            }}>{deletedHotels.length}</span>
          )}
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Otel</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Slug</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Paket</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Durum</th>
              {tab === 'deleted' && (
                <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Silinme</th>
              )}
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length > 0 ? (
              displayed.map((h) => (
                <tr key={h.id} className={`transition-colors ${h.deleted_at ? 'opacity-60' : ''}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: '#f1f5f9' }}>{h.name}</span>
                      {h.is_demo && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          DEMO
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm" style={{ color: '#64748b' }}>{h.slug}</td>
                  <td className="p-4 text-sm" style={{ color: '#cbd5e1' }}>
                    {getPackageName(h.packages) ?? <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  {tab === 'deleted' && (
                    <td className="p-4 text-xs" style={{ color: '#64748b' }}>
                      {h.deleted_at ? (
                        <div>
                          <div>{new Date(h.deleted_at).toLocaleDateString('tr-TR')}</div>
                          {h.deleted_by && <div style={{ color: '#475569' }}>@{h.deleted_by}</div>}
                        </div>
                      ) : '—'}
                    </td>
                  )}
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-sm">
                      {tab === 'active' ? (
                        <>
                          <Link href={`/admin/hotels/${h.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                            Düzenle
                          </Link>
                          <Link href={`/admin/hotels/${h.id}/credentials`} className="text-purple-600 hover:text-purple-700 font-medium">
                            Bridge
                          </Link>
                          <Link href={`/admin/hotels/${h.id}/vip-managers`} className="text-green-600 hover:text-green-700 font-medium">
                            VIP
                          </Link>
                          <button
                            id={`delete-btn-${h.id}`}
                            type="button"
                            onClick={() => setDeleteTarget(h)}
                            className="text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Sil
                          </button>
                        </>
                      ) : (
                        <>
                          <RestoreButton hotelId={h.id} onDone={refresh} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tab === 'deleted' ? 6 : 5} className="p-8 text-center text-sm" style={{ color: '#64748b' }}>
                  {tab === 'active' ? (
                    <>
                      Henüz otel eklenmemiş.{' '}
                      <Link href="/admin/hotels/onboarding" style={{ color: '#60a5fa' }} className="hover:underline">
                        İlk oteli ekle →
                      </Link>
                    </>
                  ) : (
                    'Silinmiş otel yok.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

        {/* Delete modal */}
        {deleteTarget && (
          <DeleteModal
            hotel={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={refresh}
          />
        )}
      </div>
    </div>
  )
}
