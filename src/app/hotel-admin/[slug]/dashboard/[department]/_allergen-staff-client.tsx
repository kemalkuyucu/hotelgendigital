'use client'

// Modül 2 — Alerjen Bildirim Ayarları UI
// F&B personel bayrakları (is_allergen_primary, is_allergen_backup)
// Front Office müdür bayrağı (is_manager)
// Koyu tema — diğer hotel-admin sayfalarıyla tutarlı

import { useState, useTransition } from 'react'

export interface AllergenStaffMember {
  id: string
  full_name: string
  role_title: string | null
  department_key: string
  telegram_user_id: string | null
  is_allergen_primary: boolean
  is_allergen_backup: boolean
  is_manager: boolean
}

interface Props {
  initialFbStaff: AllergenStaffMember[]
  initialFoStaff: AllergenStaffMember[]
}

interface ToastMsg {
  id: number
  type: 'success' | 'warn' | 'error'
  text: string
}

let toastCounter = 0

export default function AllergenStaffClient({ initialFbStaff, initialFoStaff }: Props) {
  const [fbStaff, setFbStaff] = useState<AllergenStaffMember[]>(initialFbStaff)
  const [foStaff, setFoStaff] = useState<AllergenStaffMember[]>(initialFoStaff)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [isPending, startTransition] = useTransition()

  // ── Toast helpers ──────────────────────────────────────────────────────────
  function addToast(type: ToastMsg['type'], text: string) {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, type, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── Bayrak güncelleme ─────────────────────────────────────────────────────
  async function updateFlag(
    staffId: string,
    flag: 'is_allergen_primary' | 'is_allergen_backup' | 'is_manager',
    value: boolean,
    dept: 'fb' | 'front_office'
  ) {
    // Optimistic update
    const setStaff = dept === 'fb' ? setFbStaff : setFoStaff
    setStaff(prev =>
      prev.map(s => s.id === staffId ? { ...s, [flag]: value } : s)
    )

    startTransition(async () => {
      try {
        const res = await fetch('/api/hotel-admin/allergen-staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId, [flag]: value }),
        })
        const json = await res.json()

        if (!res.ok) {
          // Rollback
          setStaff(prev =>
            prev.map(s => s.id === staffId ? { ...s, [flag]: !value } : s)
          )
          addToast('error', json.error ?? 'Güncelleme başarısız.')
          return
        }

        // Update with server response
        if (json.staff) {
          setStaff(prev =>
            prev.map(s => s.id === staffId ? { ...s, ...json.staff } : s)
          )
        }

        if (json.warnings?.length) {
          json.warnings.forEach((w: string) => addToast('warn', w))
        } else {
          addToast('success', 'Kaydedildi.')
        }
      } catch {
        // Rollback
        setStaff(prev =>
          prev.map(s => s.id === staffId ? { ...s, [flag]: !value } : s)
        )
        addToast('error', 'Sunucu bağlantı hatası.')
      }
    })
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(16,24,40,0.7)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '28px 32px',
    marginBottom: '24px',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e2e8f0',
    margin: '0 0 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const descText: React.CSSProperties = {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.65,
    margin: '0 0 20px',
  }

  const tableWrapper: React.CSSProperties = {
    overflowX: 'auto',
  }

  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13.5px',
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    color: '#94a3b8',
    fontWeight: 600,
    fontSize: '11.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  }

  const td: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    color: '#e2e8f0',
    verticalAlign: 'middle',
  }

  const checkboxLabel: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: isPending ? 'wait' : 'pointer',
    userSelect: 'none',
    fontSize: '13px',
    color: '#cbd5e1',
    width: 'max-content',
  }

  function TelegramBadge({ hasTg }: { hasTg: boolean }) {
    if (hasTg) return null
    return (
      <span
        title="Telegram ID tanımlı değil — bu kişiye bildirim gönderilemez"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '6px',
          padding: '2px 8px',
          fontSize: '11px',
          color: '#fbbf24',
          fontWeight: 600,
          marginLeft: '8px',
          flexShrink: 0,
        }}
      >
        ⚠️ Telegram ID yok
      </span>
    )
  }

  function StaffCheckbox({
    staffId,
    flag,
    value,
    label,
    dept,
    accentColor,
  }: {
    staffId: string
    flag: 'is_allergen_primary' | 'is_allergen_backup' | 'is_manager'
    value: boolean
    label: string
    dept: 'fb' | 'front_office'
    accentColor: string
  }) {
    return (
      <label style={checkboxLabel}>
        <input
          type="checkbox"
          checked={value}
          disabled={isPending}
          onChange={e => updateFlag(staffId, flag, e.target.checked, dept)}
          style={{
            width: '17px',
            height: '17px',
            accentColor,
            cursor: isPending ? 'wait' : 'pointer',
          }}
        />
        {label}
      </label>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>
          🔔 Alerjen Bildirim Ayarları
        </h2>
        <p style={{
          fontSize: '13.5px',
          color: '#64748b',
          lineHeight: 1.7,
          maxWidth: '720px',
          margin: 0,
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: '10px',
          padding: '14px 18px',
        }}>
          Misafir alerjisini bildirdiğinde, işaretli kişilere otomatik Telegram bildirimi gider.
          Mutfak sorumlusu izinliyse <strong style={{ color: '#a5b4fc' }}>yedekler devreye girer</strong>;
          Guest Relations mesai dışıysa{' '}
          <strong style={{ color: '#a5b4fc' }}>ön büro müdürü garanti alıcıdır</strong>.
        </p>
      </div>

      {/* ── F&B Personel ──────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionTitle}>
          🍽️ F&amp;B — Mutfak &amp; Servis Sorumluları
        </h3>
        <p style={descText}>
          F&amp;B departmanından <strong style={{ color: '#a5b4fc' }}>Ana Alerjen Sorumlusu</strong> mesai saatinde
          öncelikli alıcıdır. Birden fazla ana sorumlu işaretlenebilir (her birine bildirim gider).
          Ana sorumlular müsait değilse <strong style={{ color: '#7dd3fc' }}>Yedekler</strong> devreye girer.
        </p>

        {fbStaff.length === 0 ? (
          <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>
            F&amp;B departmanında aktif personel bulunamadı.
          </p>
        ) : (
          <div style={tableWrapper}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Ad Soyad / Ünvan</th>
                  <th style={{ ...th, textAlign: 'center' }}>⭐ Ana Alerjen Sorumlusu</th>
                  <th style={{ ...th, textAlign: 'center' }}>🔁 Yedek (Şef / Amir)</th>
                </tr>
              </thead>
              <tbody>
                {fbStaff.map(staff => (
                  <tr
                    key={staff.id}
                    style={{
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{staff.full_name}</span>
                          {staff.role_title && (
                            <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>
                              {staff.role_title}
                            </span>
                          )}
                        </div>
                        <TelegramBadge hasTg={!!staff.telegram_user_id} />
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StaffCheckbox
                          staffId={staff.id}
                          flag="is_allergen_primary"
                          value={staff.is_allergen_primary}
                          label=""
                          dept="fb"
                          accentColor="#f59e0b"
                        />
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StaffCheckbox
                          staffId={staff.id}
                          flag="is_allergen_backup"
                          value={staff.is_allergen_backup}
                          label=""
                          dept="fb"
                          accentColor="#38bdf8"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Front Office Müdür ────────────────────────────────────────── */}
      <div style={{
        ...card,
        borderColor: 'rgba(251,191,36,0.2)',
        background: 'rgba(245,158,11,0.05)',
      }}>
        <h3 style={{ ...sectionTitle, color: '#fbbf24' }}>
          🛎️ Ön Büro — Mesai Dışı Garanti Alıcı
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <p style={{ ...descText, margin: 0 }}>
            Mesai dışı alerjen garantisi için <strong style={{ color: '#fbbf24' }}>en az bir ön büro müdürü</strong>{' '}
            işaretli olmalıdır. Guest Relations müsait olmadığında bu kişi devreye girer.
          </p>
        </div>

        {foStaff.length === 0 ? (
          <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>
            Ön büro departmanında aktif personel bulunamadı.
          </p>
        ) : (
          <div style={tableWrapper}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Ad Soyad / Ünvan</th>
                  <th style={{ ...th, textAlign: 'center' }}>🏨 Müdür (Garanti Alıcı)</th>
                </tr>
              </thead>
              <tbody>
                {foStaff.map(staff => (
                  <tr
                    key={staff.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{staff.full_name}</span>
                          {staff.role_title && (
                            <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>
                              {staff.role_title}
                            </span>
                          )}
                        </div>
                        <TelegramBadge hasTg={!!staff.telegram_user_id} />
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StaffCheckbox
                          staffId={staff.id}
                          flag="is_manager"
                          value={staff.is_manager}
                          label=""
                          dept="front_office"
                          accentColor="#fbbf24"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '8px',
      }}>
        {[
          { color: '#f59e0b', label: '⭐ Ana Alerjen Sorumlusu — öncelikli alıcı' },
          { color: '#38bdf8', label: '🔁 Yedek — ana sorumlular müsait değilse devreye girer' },
          { color: '#fbbf24', label: '🏨 Müdür — mesai dışı garanti alıcı (ön büro)' },
        ].map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              color: '#94a3b8',
            }}
          >
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color, flexShrink: 0, display: 'inline-block' }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* ── Toast container ───────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 9999,
          maxWidth: '360px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#f1f5f9',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              animation: 'slideInToast 0.25s ease',
              background:
                t.type === 'success' ? 'rgba(16,185,129,0.9)' :
                t.type === 'warn'    ? 'rgba(245,158,11,0.92)' :
                'rgba(239,68,68,0.9)',
              border:
                t.type === 'success' ? '1px solid rgba(52,211,153,0.5)' :
                t.type === 'warn'    ? '1px solid rgba(251,191,36,0.5)' :
                '1px solid rgba(252,165,165,0.5)',
            }}
          >
            {t.type === 'success' ? '✓ ' : t.type === 'warn' ? '⚠ ' : '✕ '}
            {t.text}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
