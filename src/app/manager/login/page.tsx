'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';

export default function ManagerLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/manager/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();

      if (res.ok) {
        router.push('/manager/dashboard');
      } else {
        setError(json.error ?? 'Geçersiz kullanıcı adı veya şifre.');
      }
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-root login-chooser-root manager-login-root">
      <CursorGlow />
      <ParticleBackground />

      {/* Geri butonu */}
      <button
        className="back-button"
        onClick={() => router.push('/')}
        type="button"
        id="manager-login-back-btn"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Sunuma Dön</span>
      </button>

      {/* Üst başlık alanı */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '560px', padding: '0 24px' }}>

        {/* Teal check ikonu */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg
            width="56" height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hero-icon-check"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <h1 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: '36px',
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}>
          Sisteme Giriş Yapın
        </h1>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '15px',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          margin: '0 0 32px',
        }}>
          Lütfen yetkili olduğunuz alanı seçerek devam edin.
        </p>

        {/* Login kartı */}
        <div className="manager-login-card" id="manager-login-card">

          {/* Kart başlığı */}
          <div className="manager-login-header">
            <div className="manager-login-icon-box">
              {/* Shield ikonu */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="manager-login-title">VIP Yönetici Girişi</h3>
              <p className="manager-login-subtitle">Sadece Yetkili Yöneticiler</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} id="manager-login-form">

            {/* Kullanıcı adı */}
            <div className="form-group">
              <label className="form-label" htmlFor="manager-username">
                YÖNETİCİ KULLANICI ADI
              </label>
              <div className="form-input-wrapper">
                <span className="form-input-icon-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="manager-username"
                  type="text"
                  className="form-input"
                  placeholder="Örn: OzgurOZEN"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Şifre */}
            <div className="form-group">
              <label className="form-label" htmlFor="manager-password">
                YÖNETİCİ PAROLASI
              </label>
              <div className="form-input-wrapper">
                <span className="form-input-icon-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="manager-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '44px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="form-input-icon-right"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  id="manager-password-toggle"
                >
                  {showPassword ? (
                    /* Eye-off */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {error && <p className="form-error" id="manager-login-error">{error}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="form-submit-purple"
              disabled={loading}
              id="manager-login-submit"
            >
              {loading ? 'Giriş yapılıyor...' : 'Yetkili Girişi Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
