'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { GroupManagerJwtPayload } from '@/lib/group-admin/auth'
import type { GroupHotel } from '@/app/api/group-admin/[slug]/hotels/route'

// ---------------------------------------------------------------------------
// Rapor tipleri
// ---------------------------------------------------------------------------
interface DepartmanSatir {
  departman: string
  toplam: number
  cevaplanan: number
  escalation: number
}
interface PersonelSatir {
  personel: string
  cozulen_adet: number
}
interface OtelOzet {
  toplam: number
  cevaplanan: number
  cevapsiz: number
  escalation: number
  ortalamaYanitDakika: number | null
}
interface OtelRapor {
  hotelId: string
  hotelName: string
  veriAlinabildi: boolean
  hataDetay?: string
  ozet: OtelOzet
  departmanBazli: DepartmanSatir[]
  personelBazli: PersonelSatir[]
}
interface RaporSonucu {
  rapor: OtelRapor[]
  genelToplam: { toplam: number; cevaplanan: number; cevapsiz: number; escalation: number }
}

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

// ---------------------------------------------------------------------------
// Departman kodu → Türkçe
// ---------------------------------------------------------------------------
const DEPT_TR: Record<string, string> = {
  front_office: 'Ön Büro',
  housekeeping: 'Kat Hizmetleri',
  technical: 'Teknik Servis',
  fb: 'Yiyecek-İçecek',
  guest_relation: 'Misafir İlişkileri',
  spa: 'Spa',
  animation: 'Animasyon',
}
function deptTr(code: string): string {
  return DEPT_TR[code] ?? code
}

export default function GroupDashboardClient({ slug, manager }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)

  // -- Rapor state --
  const [raporYukleniyor, setRaporYukleniyor] = useState(false)
  const [raporSonucu, setRaporSonucu] = useState<RaporSonucu | null>(null)
  const [raporHata, setRaporHata] = useState<string | null>(null)

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

  async function handleRapor() {
    if (selectedHotelIds.length === 0) return
    setRaporYukleniyor(true)
    setRaporSonucu(null)
    setRaporHata(null)
    try {
      const res = await fetch(`/api/group-admin/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelIds: selectedHotelIds,
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setRaporHata((err as { error?: string }).error ?? `Hata: HTTP ${res.status}`)
        return
      }
      const data: RaporSonucu = await res.json()
      setRaporSonucu(data)
    } catch (err) {
      setRaporHata(err instanceof Error ? err.message : 'Bağlantı hatası')
    } finally {
      setRaporYukleniyor(false)
    }
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
              { faz: 'FAZ 3', label: 'Talep / İş / Personel Raporları', status: 'done', icon: '✅' },
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

          {/* Rapor butonu — AKTİF */}
          <button
            id="group-admin-report-btn"
            onClick={handleRapor}
            disabled={raporYukleniyor || selectedHotelIds.length === 0}
            style={{
              background:
                raporYukleniyor || selectedHotelIds.length === 0
                  ? 'rgba(99,102,241,0.08)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border:
                raporYukleniyor || selectedHotelIds.length === 0
                  ? '1px solid rgba(99,102,241,0.18)'
                  : '1px solid rgba(139,92,246,0.60)',
              color:
                raporYukleniyor || selectedHotelIds.length === 0 ? '#475569' : '#fff',
              borderRadius: '10px',
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: 700,
              cursor:
                raporYukleniyor || selectedHotelIds.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow:
                raporYukleniyor || selectedHotelIds.length === 0
                  ? 'none'
                  : '0 4px 18px rgba(99,102,241,0.35)',
              transition: 'all 0.20s',
            }}
            onMouseEnter={(e) => {
              if (!raporYukleniyor && selectedHotelIds.length > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.50)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow =
                raporYukleniyor || selectedHotelIds.length === 0
                  ? 'none'
                  : '0 4px 18px rgba(99,102,241,0.35)'
            }}
          >
            {raporYukleniyor ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.30)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                Hazırlanıyor...
              </>
            ) : (
              <>📊 Rapor Oluştur</>
            )}
          </button>
        </div>

        {/* ================================================================
            BÖLÜM D — RAPOR SONUCU
            ================================================================ */}

        {/* Hata mesajı */}
        {raporHata && (
          <div
            style={{
              ...glassCard,
              padding: '20px 28px',
              marginBottom: '20px',
              border: '1px solid rgba(239,68,68,0.30)',
              background: 'rgba(239,68,68,0.08)',
            }}
          >
            <span style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600 }}>
              ⚠️ {raporHata}
            </span>
          </div>
        )}

        {raporSonucu && (
          <div style={{ marginBottom: '32px' }}>

            {/* ── A) GENEL ÖZET KARTI ── */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.14))',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: '20px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.04) inset',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                padding: '28px 32px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px' }}>📊</span>
                <h2 style={{ color: '#e2e8f0', fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  Genel Özet
                </h2>
                <span
                  style={{
                    marginLeft: '8px',
                    background: 'rgba(139,92,246,0.18)',
                    color: '#c4b5fd',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(139,92,246,0.28)',
                  }}
                >
                  {dateRange.start} – {dateRange.end}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                {([
                  { label: 'Toplam Talep', value: raporSonucu.genelToplam.toplam, color: '#a5b4fc', icon: '📋' },
                  { label: 'Cevaplanan', value: raporSonucu.genelToplam.cevaplanan, color: '#6ee7b7', icon: '✅' },
                  { label: 'Cevapsız', value: raporSonucu.genelToplam.cevapsiz, color: '#fcd34d', icon: '⏳' },
                  { label: 'Eskalasyon', value: raporSonucu.genelToplam.escalation, color: '#fca5a5', icon: '🚨' },
                ] as const).map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '26px', marginBottom: '8px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>
                      {stat.value.toLocaleString('tr-TR')}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── B) HER OTEL İÇİN KART ── */}
            {raporSonucu.rapor.map((otel) => (
              <div
                key={otel.hotelId}
                style={{
                  ...glassCard,
                  padding: '28px 32px',
                  marginBottom: '20px',
                }}
              >
                {/* Otel başlık */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '20px' }}>🏨</span>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0, flex: 1 }}>
                    {otel.hotelName}
                  </h3>
                  {!otel.veriAlinabildi && (
                    <span
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        color: '#fca5a5',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}
                    >
                      Hata
                    </span>
                  )}
                </div>

                {/* Veri alınamadı */}
                {!otel.veriAlinabildi ? (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.20)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      color: '#fca5a5',
                      fontSize: '14px',
                    }}
                  >
                    ⚠️ Bu otelden veri alınamadı.
                    {otel.hataDetay && (
                      <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>
                        ({otel.hataDetay})
                      </span>
                    )}
                  </div>
                ) : otel.ozet.toplam === 0 ? (
                  /* Boş veri — hata değil */
                  <div
                    style={{
                      background: 'rgba(99,102,241,0.05)',
                      border: '1px solid rgba(99,102,241,0.12)',
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: '14px',
                    }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
                    Bu tarih aralığında kayıt yok.
                  </div>
                ) : (
                  <>
                    {/* Özet rakamlar */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '12px',
                        marginBottom: '24px',
                      }}
                    >
                      {([
                        { label: 'Toplam', value: otel.ozet.toplam, color: '#a5b4fc' },
                        { label: 'Cevaplanan', value: otel.ozet.cevaplanan, color: '#6ee7b7' },
                        { label: 'Cevapsız', value: otel.ozet.cevapsiz, color: '#fcd34d' },
                        { label: 'Eskalasyon', value: otel.ozet.escalation, color: '#fca5a5' },
                        {
                          label: 'Ort. Yanıt',
                          value: otel.ozet.ortalamaYanitDakika !== null
                            ? `${otel.ozet.ortalamaYanitDakika} dk`
                            : '—',
                          color: '#93c5fd',
                        },
                      ] as const).map((s) => (
                        <div
                          key={s.label}
                          style={{
                            background: 'rgba(0,0,0,0.22)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            textAlign: 'center',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <div style={{ color: s.color, fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>
                            {s.value}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '5px', fontWeight: 600 }}>
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Departman tablosu */}
                    {otel.departmanBazli.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: '10px',
                          }}
                        >
                          Departman Bazlı
                        </div>
                        <div
                          style={{
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid rgba(139,92,246,0.12)',
                          }}
                        >
                          {/* Tablo başlığı */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 80px 90px 90px',
                              background: 'rgba(99,102,241,0.10)',
                              padding: '10px 16px',
                              color: '#64748b',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                            }}
                          >
                            <span>DEPARTMAN</span>
                            <span style={{ textAlign: 'center' }}>TOPLAM</span>
                            <span style={{ textAlign: 'center' }}>CEVAPLANAN</span>
                            <span style={{ textAlign: 'center' }}>ESKALe</span>
                          </div>
                          {otel.departmanBazli.map((d, i) => (
                            <div
                              key={d.departman}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 80px 90px 90px',
                                padding: '11px 16px',
                                background: i % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent',
                                borderTop: '1px solid rgba(139,92,246,0.07)',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
                                {deptTr(d.departman)}
                              </span>
                              <span style={{ color: '#a5b4fc', fontSize: '14px', fontWeight: 700, textAlign: 'center' }}>
                                {d.toplam}
                              </span>
                              <span style={{ color: '#6ee7b7', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                                {d.cevaplanan}
                              </span>
                              <span
                                style={{
                                  color: d.escalation > 0 ? '#fca5a5' : '#475569',
                                  fontSize: '13px',
                                  fontWeight: d.escalation > 0 ? 700 : 500,
                                  textAlign: 'center',
                                }}
                              >
                                {d.escalation > 0 ? `🚨 ${d.escalation}` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personel tablosu */}
                    {otel.personelBazli.length > 0 && (
                      <div>
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: '10px',
                          }}
                        >
                          Personel Performansı
                        </div>
                        <div
                          style={{
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid rgba(139,92,246,0.12)',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 120px',
                              background: 'rgba(99,102,241,0.10)',
                              padding: '10px 16px',
                              color: '#64748b',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                            }}
                          >
                            <span>PERSONEL</span>
                            <span style={{ textAlign: 'center' }}>ÇÖZÜLEN ADET</span>
                          </div>
                          {otel.personelBazli.map((p, i) => (
                            <div
                              key={p.personel}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 120px',
                                padding: '11px 16px',
                                background: i % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent',
                                borderTop: '1px solid rgba(139,92,246,0.07)',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
                                {i === 0 && otel.personelBazli.length > 1 ? '🏆 ' : ''}{p.personel}
                              </span>
                              <span
                                style={{
                                  color: '#6ee7b7',
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  textAlign: 'center',
                                }}
                              >
                                {p.cozulen_adet}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

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
