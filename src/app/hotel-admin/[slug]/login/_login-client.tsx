'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
}

export default function LoginClient({ slug }: Props) {
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '48px 40px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
              Kullanıcı Adı
            </label>
            <input
              id="hotel-admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="kullanici_adi"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
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
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
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
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
              width: '100%',
            }}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '32px' }}>
          HotelGen · Yönetim Paneli
        </p>
      </div>
    </div>
  )
}
