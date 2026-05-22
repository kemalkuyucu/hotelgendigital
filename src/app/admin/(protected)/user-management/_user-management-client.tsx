'use client'

import { useState, useTransition, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'hotel_owner',            label: 'Otel Sahibi' },
  { value: 'front_office_manager',   label: 'Ön Büro Müdürü' },
  { value: 'housekeeping_manager',   label: 'Housekeeping Müdürü' },
  { value: 'technical_manager',      label: 'Teknik Müdürü' },
  { value: 'fb_manager',             label: 'F&B Müdürü' },
  { value: 'guest_relation_manager', label: 'Guest Relation Müdürü' },
  { value: 'spa_manager',            label: 'SPA Müdürü' },
  { value: 'animation_manager',      label: 'Animasyon Müdürü' },
] as const

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hotel_owner:            { bg: 'rgba(250,204,21,0.15)',  text: '#facc15', border: 'rgba(250,204,21,0.3)' },
  front_office_manager:   { bg: 'rgba(96,165,250,0.15)',  text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  housekeeping_manager:   { bg: 'rgba(52,211,153,0.15)',  text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  technical_manager:      { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  fb_manager:             { bg: 'rgba(232,121,249,0.15)', text: '#e879f9', border: 'rgba(232,121,249,0.3)' },
  guest_relation_manager: { bg: 'rgba(129,140,248,0.15)', text: '#818cf8', border: 'rgba(129,140,248,0.3)' },
  spa_manager:            { bg: 'rgba(244,114,182,0.15)', text: '#f472b6', border: 'rgba(244,114,182,0.3)' },
  animation_manager:      { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', border: 'rgba(45,212,191,0.3)' },
}

function getRoleStyle(role: string) {
  return ROLE_COLORS[role] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function generatePassword(length = 16): string {
  const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => charset[b % charset.length])
    .join('')
}

// ─── Shared modal container ───────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(17,24,40,0.97) 0%, rgba(15,23,42,0.97) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '28px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Shared input style
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(15,23,42,0.8)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '14px',
  padding: '11px 14px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

function ModalTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
      <div style={{
        width: '46px', height: '46px', borderRadius: '14px',
        background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>{title}</h2>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

function ModalError({ msg }: { msg: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '8px', padding: '10px 14px',
      color: '#fca5a5', fontSize: '13px', marginBottom: '16px',
    }}>⚠️ {msg}</div>
  )
}

function PrimaryBtn({ children, onClick, disabled, loading, color = '#6366f1' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
        background: disabled || loading ? 'rgba(100,116,139,0.3)' : color,
        color: disabled || loading ? '#64748b' : '#fff',
        fontSize: '14px', fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {loading ? '...' : children}
    </button>
  )
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '11px', borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'transparent', color: '#94a3b8',
        fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      İptal
    </button>
  )
}

// ─── Modal: Yeni Kullanıcı ─────────────────────────────────────────────────────

function AddUserModal({
  hotelId,
  onClose,
  onSuccess,
}: {
  hotelId: string
  onClose: () => void
  onSuccess: (user: HotelAdminUser) => void
}) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<string>(ROLES[0].value)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, startT] = useTransition()

  async function handleSubmit() {
    setError('')
    if (!username.trim() || !fullName.trim() || !password) {
      setError('Tüm alanlar zorunludur.')
      return
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.')
      return
    }
    startT(async () => {
      const res = await fetch('/api/admin/hotel-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, username: username.trim().toLowerCase(), full_name: fullName.trim(), role, password }),
      })
      const data = await res.json() as { user?: HotelAdminUser; error?: string }
      if (!res.ok) { setError(data.error ?? 'Hata oluştu.'); return }
      onSuccess(data.user!)
    })
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle icon="➕" title="Yeni Kullanıcı Ekle" subtitle="Tenant DB'ye doğrudan yazılır" />

      {error && <ModalError msg={error} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        <div>
          <label style={labelStyle}>Kullanıcı Adı</label>
          <input
            id="new-user-username"
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="ornek_kullanici"
            autoComplete="off"
          />
        </div>
        <div>
          <label style={labelStyle}>Ad Soyad</label>
          <input
            id="new-user-fullname"
            style={inputStyle}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ali Yılmaz"
            autoComplete="off"
          />
        </div>
        <div>
          <label style={labelStyle}>Rol</label>
          <select
            id="new-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Şifre (min 8 karakter)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                id="new-user-password"
                type={showPass ? 'text' : 'password'}
                style={{ ...inputStyle, paddingRight: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px',
                }}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              title="Güçlü şifre üret"
              style={{
                padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.4)',
                background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              🎲 Üret
            </button>
          </div>
          {password && (
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: password.length >= 8 ? '#34d399' : '#f87171' }}>
              {password.length >= 8 ? `✓ ${password.length} karakter` : `✗ En az 8 karakter gerekli`}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <CancelBtn onClick={onClose} />
        <PrimaryBtn onClick={handleSubmit} loading={loading} disabled={!username || !fullName || password.length < 8}>
          ✓ Kullanıcı Oluştur
        </PrimaryBtn>
      </div>
    </ModalOverlay>
  )
}

// ─── Modal: Şifre Sıfırla ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  hotelId,
  onClose,
  onSuccess,
}: {
  user: HotelAdminUser
  hotelId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [shownPassword, setShownPassword] = useState('')
  const [loading, startT] = useTransition()
  const [copied, setCopied] = useState(false)

  async function handleSubmit() {
    setError('')
    if (newPassword.length < 8) { setError('Şifre en az 8 karakter olmalıdır.'); return }
    startT(async () => {
      const res = await fetch(`/api/admin/hotel-users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, newPassword }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Hata oluştu.'); return }
      setShownPassword(newPassword)
      setDone(true)
    })
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(shownPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (done) {
    return (
      <ModalOverlay onClose={() => { onSuccess(); onClose() }}>
        <ModalTitle icon="✅" title="Şifre Güncellendi" subtitle={`@${user.username} — Yeni şifre`} />
        <div style={{
          background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: '12px', padding: '16px', marginBottom: '20px',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Yeni Şifre (bir kez görüntülenir)
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <code style={{
              flex: 1, fontSize: '16px', fontFamily: 'monospace', fontWeight: 700,
              color: '#34d399', letterSpacing: '0.08em', wordBreak: 'break-all',
            }}>
              {shownPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid rgba(52,211,153,0.3)',
                background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.1)',
                color: '#34d399', fontSize: '13px', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#64748b' }}>
          ⚠️ Bu şifreyi güvenli bir şekilde otelinize iletin. Sayfa yenilendiğinde görüntülenemez.
        </p>
        <button
          type="button"
          onClick={() => { onSuccess(); onClose() }}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: '#6366f1', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Tamam, Kapatın
        </button>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle icon="🔑" title="Şifre Sıfırla" subtitle={`@${user.username} — ${user.full_name}`} />

      <div style={{
        background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
        fontSize: '13px', color: '#fbbf24',
      }}>
        🔐 Yeni şifre bcrypt (cost=12) ile hash&apos;lenecek. Plain text asla saklanmaz.
      </div>

      {error && <ModalError msg={error} />}

      <div style={{ marginBottom: '22px' }}>
        <label style={labelStyle}>Yeni Şifre (min 8 karakter)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              id="reset-password-input"
              type={showPass ? 'text' : 'password'}
              style={{ ...inputStyle, paddingRight: '40px' }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px',
              }}
            >
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setNewPassword(generatePassword()); setShowPass(true) }}
            style={{
              padding: '0 14px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.4)',
              background: 'rgba(99,102,241,0.15)', color: '#818cf8',
              fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            🎲 Üret
          </button>
        </div>
        {newPassword && (
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: newPassword.length >= 8 ? '#34d399' : '#f87171' }}>
            {newPassword.length >= 8 ? `✓ ${newPassword.length} karakter` : '✗ En az 8 karakter gerekli'}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <CancelBtn onClick={onClose} />
        <PrimaryBtn onClick={handleSubmit} loading={loading} disabled={newPassword.length < 8} color="#f59e0b">
          🔑 Şifreyi Sıfırla
        </PrimaryBtn>
      </div>
    </ModalOverlay>
  )
}

// ─── Modal: Rol Değiştir ──────────────────────────────────────────────────────

function ChangeRoleModal({
  user,
  hotelId,
  onClose,
  onSuccess,
}: {
  user: HotelAdminUser
  hotelId: string
  onClose: () => void
  onSuccess: (newRole: string) => void
}) {
  const [role, setRole] = useState(user.role)
  const [error, setError] = useState('')
  const [loading, startT] = useTransition()

  async function handleSubmit() {
    setError('')
    if (role === user.role) { setError('Seçilen rol mevcut rolle aynı.'); return }
    startT(async () => {
      const res = await fetch(`/api/admin/hotel-users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, role }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Hata oluştu.'); return }
      onSuccess(role)
      onClose()
    })
  }

  const roleStyle = getRoleStyle(role)

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle icon="🎭" title="Rol Değiştir" subtitle={`@${user.username} — ${user.full_name}`} />

      {error && <ModalError msg={error} />}

      <div style={{ marginBottom: '22px' }}>
        <label style={labelStyle}>Mevcut Rol</label>
        <div style={{
          padding: '10px 14px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '14px',
        }}>
          <span style={{
            fontSize: '13px', fontWeight: 600, padding: '3px 10px',
            borderRadius: '6px', background: getRoleStyle(user.role).bg,
            color: getRoleStyle(user.role).text, border: `1px solid ${getRoleStyle(user.role).border}`,
          }}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>

        <label style={labelStyle}>Yeni Rol Seç</label>
        <select
          id="change-role-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {role !== user.role && (
          <div style={{
            marginTop: '10px', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            fontSize: '13px', color: '#94a3b8',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ color: '#64748b' }}>{ROLE_LABELS[user.role] ?? user.role}</span>
            <span>→</span>
            <span style={{ color: roleStyle.text, fontWeight: 600 }}>{ROLE_LABELS[role] ?? role}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <CancelBtn onClick={onClose} />
        <PrimaryBtn onClick={handleSubmit} loading={loading} disabled={role === user.role}>
          🎭 Rolü Güncelle
        </PrimaryBtn>
      </div>
    </ModalOverlay>
  )
}

// ─── Modal: Durum Değiştir (Aktif/Pasif) ─────────────────────────────────────

function ChangeStatusModal({
  user,
  hotelId,
  onClose,
  onSuccess,
}: {
  user: HotelAdminUser
  hotelId: string
  onClose: () => void
  onSuccess: (isActive: boolean) => void
}) {
  const targetActive = !user.is_active
  const [error, setError] = useState('')
  const [loading, startT] = useTransition()

  async function handleSubmit() {
    setError('')
    startT(async () => {
      const res = await fetch(`/api/admin/hotel-users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, isActive: targetActive }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Hata oluştu.'); return }
      onSuccess(targetActive)
      onClose()
    })
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle
        icon={targetActive ? '✅' : '⛔'}
        title={targetActive ? 'Kullanıcıyı Aktifleştir' : 'Kullanıcıyı Pasifleştir'}
        subtitle={`@${user.username} — ${user.full_name}`}
      />

      {error && <ModalError msg={error} />}

      <div style={{
        padding: '16px', borderRadius: '12px', marginBottom: '22px',
        background: targetActive ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${targetActive ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
        fontSize: '14px',
        color: targetActive ? '#34d399' : '#fca5a5',
      }}>
        {targetActive
          ? '✅ Bu kullanıcı sisteme tekrar giriş yapabilecek.'
          : '⛔ Kullanıcı sisteme giriş yapamayacak. Verisi silinmez — istediğinizde yeniden aktifleştirebilirsiniz.'}
      </div>

      <p style={{ margin: '0 0 22px', fontSize: '13px', color: '#64748b' }}>
        ⚠️ Hard delete <strong style={{ color: '#94a3b8' }}>asla</strong> yapılmaz. Yalnızca is_active değişir.
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        <CancelBtn onClick={onClose} />
        <PrimaryBtn
          onClick={handleSubmit}
          loading={loading}
          color={targetActive ? '#10b981' : '#ef4444'}
        >
          {targetActive ? '✅ Aktifleştir' : '⛔ Pasifleştir'}
        </PrimaryBtn>
      </div>
    </ModalOverlay>
  )
}

// ─── Skeleton Row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {[140, 180, 150, 80, 90, 120].map((w, i) => (
        <td key={i} style={{ padding: '16px 20px' }}>
          <div style={{
            height: '14px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.07)',
            width: `${w}px`,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Toast notification ────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
      padding: '14px 20px', borderRadius: '12px', maxWidth: '360px',
      background: type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
      border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
      color: type === 'success' ? '#34d399' : '#fca5a5',
      fontSize: '14px', fontWeight: 500,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(12px)',
      animation: 'slideUp 0.25s ease',
    }}>
      {type === 'success' ? '✅' : '⚠️'} {msg}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

type ModalType = 'add' | 'password' | 'role' | 'status' | null

export default function UserManagementClient({ hotels }: UserManagementClientProps) {
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [selectedHotelName, setSelectedHotelName] = useState('')
  const [users, setUsers] = useState<HotelAdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasLoaded, setHasLoaded] = useState(false)

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null)
  const [targetUser, setTargetUser] = useState<HotelAdminUser | null>(null)

  // Toast state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const activeHotels = hotels.filter((h) => h.status === 'active')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadUsers = useCallback((hotelId: string, hotelName: string) => {
    if (!hotelId) return
    setError(null)
    setHasLoaded(false)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotel-users?hotelId=${encodeURIComponent(hotelId)}`)
        const data = await res.json() as { users?: HotelAdminUser[]; error?: string }
        if (!res.ok) { setError(data.error ?? 'Kullanıcılar yüklenemedi.'); setUsers([]) }
        else { setUsers(data.users ?? []) }
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
      setUsers([]); setHasLoaded(false); setError(null)
    }
  }

  function openModal(type: ModalType, user?: HotelAdminUser) {
    setTargetUser(user ?? null)
    setModalType(type)
  }

  const activeCount  = users.filter((u) => u.is_active).length
  const passiveCount = users.filter((u) => !u.is_active).length

  return (
    <div style={{ padding: '32px 40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse   { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes fadeInUp{ from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        select option { background: #0f172a; color: #f1f5f9; }
      `}</style>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Modals */}
      {modalType === 'add' && (
        <AddUserModal
          hotelId={selectedHotelId}
          onClose={() => setModalType(null)}
          onSuccess={(user) => {
            setUsers((prev) => [...prev, user])
            setModalType(null)
            showToast(`@${user.username} başarıyla oluşturuldu.`)
          }}
        />
      )}
      {modalType === 'password' && targetUser && (
        <ResetPasswordModal
          user={targetUser}
          hotelId={selectedHotelId}
          onClose={() => setModalType(null)}
          onSuccess={() => showToast(`@${targetUser.username} şifresi güncellendi.`)}
        />
      )}
      {modalType === 'role' && targetUser && (
        <ChangeRoleModal
          user={targetUser}
          hotelId={selectedHotelId}
          onClose={() => setModalType(null)}
          onSuccess={(newRole) => {
            setUsers((prev) => prev.map((u) => u.id === targetUser.id ? { ...u, role: newRole } : u))
            showToast(`@${targetUser.username} rolü güncellendi.`)
          }}
        />
      )}
      {modalType === 'status' && targetUser && (
        <ChangeStatusModal
          user={targetUser}
          hotelId={selectedHotelId}
          onClose={() => setModalType(null)}
          onSuccess={(isActive) => {
            setUsers((prev) => prev.map((u) => u.id === targetUser.id ? { ...u, is_active: isActive } : u))
            showToast(`@${targetUser.username} ${isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.`)
          }}
        />
      )}

      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
          👥 Kullanıcı Yönetimi
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '6px 0 0' }}>
          Otel müdür &amp; yetkili hesapları — super_admin yetkisiyle tam erişim
        </p>
      </div>

      {/* Hotel Selector Card */}
      <div style={{
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px',
        padding: '24px', marginBottom: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <label htmlFor="hotel-select" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          🏨 Otel Seçin
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="hotel-select"
            value={selectedHotelId}
            onChange={handleHotelChange}
            style={{
              flex: '1', minWidth: '240px', maxWidth: '400px',
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', padding: '11px 16px',
              outline: 'none', cursor: 'pointer', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
            }}
          >
            <option value="">— Otel seçin —</option>
            {activeHotels.map((h) => (
              <option key={h.id} value={h.id}>{h.name}{h.is_demo ? ' (Demo)' : ''}</option>
            ))}
          </select>

          {selectedHotelId && hasLoaded && !isPending && (
            <span style={{ fontSize: '13px', color: '#94a3b8', animation: 'fadeInUp 0.3s ease' }}>
              {users.length} kullanıcı · {activeCount} aktif · {passiveCount} pasif
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
          color: '#fca5a5', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!selectedHotelId && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: '16px', padding: '64px 32px', textAlign: 'center',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🏨</div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#64748b' }}>
            Kullanıcıları yönetmek için bir otel seçin
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#475569' }}>
            {activeHotels.length} aktif otel mevcut
          </p>
        </div>
      )}

      {/* Table card */}
      {selectedHotelId && (isPending || hasLoaded) && (
        <div style={{
          background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px',
          overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.35s ease',
        }}>
          {/* Table header bar */}
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)', flexWrap: 'wrap', gap: '12px',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                {selectedHotelName ? `${selectedHotelName} — Kullanıcılar` : 'Kullanıcılar'}
              </h2>
              {!isPending && hasLoaded && (
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {users.length} kayıt · hotel_admin_users tablosu
                </p>
              )}
            </div>

            {/* "+ Yeni Kullanıcı" button */}
            {!isPending && hasLoaded && (
              <button
                id="btn-add-user"
                type="button"
                onClick={() => openModal('add')}
                style={{
                  padding: '9px 18px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <span style={{ fontSize: '16px' }}>+</span> Yeni Kullanıcı
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Kullanıcı Adı', 'Ad Soyad', 'Rol', 'Durum', 'Oluşturulma', 'İşlemler'].map((col) => (
                    <th key={col} style={{
                      textAlign: 'left', padding: '12px 20px',
                      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  [1, 2, 3].map((i) => <SkeletonRow key={i} />)
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '56px 24px', color: '#475569', fontSize: '14px' }}>
                      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>👤</div>
                      Bu otelde henüz kullanıcı yok.{' '}
                      <button
                        type="button"
                        onClick={() => openModal('add')}
                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                      >
                        İlk kullanıcıyı ekle →
                      </button>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const rs = getRoleStyle(user.role)
                    return (
                      <tr
                        key={user.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          opacity: user.is_active ? 1 : 0.65,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Username */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                              background: user.is_active
                                ? 'linear-gradient(135deg,rgba(99,102,241,.3),rgba(139,92,246,.3))'
                                : 'rgba(100,116,139,.15)',
                              border: user.is_active ? '1px solid rgba(99,102,241,.3)' : '1px solid rgba(100,116,139,.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                            }}>
                              {user.is_active ? '👤' : '🔒'}
                            </div>
                            <span style={{
                              fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em',
                              color: user.is_active ? '#e2e8f0' : '#64748b',
                            }}>@{user.username}</span>
                          </div>
                        </td>

                        {/* Full name */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: user.is_active ? '#cbd5e1' : '#64748b' }}>
                            {user.full_name || '—'}
                          </span>
                        </td>

                        {/* Role badge */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px',
                            background: rs.bg, color: rs.text, border: `1px solid ${rs.border}`,
                            whiteSpace: 'nowrap', opacity: user.is_active ? 1 : 0.6,
                          }}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td style={{ padding: '14px 20px' }}>
                          {user.is_active ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px',
                              background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)',
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                              Aktif
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px',
                              background: 'rgba(100,116,139,0.12)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)',
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569', display: 'inline-block' }} />
                              Pasif
                            </span>
                          )}
                        </td>

                        {/* Created at */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '13px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {formatDate(user.created_at)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                            {/* Şifre Sıfırla */}
                            <button
                              id={`btn-reset-pw-${user.id}`}
                              type="button"
                              onClick={() => openModal('password', user)}
                              title="Şifre Sıfırla"
                              style={{
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.25)',
                                background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.2)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
                            >
                              🔑 Şifre
                            </button>

                            {/* Rol Değiştir */}
                            <button
                              id={`btn-change-role-${user.id}`}
                              type="button"
                              onClick={() => openModal('role', user)}
                              title="Rol Değiştir"
                              style={{
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(129,140,248,0.25)',
                                background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)' }}
                            >
                              🎭 Rol
                            </button>

                            {/* Aktif / Pasif toggle */}
                            <button
                              id={`btn-toggle-status-${user.id}`}
                              type="button"
                              onClick={() => openModal('status', user)}
                              title={user.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                              style={{
                                padding: '6px 12px', borderRadius: '8px',
                                border: user.is_active ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(52,211,153,0.25)',
                                background: user.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)',
                                color: user.is_active ? '#f87171' : '#34d399',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = user.is_active ? 'rgba(239,68,68,0.18)' : 'rgba(52,211,153,0.18)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = user.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)'
                              }}
                            >
                              {user.is_active ? '⛔ Pasif' : '✅ Aktif'}
                            </button>
                          </div>
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
