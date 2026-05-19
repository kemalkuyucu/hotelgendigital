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

interface LastNotification {
  notification_date: string
  status: string
  sent_at: string | null
}

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
  last_notification: LastNotification | null
}

interface ListMeta {
  filter?: FilterType
  view?: string
  dateStart?: string
  dateEnd?: string
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

// ─── Notification Badge ───────────────────────────────────────────────────────

function formatNotifTime(sent_at: string | null): string {
  if (!sent_at) return ''
  const d = new Date(sent_at)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${min}`
}

function NotificationBadge({
  notif,
  filterDate,
}: {
  notif: LastNotification | null
  filterDate?: string
}) {
  if (!notif) {
    return (
      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        🔔 Henüz gönderilmedi
      </span>
    )
  }
  const sameDay = filterDate && notif.notification_date === filterDate
  return (
    <span
      title={sameDay ? 'Bu misafire bu tarih için daha önce bildirim gönderildi' : undefined}
      style={{
        fontSize: '11px',
        color: sameDay ? '#16a34a' : '#0369a1',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 600,
      }}
    >
      ✅ {formatNotifTime(notif.sent_at)} gönderildi
    </span>
  )
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

  // Accordion (Bolum 2 - Tum Misafirler)
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [allGuests, setAllGuests] = useState<InhouseGuest[]>([])
  const [allGuestsLoading, setAllGuestsLoading] = useState(false)
  const [allGuestsSearch, setAllGuestsSearch] = useState('')

  // ── Fetch (Bolum 1 - filtreli) ───────────────────────────────────────────

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedIds([])

    let url = `/api/hotel-admin/${slug}/inhouse/list?view=filter&filter=${filter}`
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

  // ── Fetch (Bolum 2 - tum misafirler) ────────────────────────────────────

  const fetchAllGuests = useCallback(async () => {
    setAllGuestsLoading(true)
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/inhouse/list?view=all`)
      const json = await res.json()
      if (res.ok) {
        setAllGuests(json.guests ?? [])
      }
    } catch {
      // silent fail - accordion shows empty
    } finally {
      setAllGuestsLoading(false)
    }
  }, [slug])

  // Sayfa ilk acilisinda ve filtre degisince fetch
  useEffect(() => {
    if (filter !== 'range') {
      fetchGuests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Accordion acildiginda fetch
  useEffect(() => {
    if (accordionOpen && allGuests.length === 0) {
      fetchAllGuests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accordionOpen])

  // ── Current filter date (for disabled check) ─────────────────────────────

  const currentFilterDate: string | undefined =
    meta?.dateStart === meta?.dateEnd ? meta?.dateStart : undefined

  // Disabled = same-day notification already sent
  function isDisabled(g: InhouseGuest): boolean {
    if (!currentFilterDate) return false
    return !!g.last_notification && g.last_notification.notification_date === currentFilterDate
  }

  // ── Checkbox helpers ─────────────────────────────────────────────────────

  const enabledGuests = guests.filter((g) => !isDisabled(g))
  const allSelected = enabledGuests.length > 0 && selectedIds.length === enabledGuests.length

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(enabledGuests.map((g) => g.id))
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
    ? formatDateLabel(meta.dateStart ?? '', meta.dateEnd ?? '')
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
                {enabledGuests.length < guests.length && (
                  <span style={{ fontSize: '11px', fontWeight: 400, color: '#3b82f6' }}>
                    (toplam {enabledGuests.length} gönderilebilir)
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: '#94a3b8' }}>
                {enabledGuests.length < guests.length
                  ? `${guests.length - enabledGuests.length} satır devre dışı (zaten gönderildi)`
                  : 'Henüz seçim yapılmadı'}
              </span>
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
                        <th style={thStyle()}>Son Bildirim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((guest, idx) => {
                        const isSelected = selectedIds.includes(guest.id)
                        const disabled = isDisabled(guest)
                        return (
                          <tr
                            key={guest.id}
                            className={`inhouse-row${isSelected ? ' selected' : ''}`}
                            onClick={() => !disabled && toggleOne(guest.id)}
                            style={{
                              background: disabled
                                ? '#f8fafc'
                                : isSelected ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#fafafa',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: disabled ? 'default' : 'pointer',
                              transition: 'background 0.1s',
                              opacity: disabled ? 0.7 : 1,
                            }}
                          >
                            {/* Checkbox */}
                            <td style={{ ...tdStyle(), textAlign: 'center', width: '44px' }}>
                              <input
                                type="checkbox"
                                className="cb-custom"
                                checked={isSelected}
                                disabled={disabled}
                                onChange={() => toggleOne(guest.id)}
                                onClick={(e) => e.stopPropagation()}
                                title={disabled ? 'Bu misafire bu tarih için daha önce bildirim gönderildi' : undefined}
                                style={{ accentColor: '#0ea5e9', cursor: disabled ? 'not-allowed' : 'pointer' }}
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
                            {/* Son Bildirim */}
                            <td style={{ ...tdStyle() }}>
                              <NotificationBadge notif={guest.last_notification} filterDate={currentFilterDate} />
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

      {/* ══ BÖLÜM 2: TÜM AKTİF MİSAFİRLER (Akordiyon) ══════════════════════ */}
      <div style={{ marginTop: '32px' }}>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontStyle: 'italic' }}>
          Oteldeki tüm konaklayan misafirlerin gerçek zamanlı listesi.
          Bildirim göndermek için yukarıdaki filtreyi kullanın.
        </p>
        {/* Akordiyon başlığı */}
        <button
          id="accordion-all-guests-btn"
          onClick={() => setAccordionOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: accordionOpen ? 'linear-gradient(135deg, #0f172a, #1e3a5f)' : '#f1f5f9',
            border: '1px solid ' + (accordionOpen ? 'transparent' : '#e2e8f0'),
            borderRadius: accordionOpen ? '16px 16px 0 0' : '16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            color: accordionOpen ? '#f0f9ff' : '#0f172a',
            transition: 'all 0.2s',
          }}
        >
          <span>
            {accordionOpen ? '▼' : '▶'}
            {' '}🏨 Tüm Misafirler
            {allGuests.length > 0 && (
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                fontWeight: 500,
                color: accordionOpen ? '#7dd3fc' : '#64748b',
              }}>
                ({allGuests.length} kişi)
              </span>
            )}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: accordionOpen ? '#7dd3fc' : '#94a3b8' }}>
            {accordionOpen ? 'Kapat' : 'Tıkla / Aç'}
          </span>
        </button>

        {/* Akordiyon içeriği */}
        {accordionOpen && (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderTop: 'none',
            borderRadius: '0 0 16px 16px',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease',
          }}>
            {/* Arama */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <input
                id="all-guests-search"
                type="text"
                placeholder="Oda no veya misafir adı ara..."
                value={allGuestsSearch}
                onChange={(e) => setAllGuestsSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {allGuestsLoading && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                ⏳ Yükleniyor...
              </div>
            )}

            {!allGuestsLoading && (() => {
              const term = allGuestsSearch.toLowerCase()
              const filtered = term
                ? allGuests.filter(
                    (g) =>
                      g.room_number.toLowerCase().includes(term) ||
                      g.guest_name.toLowerCase().includes(term),
                  )
                : allGuests
              return (
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                        <th style={{ ...thStyle(), color: '#475569' }}>Oda</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>Misafir</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>Acente</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>Giriş</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>Çıkış</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>İletişim</th>
                        <th style={{ ...thStyle(), color: '#475569' }}>Son Bildirim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                            {allGuestsSearch ? 'Arama sonucu bulunamadı.' : 'Aktif misafir yok.'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((g, idx) => (
                          <tr
                            key={g.id}
                            style={{
                              background: idx % 2 === 0 ? '#fff' : '#fafafa',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                          >
                            <td style={{ ...tdStyle() }}>
                              <span style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}>
                                {g.room_number}
                              </span>
                            </td>
                            <td style={{ ...tdStyle(), fontWeight: 500 }}>{g.guest_name}</td>
                            <td style={{ ...tdStyle(), color: '#64748b' }}>{g.agency ?? '—'}</td>
                            <td style={{ ...tdStyle(), color: '#64748b', whiteSpace: 'nowrap' }}>{formatDDMM(g.check_in_date)}</td>
                            <td style={{ ...tdStyle(), fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDDMM(g.check_out_date)}</td>
                            <td style={{ ...tdStyle() }}><ContactBadge guest={g} /></td>
                            <td style={{ ...tdStyle() }}>
                              <NotificationBadge notif={g.last_notification} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
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
