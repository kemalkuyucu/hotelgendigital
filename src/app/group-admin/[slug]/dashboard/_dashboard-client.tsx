'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { GroupManagerJwtPayload } from '@/lib/group-admin/auth'
import type { GroupHotel } from '@/app/api/group-admin/[slug]/hotels/route'

const ParticleBackground = dynamic(
  () => import('@/components/landing/ParticleBackground'),
  { ssr: false }
)

interface Props {
  slug: string
  manager: GroupManagerJwtPayload
}

// ---------------------------------------------------------------------------
// Tarih yardımcıları — TR saati, UTC kayması yok
// ---------------------------------------------------------------------------

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(base: Date, delta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta)
  return d
}

function getPreset(preset: 'week' | 'month' | 'thisMonth'): { start: string; end: string } {
  const today = new Date()
  const todayStr = toLocalDateStr(today)

  if (preset === 'week') {
    return { start: toLocalDateStr(addDays(today, -6)), end: todayStr }
  }
  if (preset === 'month') {
    return { start: toLocalDateStr(addDays(today, -29)), end: todayStr }
  }
  // thisMonth: ay başı → bugün
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  return { start: toLocalDateStr(firstOfMonth), end: todayStr }
}


// Glassmorphism kart stili
// ---------------------------------------------------------------------------
const glassCard: React.CSSProperties = {
  background: 'rgba(10,15,30,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(139,92,246,0.20)',
  borderRadius: '20px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03) inset',
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------

export default function GroupDashboardClient({ slug, manager }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)

  // -- Otel state --
  const [hotels, setHotels] = useState<GroupHotel[]>([])
  const [hotelsLoading, setHotelsLoading] = useState(true)
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([])

  // -- Tarih state -- (varsayılan: Son 7 Gün)
  const [activePreset, setActivePreset] = useState<'week' | 'month' | 'thisMonth' | 'custom'>('week')
  const initialDates = getPreset('week')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(initialDates)

  // checkbox "tümünü seç" ref (indeterminate için)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Otel listesi yükleme
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function fetchHotels() {
      setHotelsLoading(true)
      try {
        const res = await fetch(`/api/group-admin/${slug}/hotels`)
        const json: { hotels: GroupHotel[] } = await res.json()
        if (!cancelled) {
          setHotels(json.hotels ?? [])
          setSelectedHotelIds((json.hotels ?? []).map((h) => h.id))
        }
      } catch {
        if (!cancelled) setHotels([])
      } finally {
        if (!cancelled) setHotelsLoading(false)
      }
    }
    fetchHotels()
    return () => { cancelled = true }
  }, [slug])

  // indeterminate state güncelleme
  useEffect(() => {
    if (!selectAllRef.current) return
    if (selectedHotelIds.length === 0) {
      selectAllRef.current.checked = false
      selectAllRef.current.indeterminate = false
    } else if (selectedHotelIds.length === hotels.length) {
      selectAllRef.current.checked = true
      selectAllRef.current.indeterminate = false
    } else {
      selectAllRef.current.checked = false
      selectAllRef.current.indeterminate = true
    }
  }, [selectedHotelIds, hotels])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch(`/api/group-admin/${slug}/logout`, { method: 'POST' })
    } catch { /* no-op */ }
    window.location.href = `/group-admin/${slug}/login`
  }

  function toggleSelectAll() {
    if (selectedHotelIds.length === hotels.length) {
      setSelectedHotelIds([])
    } else {
      setSelectedHotelIds(hotels.map((h) => h.id))
    }
  }

  function toggleHotel(id: string) {
    setSelectedHotelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function applyPreset(preset: 'week' | 'month' | 'thisMonth') {
    setActivePreset(preset)
    setDateRange(getPreset(preset))
  }

  function handleDateInput(field: 'start' | 'end', value: string) {
    setActivePreset('custom')
    setDateRange((prev) => ({ ...prev, [field]: value }))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #080b18 0%, #0d1230 40%, #100820 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Particle arka plan */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <ParticleBackground
          particleId="group-dashboard-particles"
          opacity={0.25}
          particleCount={35}
          speed={0.25}
          linkOpacity={0.08}
          fpsLimit={30}
          disableOnMobile={true}
        />
      </div>

      {/* Mor gradient parlama */}
      <div
        style={{
          position: 'fixed',
          top: '-300px',
          right: '-200px',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ÜST BAR */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          background: 'rgba(8,11,24,0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.40)',
        }}
      >
        {/* Sol: Logo + Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 4px 16px rgba(139,92,246,0.40)',
              flexShrink: 0,
            }}
          >
            🏢
          </div>
          <div>
            <div
              style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px' }}
            >
              HotelGen — Grup Yönetim Paneli
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
              {manager.full_name}
            </div>
          </div>
        </div>

        {/* Sağ: Badge + Çıkış */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              fontSize: '12px',
              padding: '5px 14px',
              borderRadius: '999px',
              border: '1px solid rgba(99,102,241,0.30)',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            👑 Grup Yöneticisi
          </span>

          <button
            id="group-admin-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loggingOut) {
                e.currentTarget.style.background = 'rgba(239,68,68,0.22)'
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
            }}
          >
            {loggingOut ? '⌛ Çıkış yapılıyor...' : '🚪 Çıkış Yap'}
          </button>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '48px 32px',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {/* Hoş geldiniz başlığı */}
        <div style={{ marginBottom: '40px' }}>
          <h1
            style={{
              color: '#f8fafc',
              fontSize: '30px',
              fontWeight: 700,
              margin: '0 0 8px',
              letterSpacing: '-0.5px',
            }}
          >
            Hoş geldiniz, {manager.full_name} 👋
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
            Grup:{' '}
            <span
              style={{
                color: '#a5b4fc',
                fontFamily: 'monospace',
                background: 'rgba(99,102,241,0.10)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {slug}
            </span>
          </p>
        </div>

        {/* ================================================================
            YOL HARİTASI KARTI — FAZ 1'den geliyor, FAZ 2 güncellendi
            ================================================================ */}
        <div
          style={{
            ...glassCard,
            padding: '32px 36px',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(139,92,246,0.20))',
                border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              📊
            </div>
            <div>
              <h2
                style={{
                  color: '#e2e8f0',
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: '0 0 4px',
                  letterSpacing: '-0.3px',
                }}
              >
                Raporlama Paneli
              </h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                Otel seçimi ve tarih aralığı belirleyerek rapor oluşturun.
              </p>
            </div>
          </div>

          {/* Yol haritası rozetleri */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { faz: 'FAZ 1', label: 'Altyapı & Login', status: 'done', icon: '✅' },
              { faz: 'FAZ 2', label: 'Otel Seçimi', status: 'done', icon: '✅' },
              { faz: 'FAZ 3', label: 'Talep / İş / Personel Raporları', status: 'pending', icon: '📈' },
            ].map((item) => (
              <div
                key={item.faz}
                style={{
                  background:
                    item.status === 'done' ? 'rgba(34,197,94,0.10)' : 'rgba(99,102,241,0.08)',
                  border:
                    item.status === 'done'
                      ? '1px solid rgba(34,197,94,0.25)'
                      : '1px solid rgba(99,102,241,0.18)',
                  borderRadius: '12px',
                  padding: '12px 18px',
                  minWidth: '160px',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{item.icon}</div>
                <div
                  style={{
                    color: item.status === 'done' ? '#a7f3d0' : '#c4b5fd',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    marginBottom: '4px',
                  }}
                >
                  {item.faz}
                </div>
                <div
                  style={{
                    color: item.status === 'done' ? '#f0fdf4' : '#e2e8f0',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================
            BÖLÜM A — OTEL SEÇİMİ
            ================================================================ */}
        <div style={{ ...glassCard, padding: '28px 32px', marginBottom: '20px' }}>
          {/* Başlık */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>📍</span>
              <h2
                style={{
                  color: '#f1f5f9',
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: '-0.2px',
                }}
              >
                Oteller
              </h2>
            </div>
            {!hotelsLoading && hotels.length > 0 && (
              <span
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  color: '#a5b4fc',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(99,102,241,0.22)',
                }}
              >
                {selectedHotelIds.length}/{hotels.length} seçili
              </span>
            )}
          </div>

          {/* Yükleniyor */}
          {hotelsLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#64748b',
                fontSize: '14px',
                padding: '16px 0',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(99,102,241,0.3)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Yükleniyor...
            </div>
          )}

          {/* Otel yok */}
          {!hotelsLoading && hotels.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 0',
                color: '#475569',
                fontSize: '14px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏨</div>
              Bu gruba bağlı aktif otel yok.
            </div>
          )}

          {/* Otel listesi */}
          {!hotelsLoading && hotels.length > 0 && (
            <div>
              {/* Tümünü Seç satırı */}
              <label
                htmlFor="hotel-select-all"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  background: 'rgba(99,102,241,0.07)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  transition: 'background 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.13)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.07)'
                }}
              >
                <input
                  ref={selectAllRef}
                  id="hotel-select-all"
                  type="checkbox"
                  onChange={toggleSelectAll}
                  style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <span
                  style={{ color: '#c4b5fd', fontSize: '14px', fontWeight: 700 }}
                >
                  Tümünü Seç
                </span>
              </label>

              {/* Ayırıcı */}
              <div
                style={{
                  height: '1px',
                  background: 'rgba(139,92,246,0.10)',
                  margin: '10px 0',
                }}
              />

              {/* Her otel satırı */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {hotels.map((hotel) => {
                  const isChecked = selectedHotelIds.includes(hotel.id)
                  return (
                    <label
                      key={hotel.id}
                      htmlFor={`hotel-cb-${hotel.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isChecked ? 'rgba(99,102,241,0.08)' : 'transparent',
                        border: isChecked
                          ? '1px solid rgba(99,102,241,0.18)'
                          : '1px solid transparent',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <input
                        id={`hotel-cb-${hotel.id}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleHotel(hotel.id)}
                        style={{ width: '17px', height: '17px', accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span
                        style={{
                          color: '#f1f5f9',
                          fontSize: '15px',
                          fontWeight: 500,
                          flex: 1,
                        }}
                      >
                        {hotel.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            BÖLÜM B — TARİH ARALIĞI
            ================================================================ */}
        <div style={{ ...glassCard, padding: '28px 32px', marginBottom: '20px' }}>
          {/* Başlık */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '20px' }}>📅</span>
            <h2
              style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: 700,
                margin: 0,
                letterSpacing: '-0.2px',
              }}
            >
              Tarih Aralığı
            </h2>
          </div>

          {/* Hızlı butonlar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {([
              { key: 'week', label: 'Son 7 Gün' },
              { key: 'month', label: 'Son 30 Gün' },
              { key: 'thisMonth', label: 'Bu Ay' },
            ] as const).map((preset) => {
              const isActive = activePreset === preset.key
              return (
                <button
                  key={preset.key}
                  id={`date-preset-${preset.key}`}
                  onClick={() => applyPreset(preset.key)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.35))'
                      : 'rgba(255,255,255,0.04)',
                    border: isActive
                      ? '1px solid rgba(99,102,241,0.55)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: isActive ? '#c4b5fd' : '#94a3b8',
                    boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.20)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                      e.currentTarget.style.color = '#a5b4fc'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = '#94a3b8'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    }
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Ayırıcı */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.10)' }} />
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em' }}>
              VEYA MANUEL
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.10)' }} />
          </div>

          {/* Manuel tarih inputları */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {(['start', 'end'] as const).map((field) => (
              <div key={field} style={{ flex: 1, minWidth: '180px' }}>
                <label
                  htmlFor={`date-input-${field}`}
                  style={{
                    display: 'block',
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}
                >
                  {field === 'start' ? 'Başlangıç' : 'Bitiş'}
                </label>
                <input
                  id={`date-input-${field}`}
                  type="date"
                  value={dateRange[field]}
                  onChange={(e) => handleDateInput(field, e.target.value)}
                  style={{
                    width: '100%',
                    background: activePreset === 'custom'
                      ? 'rgba(99,102,241,0.10)'
                      : 'rgba(255,255,255,0.04)',
                    border: activePreset === 'custom'
                      ? '1px solid rgba(99,102,241,0.40)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    padding: '10px 14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    colorScheme: 'dark',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.60)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = activePreset === 'custom'
                      ? 'rgba(99,102,241,0.40)'
                      : 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================
            BÖLÜM C — ÖZET SATIRI + RAPOR BUTONU
            ================================================================ */}
        <div
          style={{
            ...glassCard,
            padding: '20px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Canlı özet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#a5b4fc',
                fontSize: '13px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {selectedHotelIds.length} otel seçili
            </span>
            <span style={{ color: '#64748b', fontSize: '14px' }}>·</span>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>
              {dateRange.start}
              <span style={{ color: '#64748b', margin: '0 6px' }}>–</span>
              {dateRange.end}
              {' '}
              <span style={{ color: '#94a3b8' }}>aralığı</span>
            </span>
          </div>

          {/* Pasif rapor butonu — Faz 3'te aktif */}
          <button
            id="group-admin-report-btn"
            disabled
            style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.15)',
              color: '#475569',
              borderRadius: '10px',
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: 0.6,
            }}
          >
            📊 Rapor Oluştur
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#6366f1',
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '999px',
                letterSpacing: '0.05em',
              }}
            >
              FAZ 3&apos;TE AKTİF
            </span>
          </button>
        </div>

        {/* Alt bilgi */}
        <p
          style={{
            textAlign: 'center',
            color: '#334155',
            fontSize: '12px',
            marginTop: '0',
          }}
        >
          HotelGen · Grup Yönetim Paneli · Salt-Okunur Erişim · Modül 22
        </p>
      </main>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
