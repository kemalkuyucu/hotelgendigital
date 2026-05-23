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

export default function GroupLoginClient({ slug }: Props) {
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
      const res = await fetch(`/api/group-admin/${slug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
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

      const redirect =
        typeof data === 'object' && data !== null && 'redirect' in data
          ? (data as { redirect: string }).redirect
          : `/group-admin/${slug}/dashboard`

      router.push(redirect)
    } catch {
      setError('Ağ hatası, lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(139,92,246,0.25)',
    borderRadius: '10px',
    padding: '13px 16px',
    color: '#f1f5f9',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #080b18 0%, #0d1230 40%, #100820 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Particle arka plan */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <ParticleBackground
          particleId="group-login-particles"
          opacity={0.4}
          particleCount={45}
          speed={0.3}
          linkOpacity={0.12}
          fpsLimit={30}
          disableOnMobile={true}
        />
      </div>

      {/* Mor/mavi gradient parlama (üst-sol) */}
      <div
        style={{
          position: 'fixed',
          top: '-200px',
          left: '-200px',
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(59,130,246,0.10) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Sağ-alt parlama */}
      <div
        style={{
          position: 'fixed',
          bottom: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          background:
            'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Glassmorphism kart */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(8,11,24,0.60)',
          backdropFilter: 'blur(28px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
          border: '1px solid rgba(139,92,246,0.22)',
          borderRadius: '24px',
          padding: '52px 44px',
          boxShadow:
            '0 30px 70px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 80px rgba(99,102,241,0.08) inset',
          /* 3D hover efekti CSS ile yapılır, JS olmadan */
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width - 0.5
          const y = (e.clientY - rect.top) / rect.height - 0.5
          e.currentTarget.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)'
        }}
      >
        {/* Logo / Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* İkon */}
          <div
            style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 20px',
              boxShadow:
                '0 8px 32px rgba(139,92,246,0.50), 0 0 0 1px rgba(255,255,255,0.08) inset',
            }}
          >
            🏢
          </div>

          <h1
            style={{
              color: '#f8fafc',
              fontSize: '23px',
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-0.5px',
            }}
          >
            HotelGen — Grup Yönetim Paneli
          </h1>

          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 14px' }}>
            Grup yöneticisi olarak giriş yapın
          </p>

          {/* Grup badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(139,92,246,0.15)',
              color: '#c4b5fd',
              fontSize: '12px',
              padding: '5px 14px',
              borderRadius: '999px',
              border: '1px solid rgba(139,92,246,0.30)',
              fontFamily: 'monospace',
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ opacity: 0.7 }}>🔗</span>
            {slug}
          </span>
        </div>

        {/* Bilgi bandı */}
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '28px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.20)',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#a5b4fc',
          }}
        >
          🏢 Otel zinciri yönetim hesabınızla giriş yapın
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {/* Kullanıcı Adı */}
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
              id="group-admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="grup_yoneticisi"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(139,92,246,0.70)'
                e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(139,92,246,0.25)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Şifre */}
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
              id="group-admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(99,102,241,0.70)'
                e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(139,92,246,0.25)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Hata mesajı */}
          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="group-admin-login-btn"
            type="submit"
            disabled={loading}
            style={{
              background: loading
                ? 'rgba(99,102,241,0.45)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #4f46e5 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '15px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s',
              boxShadow: loading
                ? 'none'
                : '0 4px 24px rgba(99,102,241,0.45), 0 1px 0 rgba(255,255,255,0.1) inset',
              width: '100%',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              if (!loading)
                e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {loading ? '⌛ Giriş yapılıyor...' : '🏢 Grup Yöneticisi Girişi'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            color: '#334155',
            fontSize: '12px',
            marginTop: '32px',
          }}
        >
          HotelGen · Grup Yönetim Paneli · Salt-Okunur Erişim
        </p>
      </div>
    </div>
  )
}
