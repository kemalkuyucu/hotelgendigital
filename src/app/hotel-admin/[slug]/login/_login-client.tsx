'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ParticleBackground = dynamic(
  () => import('@/components/landing/ParticleBackground'),
  { ssr: false }
)

interface Props {
  slug: string
}

type LoginMode = 'manager' | 'staff'

export default function LoginClient({ slug }: Props) {
  const [mode, setMode] = useState<LoginMode>('manager')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/hotel-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel_slug: slug, username, password }),
      })

      const data: unknown = await res.json()

      if (!res.ok) {
        const msg =
          typeof data === 'object' && data !== null && 'error' in data
            ? (data as { error: string }).error
            : 'Giriş başarısız.'
        setError(msg)
        return
      }

      router.push(`/hotel-admin/${slug}/dashboard`)
    } catch {
      setError('Ağ hatası, lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#f1f5f9',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const modeTabStyle = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1,
    padding: '14px 12px',
    borderRadius: '12px',
    border: active ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.08)',
    background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
    color: active ? color : '#64748b',
    fontSize: '13.5px',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0a0f1e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Neural network particle background — dimmed so form stays legible */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <ParticleBackground
          particleId="login-particles"
          opacity={0.35}
          particleCount={40}
          speed={0.35}
          linkOpacity={0.10}
          fpsLimit={30}
          disableOnMobile={true}
        />
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(10,15,30,0.55)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: '1px solid rgba(91,158,255,0.18)',
          borderRadius: '20px',
          padding: '48px 40px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
            }}
          >
            🏨
          </div>
          <h1
            style={{
              color: '#f8fafc',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 0 8px',
              letterSpacing: '-0.5px',
            }}
          >
            HotelGen
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 10px' }}>
            Yönetim Paneli Girişi
          </p>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              fontSize: '12px',
              padding: '4px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(99,102,241,0.3)',
              fontFamily: 'monospace',
            }}
          >
            {slug}
          </span>
        </div>

        {/* 2 Sekme: Yönetici / Personel */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '28px',
            padding: '6px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
          }}
        >
          <button
            id="login-tab-manager"
            type="button"
            onClick={() => setMode('manager')}
            style={modeTabStyle(mode === 'manager', '#22c55e')}
          >
            <span style={{ fontSize: '22px' }}>🟢</span>
            <span>Yönetici Girişi</span>
          </button>
          <button
            id="login-tab-staff"
            type="button"
            onClick={() => setMode('staff')}
            style={modeTabStyle(mode === 'staff', '#3b82f6')}
          >
            <span style={{ fontSize: '22px' }}>🔵</span>
            <span>Departman Müdürü</span>
          </button>
        </div>

        {/* Hint metni */}
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '24px',
            background:
              mode === 'manager'
                ? 'rgba(34,197,94,0.08)'
                : 'rgba(59,130,246,0.08)',
            border: `1px solid ${mode === 'manager' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: '10px',
            fontSize: '13px',
            color: mode === 'manager' ? '#86efac' : '#93c5fd',
          }}
        >
          {mode === 'manager'
            ? '💼 Otel sahibi veya yönetici hesabınızla giriş yapın'
            : '👤 Departman çalışan hesabınızla giriş yapın (ör: fo_user, fb_user)'}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label
              style={{
                display: 'block',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
              }}
            >
              Kullanıcı Adı
            </label>
            <input
              id="hotel-admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder={mode === 'manager' ? 'demo_owner' : 'fo_user'}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = mode === 'manager' ? '#22c55e' : '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
              }}
            >
              Şifre
            </label>
            <input
              id="hotel-admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = mode === 'manager' ? '#22c55e' : '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            id="hotel-admin-login-btn"
            type="submit"
            disabled={loading}
            style={{
              background: loading
                ? 'rgba(99,102,241,0.5)'
                : mode === 'manager'
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading
                ? 'none'
                : mode === 'manager'
                ? '0 4px 20px rgba(34,197,94,0.3)'
                : '0 4px 20px rgba(59,130,246,0.3)',
              width: '100%',
            }}
          >
            {loading
              ? 'Giriş yapılıyor...'
              : mode === 'manager'
              ? '🟢 Yönetici Olarak Giriş Yap'
              : '🔵 Personel Olarak Giriş Yap'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '32px' }}>
          HotelGen · Yönetim Paneli
        </p>
      </div>
    </div>
  )
}
