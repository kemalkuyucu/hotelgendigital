'use client'

import { useEffect, useState, useCallback } from 'react'
import type { DepartmentKey } from '@/lib/hotel-admin/types'
import { deptLabel } from '@/lib/hotel-admin/types'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface StaffRow {
  id: string
  department_key: string
  full_name: string
  role_title: string | null
  telegram_user_id: string | null
  telegram_username: string | null
  whatsapp_id: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
}

interface Props {
  slug: string
  adminRole: string
  adminRoleLabel: string
  allowedDepts: DepartmentKey[]
  isOwner: boolean
}

// ─── Departman renk paleti ────────────────────────────────────────────────────
const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  front_office:   { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.25)',  text: '#a5b4fc', badge: 'rgba(99,102,241,0.18)'  },
  housekeeping:   { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  text: '#6ee7b7', badge: 'rgba(16,185,129,0.18)'  },
  technical:      { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#fcd34d', badge: 'rgba(245,158,11,0.18)'  },
  fb:             { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#fca5a5', badge: 'rgba(239,68,68,0.18)'   },
  guest_relation: { bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.25)',  text: '#f9a8d4', badge: 'rgba(236,72,153,0.18)'  },
  spa:            { bg: 'rgba(14,165,233,0.08)',  border: 'rgba(14,165,233,0.25)',  text: '#7dd3fc', badge: 'rgba(14,165,233,0.18)'  },
  animation:      { bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.25)',  text: '#d8b4fe', badge: 'rgba(168,85,247,0.18)'  },
}

function getDeptColor(key: string) {
  return DEPT_COLORS[key] ?? {
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.25)',
    text: '#94a3b8',
    badge: 'rgba(100,116,139,0.18)',
  }
}

// ─── Format tarih ─────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── WhatsApp Sütun Başlığı ───────────────────────────────────────────────────
function WhatsAppHeader() {
  return (
    <th style={{
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: 700,
      color: '#22c55e',
      whiteSpace: 'nowrap',
      letterSpacing: '0.03em',
    }}>
      📱 <span style={{ borderBottom: '2px solid #22c55e' }}>WhatsApp ID</span>
    </th>
  )
}

// ─── Telegram Sütun Başlığı ────────────────────────────────────────────────────
function TelegramHeader() {
  return (
    <th style={{
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: 700,
      color: '#38bdf8',
      whiteSpace: 'nowrap',
      letterSpacing: '0.03em',
    }}>
      ✈️ <span style={{ borderBottom: '2px solid #38bdf8' }}>Telegram ID</span>
    </th>
  )
}

// ─── ID Hücre ─────────────────────────────────────────────────────────────────
function IdCell({ value, type }: { value: string | null; type: 'whatsapp' | 'telegram' }) {
  if (!value) {
    return (
      <span style={{
        color: '#475569',
        fontSize: '12px',
        fontStyle: 'italic',
      }}>
        — tanımlı değil
      </span>
    )
  }

  const isWa = type === 'whatsapp'
  return (
    <code style={{
      fontSize: '12px',
      fontFamily: "'Courier New', monospace",
      background: isWa ? 'rgba(34,197,94,0.10)' : 'rgba(56,189,248,0.10)',
      color: isWa ? '#4ade80' : '#7dd3fc',
      padding: '3px 8px',
      borderRadius: '6px',
      border: `1px solid ${isWa ? 'rgba(34,197,94,0.25)' : 'rgba(56,189,248,0.25)'}`,
      display: 'inline-block',
      maxWidth: '180px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}>
      {value}
    </code>
  )
}

// ─── Durum Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      background: active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
      color: active ? '#4ade80' : '#64748b',
      border: `1px solid ${active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}`,
    }}>
      <span style={{ fontSize: '8px' }}>{active ? '●' : '●'}</span>
      {active ? 'Aktif' : 'Arşiv'}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{
            height: '14px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Ana Component ────────────────────────────────────────────────────────────
export default function DepartmanPersonelClient({
  slug,
  adminRole,
  adminRoleLabel,
  allowedDepts,
  isOwner,
}: Props) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDept, setFilterDept] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/department-staff`)
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json() as { staff: StaffRow[] }
      setStaff(json.staff)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void fetchStaff() }, [fetchStaff])

  // ── Filtreler ──────────────────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    if (filterDept !== 'all' && s.department_key !== filterDept) return false
    if (filterStatus === 'active' && !s.is_active) return false
    if (filterStatus === 'archived' && s.is_active) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.whatsapp_id ?? '').toLowerCase().includes(q) ||
        (s.telegram_user_id ?? '').toLowerCase().includes(q) ||
        (s.telegram_username ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Özet istatistikler ─────────────────────────────────────────────────────
  const totalActive = staff.filter(s => s.is_active).length
  const totalArchived = staff.filter(s => !s.is_active).length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '32px',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .staff-row:hover td {
          background: rgba(255,255,255,0.03) !important;
        }
        .filter-select:focus {
          outline: none;
          border-color: rgba(99,102,241,0.5) !important;
        }
        .search-input:focus {
          outline: none;
          border-color: rgba(99,102,241,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#f1f5f9',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
              }}>
                👥 Departman Personeli
              </h1>
              <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
                {isOwner
                  ? 'Tüm departmanların personel listesi — salt okunur görünüm'
                  : `${adminRoleLabel} — kendi departmanınızın personeli`}
              </p>
            </div>

            {/* Rol rozeti */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: isOwner ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
              border: `1px solid ${isOwner ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
              fontSize: '12px',
              fontWeight: 600,
              color: isOwner ? '#fcd34d' : '#a5b4fc',
            }}>
              {isOwner ? '👁️ Görüntüleme' : '🏢 Departman Yöneticisi'}
              <span style={{
                fontSize: '10px',
                fontWeight: 400,
                opacity: 0.8,
              }}>
                {isOwner ? '(salt okunur)' : `(${allowedDepts.map(d => deptLabel(d)).join(', ')})`}
              </span>
            </div>
          </div>
        </div>

        {/* ── İstatistik Kartlar ──────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {[
            { label: 'Toplam Personel', value: staff.length, color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
            { label: 'Aktif', value: totalActive, color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
            { label: 'Arşiv', value: totalArchived, color: '#94a3b8', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
            { label: 'Departman', value: allowedDepts.length, color: '#7dd3fc', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)' },
          ].map(card => (
            <div key={card.label} style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: '14px',
              padding: '16px 20px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {loading ? '—' : card.value}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtreler ────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}>
          {/* Arama */}
          <input
            className="search-input"
            type="text"
            placeholder="🔍 Ad, WhatsApp ID veya Telegram ID ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 220px',
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              fontSize: '13px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />

          {/* Departman filtresi (sadece owner'a) */}
          {isOwner && (
            <select
              className="filter-select"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '9px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <option value="all" style={{ background: '#1e293b' }}>🏢 Tüm Departmanlar</option>
              {allowedDepts.map(d => (
                <option key={d} value={d} style={{ background: '#1e293b' }}>
                  {deptLabel(d)}
                </option>
              ))}
            </select>
          )}

          {/* Durum filtresi */}
          <select
            className="filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <option value="all" style={{ background: '#1e293b' }}>📋 Tümü</option>
            <option value="active" style={{ background: '#1e293b' }}>✅ Sadece Aktif</option>
            <option value="archived" style={{ background: '#1e293b' }}>🗂️ Sadece Arşiv</option>
          </select>

          {/* Yenile */}
          <button
            onClick={() => void fetchStaff()}
            disabled={loading}
            style={{
              padding: '9px 16px',
              borderRadius: '9px',
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.12)',
              color: '#a5b4fc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Yenile
          </button>
        </div>

        {/* ── Tablo ────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}>

          {/* WhatsApp/Telegram uyarı bandı */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            padding: '10px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '11.5px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'rgba(34,197,94,0.4)',
                border: '1px solid rgba(34,197,94,0.6)',
              }} />
              <span style={{ color: '#4ade80', fontWeight: 600 }}>📱 WhatsApp</span>
              <span style={{ color: '#64748b' }}>— yeşil alan, uluslararası format (örn: 905551234567)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'rgba(56,189,248,0.4)',
                border: '1px solid rgba(56,189,248,0.6)',
              }} />
              <span style={{ color: '#7dd3fc', fontWeight: 600 }}>✈️ Telegram</span>
              <span style={{ color: '#64748b' }}>— mavi alan, sayısal Chat ID</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Ad Soyad
                  </th>
                  {/* WhatsApp — belirgin yeşil */}
                  <WhatsAppHeader />
                  {/* Telegram — belirgin mavi */}
                  <TelegramHeader />
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Departman
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Durum
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Eklenme
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton */}
                {loading && [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}

                {/* Hata */}
                {!loading && error && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        maxWidth: '360px',
                      }}>
                        <div style={{ fontSize: '36px' }}>⚠️</div>
                        <p style={{ color: '#f87171', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                          Veri yüklenemedi
                        </p>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>
                          {error}
                        </p>
                        <button
                          onClick={() => void fetchStaff()}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#fca5a5',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Tekrar Dene
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Boş durum */}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '64px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                        {staff.length === 0 ? '👥' : '🔍'}
                      </div>
                      <p style={{ color: '#475569', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
                        {staff.length === 0 ? 'Henüz personel eklenmemiş' : 'Filtreye uyan personel yok'}
                      </p>
                      <p style={{ color: '#334155', fontSize: '13px', margin: 0 }}>
                        {staff.length === 0
                          ? 'Adım 2\'de personel ekleme özelliği eklenecek.'
                          : 'Filtreleri değiştirerek tekrar deneyin.'}
                      </p>
                    </td>
                  </tr>
                )}

                {/* Personel satırları */}
                {!loading && !error && filtered.map(row => {
                  const deptColor = getDeptColor(row.department_key)
                  return (
                    <tr
                      key={row.id}
                      className="staff-row"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Ad Soyad + Ünvan */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div>
                          <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                            {row.full_name}
                          </span>
                          {row.role_title && (
                            <span style={{
                              display: 'block',
                              color: '#64748b',
                              fontSize: '11.5px',
                              marginTop: '2px',
                            }}>
                              {row.role_title}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp ID — yeşil vurgu */}
                      <td style={{
                        padding: '14px 16px',
                        verticalAlign: 'middle',
                        borderLeft: '2px solid rgba(34,197,94,0.15)',
                      }}>
                        <IdCell value={row.whatsapp_id} type="whatsapp" />
                      </td>

                      {/* Telegram ID — mavi vurgu */}
                      <td style={{
                        padding: '14px 16px',
                        verticalAlign: 'middle',
                        borderLeft: '2px solid rgba(56,189,248,0.15)',
                      }}>
                        <IdCell
                          value={row.telegram_user_id ?? row.telegram_username}
                          type="telegram"
                        />
                      </td>

                      {/* Departman Badge */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: deptColor.bg,
                          border: `1px solid ${deptColor.border}`,
                          color: deptColor.text,
                          whiteSpace: 'nowrap',
                        }}>
                          {deptLabel(row.department_key as DepartmentKey)}
                        </span>
                      </td>

                      {/* Durum */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <StatusBadge active={row.is_active} />
                      </td>

                      {/* Eklenme tarihi */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span style={{ color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDate(row.created_at)}
                        </span>
                        {row.created_by && (
                          <span style={{ display: 'block', color: '#334155', fontSize: '11px', marginTop: '2px' }}>
                            {row.created_by}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Alt bilgi */}
          {!loading && !error && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#475569',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <span>
                {filtered.length} kayıt gösteriliyor
                {filtered.length !== staff.length && ` (toplam ${staff.length} kayıttan)`}
              </span>
              {isOwner && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.15)',
                  color: '#fbbf24',
                  fontSize: '11px',
                }}>
                  👁️ Otel Sahibi — Salt Okunur Görünüm
                </span>
              )}
            </div>
          )}
        </div>

        {/* Adım 2 placeholder kartı */}
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          opacity: 0.7,
        }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <p style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 600, margin: 0 }}>
              Personel Ekle / Arşivle — Adım 2
            </p>
            <p style={{ color: '#475569', fontSize: '12px', margin: '2px 0 0' }}>
              Yazma işlemleri (ekle, arşivle) bir sonraki adımda devreye alınacak.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
