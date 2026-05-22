'use client'

import { loginAction } from '@/app/admin/actions/auth'

interface Props {
  error?: string
}

const errorMessages: Record<string, string> = {
  missing: 'Kullanıcı adı ve şifre gerekli.',
  invalid: 'Kullanıcı adı veya şifre hatalı.',
  locked: 'Hesap 15 dakika kilitlendi. Lütfen bekleyin.',
}

export default function AdminLoginForm({ error }: Props) {
  return (
    <form
      action={loginAction}
      style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(10,15,30,0.60)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(99,102,241,0.22)',
        borderRadius: '20px',
        padding: '48px 40px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLFormElement
        el.style.transform = 'scale(1.012)'
        el.style.boxShadow = '0 32px 70px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06) inset'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLFormElement
        el.style.transform = 'scale(1)'
        el.style.boxShadow = '0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset'
      }}
    >
      {/* Logo & Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
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
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
          }}
        >
          🛡️
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
          HotelGen Admin
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 12px' }}>
          Merkez Yönetim Paneli
        </p>
        <span
          style={{
            display: 'inline-block',
            background: 'rgba(99,102,241,0.15)',
            color: '#a5b4fc',
            fontSize: '11.5px',
            padding: '4px 14px',
            borderRadius: '999px',
            border: '1px solid rgba(99,102,241,0.35)',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          SÜPER ADMİN
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            color: '#fca5a5',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          ⚠️ {errorMessages[error] ?? 'Bir hata oluştu.'}
        </div>
      )}

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label
            htmlFor="username"
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
            id="username"
            name="username"
            placeholder="admin"
            required
            autoComplete="username"
            style={{
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
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
          />
        </div>
        <div>
          <label
            htmlFor="password"
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
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            style={{
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
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        id="admin-login-btn"
        type="submit"
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '14px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.boxShadow = '0 6px 28px rgba(99,102,241,0.6)'
          el.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'
          el.style.transform = 'translateY(0)'
        }}
      >
        🔐 Giriş Yap
      </button>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '28px' }}>
        HotelGen · Merkez Yönetim Sistemi
      </p>
    </form>
  )
}
