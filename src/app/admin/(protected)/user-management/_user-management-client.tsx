'use client'

import { useState, useTransition, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HotelOption {
  id: string
  name: string
  slug: string
  status: string
  is_demo: boolean
}

interface HotelAdminUser {
  id: string
  username: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

interface UserManagementClientProps {
  hotels: HotelOption[]
}

// ─── Role → Türkçe ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  hotel_owner: 'Otel Sahibi',
  front_office_manager: 'Ön Büro Müdürü',
  housekeeping_manager: 'Housekeeping Müdürü',
  technical_manager: 'Teknik Müdürü',
  fb_manager: 'F&B Müdürü',
  guest_relation_manager: 'Guest Relation Müdürü',
  spa_manager: 'SPA Müdürü',
  animation_manager: 'Animasyon Müdürü',
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

// ─── Role renkler ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hotel_owner:            { bg: 'rgba(250,204,21,0.15)',  text: '#facc15', border: 'rgba(250,204,21,0.3)' },
  front_office_manager:   { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  housekeeping_manager:   { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  technical_manager:      { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  fb_manager:             { bg: 'rgba(232,121,249,0.15)', text: '#e879f9', border: 'rgba(232,121,249,0.3)' },
  guest_relation_manager: { bg: 'rgba(129,140,248,0.15)', text: '#818cf8', border: 'rgba(129,140,248,0.3)' },
  spa_manager:            { bg: 'rgba(244,114,182,0.15)', text: '#f472b6', border: 'rgba(244,114,182,0.3)' },
  animation_manager:      { bg: 'rgba(45,212,191,0.15)', text: '#2dd4bf', border: 'rgba(45,212,191,0.3)' },
}

function getRoleStyle(role: string) {
  return ROLE_COLORS[role] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} style={{ padding: '16px' }}>
          <div
            style={{
              height: '14px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.08)',
              animation: 'pulse 1.5s ease-in-out infinite',
              width: i === 1 ? '120px' : i === 2 ? '160px' : i === 3 ? '140px' : i === 4 ? '64px' : '80px',
            }}
          />
        </td>
      ))}
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagementClient({ hotels }: UserManagementClientProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string>('')
  const [users, setUsers] = useState<HotelAdminUser[]>([])
  const [selectedHotelName, setSelectedHotelName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasLoaded, setHasLoaded] = useState(false)

  const activeHotels = hotels.filter((h) => h.status === 'active')

  const loadUsers = useCallback((hotelId: string, hotelName: string) => {
    if (!hotelId) return
    setError(null)
    setHasLoaded(false)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotel-users?hotelId=${encodeURIComponent(hotelId)}`)
        const data = await res.json() as { users?: HotelAdminUser[]; error?: string }

        if (!res.ok) {
          setError(data.error ?? 'Kullanıcılar yüklenemedi.')
          setUsers([])
        } else {
          setUsers(data.users ?? [])
        }
        setHasLoaded(true)
        setSelectedHotelName(hotelName)
      } catch {
        setError('Ağ hatası. Lütfen tekrar deneyin.')
        setUsers([])
        setHasLoaded(true)
      }
    })
  }, [])

  function handleHotelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const hotelId = e.target.value
    setSelectedHotelId(hotelId)
    if (hotelId) {
      const hotel = activeHotels.find((h) => h.id === hotelId)
      loadUsers(hotelId, hotel?.name ?? '')
    } else {
      setUsers([])
      setHasLoaded(false)
      setError(null)
    }
  }

  const activeUsers  = users.filter((u) => u.is_active)
  const passiveUsers = users.filter((u) => !u.is_active)

  return (
    <div style={{ padding: '32px 40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Pulse animation keyframe ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
          👥 Kullanıcı Yönetimi
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '6px 0 0' }}>
          Otel müdür &amp; yetkili hesaplarını görüntüleyin (Katman 1 — salt okunur)
        </p>
      </div>

      {/* ── Hotel Selector Card ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <label
          htmlFor="hotel-select"
          style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}
        >
          🏨 Otel Seçin
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="hotel-select"
            value={selectedHotelId}
            onChange={handleHotelChange}
            style={{
              flex: '1',
              minWidth: '240px',
              maxWidth: '400px',
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '14px',
              padding: '11px 16px',
              outline: 'none',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: '36px',
            }}
          >
            <option value="">— Otel seçin —</option>
            {activeHotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}{h.is_demo ? ' (Demo)' : ''}
              </option>
            ))}
          </select>

          {selectedHotelId && hasLoaded && !isPending && (
            <div style={{
              fontSize: '13px', color: '#94a3b8',
              animation: 'fadeInUp 0.3s ease',
            }}>
              {users.length > 0
                ? `${users.length} kullanıcı · ${activeUsers.length} aktif · ${passiveUsers.length} pasif`
                : 'Kullanıcı bulunamadı'}
            </div>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#fca5a5',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Empty state (no hotel selected) ── */}
      {!selectedHotelId && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '64px 32px',
            textAlign: 'center',
            color: '#475569',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🏨</div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#64748b' }}>
            Kullanıcıları görüntülemek için bir otel seçin
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#475569' }}>
            {activeHotels.length} aktif otel mevcut
          </p>
        </div>
      )}

      {/* ── Users Table ── */}
      {(selectedHotelId && (isPending || hasLoaded)) && (
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeInUp 0.35s ease',
          }}
        >
          {/* Table header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                {selectedHotelName ? `${selectedHotelName} — Kullanıcılar` : 'Kullanıcılar'}
              </h2>
              {!isPending && hasLoaded && (
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Kayıt: {users.length} &nbsp;·&nbsp; hotel_admin_users tablosu
                </p>
              )}
            </div>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              SALT OKUNUR
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Kullanıcı Adı', 'Ad Soyad', 'Rol', 'Durum', 'Oluşturulma'].map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '12px 20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  // Loading skeletons
                  [1, 2, 3].map((i) => <SkeletonRow key={i} />)
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: 'center',
                        padding: '56px 24px',
                        color: '#475569',
                        fontSize: '14px',
                      }}
                    >
                      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>👤</div>
                      Bu otelde henüz kullanıcı bulunmuyor
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const roleStyle = getRoleStyle(user.role)
                    return (
                      <tr
                        key={user.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          opacity: user.is_active ? 1 : 0.6,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {/* Kullanıcı Adı */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '10px',
                                background: user.is_active
                                  ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.3) 100%)'
                                  : 'rgba(100,116,139,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                flexShrink: 0,
                                border: user.is_active
                                  ? '1px solid rgba(99,102,241,0.3)'
                                  : '1px solid rgba(100,116,139,0.2)',
                              }}
                            >
                              {user.is_active ? '👤' : '🔒'}
                            </div>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: user.is_active ? '#e2e8f0' : '#64748b',
                                letterSpacing: '0.02em',
                              }}
                            >
                              @{user.username}
                            </span>
                          </div>
                        </td>

                        {/* Ad Soyad */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: '14px', color: user.is_active ? '#cbd5e1' : '#64748b', fontWeight: 500 }}>
                            {user.full_name || '—'}
                          </span>
                        </td>

                        {/* Rol */}
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: roleStyle.bg,
                              color: roleStyle.text,
                              border: `1px solid ${roleStyle.border}`,
                              whiteSpace: 'nowrap',
                              opacity: user.is_active ? 1 : 0.6,
                            }}
                          >
                            {roleLabel(user.role)}
                          </span>
                        </td>

                        {/* Durum */}
                        <td style={{ padding: '16px 20px' }}>
                          {user.is_active ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'rgba(52,211,153,0.12)',
                                color: '#34d399',
                                border: '1px solid rgba(52,211,153,0.25)',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                              Aktif
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'rgba(100,116,139,0.12)',
                                color: '#64748b',
                                border: '1px solid rgba(100,116,139,0.2)',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569', display: 'inline-block' }} />
                              Pasif
                            </span>
                          )}
                        </td>

                        {/* Oluşturulma */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: '13px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {formatDate(user.created_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
