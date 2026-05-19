'use client'

/**
 * Modul 17b — InhouseListClient
 * In-House Listesi: Tarih filtre + tablo + checkbox + aksiyon butonu
 *
 * - Default filter: "tomorrow" (yarın)
 * - Iletisim rozeti: telegram_id / whatsapp_id / ikisi de yok
 * - Secim state: selectedIds string[]
 * - "Secili Misafirlere Bildirim Gonder" butonu UI hazir (Modul 17.d'de aktif)
 */

import { useEffect, useState, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterType = 'today' | 'tomorrow' | 'range'

interface InhouseGuest {
  id: string
  room_number: string
  agency: string | null
  guest_name: string
  guest_count: number
  check_in_date: string   // YYYY-MM-DD
  check_out_date: string  // YYYY-MM-DD
  telegram_id: string | null
  whatsapp_id: string | null
  status: string
}

interface ListMeta {
  filter: FilterType
  dateStart: string
  dateEnd: string
  count: number
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayISO(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function getTomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatDDMM(dateStr: string): string {
  if (!dateStr) return '—'
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function formatDateLabel(dateStart: string, dateEnd: string): string {
  if (dateStart === dateEnd) {
    // DD.MM.YYYY formatinda
    const [y, m, d] = dateStart.split('-')
    return `${d}.${m}.${y}`
  }
  const [y1, m1, d1] = dateStart.split('-')
  const [y2, m2, d2] = dateEnd.split('-')
  return `${d1}.${m1}.${y1} – ${d2}.${m2}.${y2}`
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        color: '#f1f5f9',
        padding: '14px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontSize: '14px',
        maxWidth: '380px',
        lineHeight: '1.5',
        border: '1px solid rgba(148,163,184,0.15)',
        animation: 'slideInToast 0.3s ease',
      }}
    >
      <span style={{ marginRight: '8px' }}>ℹ️</span>
      {message}
    </div>
  )
}

// ─── Contact Badge ────────────────────────────────────────────────────────────

function ContactBadge({ guest }: { guest: InhouseGuest }) {
  if (guest.telegram_id && guest.whatsapp_id) {
    return (
      <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <span style={badgeStyle('#16a34a')}>✅ Telegram</span>
        <span style={badgeStyle('#16a34a')}>✅ WhatsApp</span>
      </span>
    )
  }
  if (guest.telegram_id) {
    return <span style={badgeStyle('#16a34a')}>✅ Telegram</span>
  }
  if (guest.whatsapp_id) {
    return <span style={badgeStyle('#16a34a')}>✅ WhatsApp</span>
  }
  return <span style={badgeStyle('#64748b')}>🚫 Yok</span>
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 600,
    color,
    background: color + '18',
    border: `1px solid ${color}30`,
    padding: '2px 8px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface InhouseListClientProps {
  slug: string
}

export default function InhouseListClient({ slug }: InhouseListClientProps) {
  // Filter state
  const [filter, setFilter] = useState<FilterType>('tomorrow')
  const [rangeStart, setRangeStart] = useState<string>(getTodayISO())
  const [rangeEnd, setRangeEnd] = useState<string>(getTomorrowISO())

  // Data state
  const [guests, setGuests] = useState<InhouseGuest[]>([])
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedIds([]) // Filtre degisince secimi sifirla

    let url = `/api/hotel-admin/${slug}/inhouse/list?filter=${filter}`
    if (filter === 'range') {
      if (!rangeStart || !rangeEnd) {
        setError('Lütfen başlangıç ve bitiş tarihlerini seçin.')
        setLoading(false)
        return
      }
      url += `&start=${rangeStart}&end=${rangeEnd}`
    }

    try {
      const res = await fetch(url)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Misafir listesi alınamadı.')
        setGuests([])
        setMeta(null)
        return
      }

      setGuests(json.guests ?? [])
      setMeta(json.meta ?? null)
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.')
      setGuests([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [slug, filter, rangeStart, rangeEnd])

  // Sayfa ilk acilisinda ve filtre degisince fetch
  useEffect(() => {
    if (filter !== 'range') {
      fetchGuests()
    }
    // range ise kullanici "Listele" butonuna basacak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // ── Checkbox helpers ─────────────────────────────────────────────────────

  const allSelected = guests.length > 0 && selectedIds.length === guests.length

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(guests.map((g) => g.id))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // ── Action button ─────────────────────────────────────────────────────────

  function handleSendNotification() {
    const count = selectedIds.length
    setToast(
      `Bu özellik Modül 17.d'de aktif olacak. Şu an ${count} misafir seçildi.`,
    )
  }

  // ── Filter tab handler ────────────────────────────────────────────────────

  function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter)
    if (newFilter !== 'range') {
      setSelectedIds([])
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const dateLabel = meta
    ? formatDateLabel(meta.dateStart, meta.dateEnd)
    : filter === 'today'
    ? formatDateLabel(getTodayISO(), getTodayISO())
    : filter === 'tomorrow'
    ? formatDateLabel(getTomorrowISO(), getTomorrowISO())
    : rangeStart && rangeEnd
    ? formatDateLabel(rangeStart, rangeEnd)
    : ''

  return (
    <>
      {/* Global animation style */}
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .inhouse-row:hover {
          background: #f8fafc !important;
        }
        .inhouse-row.selected {
          background: #eff6ff !important;
        }
        .filter-tab {
          cursor: pointer;
          transition: all 0.15s;
        }
        .filter-tab:hover {
          opacity: 0.85;
        }
        .cb-custom {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 2px solid #cbd5e1;
          cursor: pointer;
          accent-color: #0ea5e9;
          flex-shrink: 0;
        }
      `}</style>

      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", marginTop: '0' }}>

        {/* ── Bölüm başlığı ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            🚪 Çıkış Yapacak Misafirler
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Geç çıkış bildirimi göndermek için misafirleri seçin
          </p>
        </div>

        {/* ── Tarih Filtre Bar ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          {/* Bugün */}
          <button
            id="filter-btn-today"
            className="filter-tab"
            onClick={() => handleFilterChange('today')}
            style={tabStyle(filter === 'today')}
          >
            📅 Bugün
          </button>

          {/* Yarın (default) */}
          <button
            id="filter-btn-tomorrow"
            className="filter-tab"
            onClick={() => handleFilterChange('tomorrow')}
            style={tabStyle(filter === 'tomorrow')}
          >
            📅 Yarın
          </button>

          {/* Tarih Aralığı */}
          <button
            id="filter-btn-range"
            className="filter-tab"
            onClick={() => handleFilterChange('range')}
            style={tabStyle(filter === 'range')}
          >
            📆 Tarih Aralığı
          </button>

          {/* Range picker'lar */}
          {filter === 'range' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              animation: 'fadeIn 0.2s ease',
            }}>
              <input
                id="range-start-input"
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                style={dateInputStyle()}
              />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>→</span>
              <input
                id="range-end-input"
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={dateInputStyle()}
              />
              <button
                id="range-search-btn"
                onClick={fetchGuests}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
                }}
              >
                Listele
              </button>
            </div>
          )}
        </div>

        {/* ── Seçim sayacı + Aksiyon butonu ────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
          minHeight: '36px',
        }}>
          <div style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
            {selectedIds.length > 0 ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#dbeafe',
                color: '#1d4ed8',
                padding: '4px 12px',
                borderRadius: '20px',
                fontWeight: 600,
              }}>
                ✓ {selectedIds.length} misafir seçildi
              </span>
            ) : (
              <span style={{ color: '#94a3b8' }}>Henüz seçim yapılmadı</span>
            )}
          </div>

          <button
            id="send-notification-btn"
            disabled={selectedIds.length === 0}
            onClick={handleSendNotification}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              background: selectedIds.length === 0
                ? '#e2e8f0'
                : 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              color: selectedIds.length === 0 ? '#94a3b8' : '#fff',
              boxShadow: selectedIds.length === 0
                ? 'none'
                : '0 4px 12px rgba(14,165,233,0.35)',
            }}
          >
            📨 Seçili Misafirlere Çıkış Bildirim Mesajı Gönder
          </button>
        </div>

        {/* ── Hata mesajı ───────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#dc2626',
            marginBottom: '12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '48px',
            color: '#94a3b8',
            fontSize: '14px',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'spin 1s linear infinite' }}>⏳</div>
            Misafirler yükleniyor…
          </div>
        )}

        {/* ── Tablo ────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* Tablo başlığı */}
            {meta !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <p style={{ fontSize: '13px', color: '#475569', fontWeight: 600, margin: 0 }}>
                  {guests.length > 0
                    ? `${guests.length} misafir çıkış yapıyor — ${dateLabel}`
                    : `0 misafir — ${dateLabel}`}
                </p>
                {guests.length > 0 && (
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    check_out_date filtresi
                  </p>
                )}
              </div>
            )}

            {/* Boş state */}
            {guests.length === 0 && meta !== null && (
              <div style={{
                textAlign: 'center',
                padding: '56px 24px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                  Bu tarihte çıkış yapacak misafir bulunmuyor.
                </p>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '6px 0 0' }}>
                  {dateLabel} — Farklı bir tarih seçmeyi deneyin.
                </p>
              </div>
            )}

            {/* Tablo */}
            {guests.length > 0 && (
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}>
                    <thead>
                      <tr style={{
                        background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                      }}>
                        {/* Tümünü seç */}
                        <th style={{ ...thStyle(), width: '44px', textAlign: 'center' }}>
                          <input
                            id="select-all-checkbox"
                            type="checkbox"
                            className="cb-custom"
                            checked={allSelected}
                            onChange={toggleAll}
                            title="Tümünü seç / bırak"
                            style={{ accentColor: '#0ea5e9' }}
                          />
                        </th>
                        <th style={thStyle()}>Oda No</th>
                        <th style={thStyle()}>Misafir Adı</th>
                        <th style={{ ...thStyle(), display: 'table-cell' }}>Acente</th>
                        <th style={thStyle()}>Kişi</th>
                        <th style={thStyle()}>Giriş</th>
                        <th style={thStyle()}>Çıkış</th>
                        <th style={thStyle()}>İletişim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((guest, idx) => {
                        const isSelected = selectedIds.includes(guest.id)
                        return (
                          <tr
                            key={guest.id}
                            className={`inhouse-row${isSelected ? ' selected' : ''}`}
                            onClick={() => toggleOne(guest.id)}
                            style={{
                              background: isSelected ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#fafafa',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                          >
                            {/* Checkbox */}
                            <td style={{ ...tdStyle(), textAlign: 'center', width: '44px' }}>
                              <input
                                type="checkbox"
                                className="cb-custom"
                                checked={isSelected}
                                onChange={() => toggleOne(guest.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ accentColor: '#0ea5e9' }}
                              />
                            </td>
                            {/* Oda No */}
                            <td style={{ ...tdStyle(), fontWeight: 700, color: '#0f172a' }}>
                              <span style={{
                                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                                color: '#fff',
                                padding: '2px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}>
                                {guest.room_number}
                              </span>
                            </td>
                            {/* Misafir Adı */}
                            <td style={{ ...tdStyle(), fontWeight: 500, color: '#1e293b' }}>
                              {guest.guest_name}
                            </td>
                            {/* Acente */}
                            <td style={{ ...tdStyle(), color: '#64748b' }}>
                              {guest.agency ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                            {/* Kişi */}
                            <td style={{ ...tdStyle(), textAlign: 'center', color: '#475569' }}>
                              {guest.guest_count}
                            </td>
                            {/* Giriş */}
                            <td style={{ ...tdStyle(), color: '#64748b', whiteSpace: 'nowrap' }}>
                              {formatDDMM(guest.check_in_date)}
                            </td>
                            {/* Çıkış */}
                            <td style={{ ...tdStyle(), color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {formatDDMM(guest.check_out_date)}
                            </td>
                            {/* İletişim */}
                            <td style={{ ...tdStyle() }}>
                              <ContactBadge guest={guest} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} />
      )}
    </>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 18px',
    borderRadius: '10px',
    border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : '#fff',
    color: active ? '#fff' : '#475569',
    fontSize: '13px',
    fontWeight: active ? 700 : 500,
    boxShadow: active ? '0 4px 12px rgba(14,165,233,0.3)' : 'none',
    transition: 'all 0.15s',
  }
}

function dateInputStyle(): React.CSSProperties {
  return {
    padding: '7px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
  }
}

function thStyle(): React.CSSProperties {
  return {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  }
}

function tdStyle(): React.CSSProperties {
  return {
    padding: '11px 14px',
    verticalAlign: 'middle',
    fontSize: '13px',
  }
}
