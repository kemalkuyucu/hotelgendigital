'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Basit client-side auth guard — session cookie yoksa login'e döndür
  useEffect(() => {
    // Gerçek guard: middleware (Modül 13'te eklenecek) tarafından yapılacak.
    // Şimdilik sayfaya erişim açık, Modül 13'te middleware ile kilitlenecek.
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/manager/logout', { method: 'POST' });
    } finally {
      router.push('/manager/login');
    }
  }

  return (
    <div
      className="landing-root login-chooser-root"
      style={{ flexDirection: 'column', gap: 0 }}
    >
      <CursorGlow />
      <ParticleBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          padding: '60px 32px',
          maxWidth: '640px',
          width: '100%',
        }}
      >
        {/* İkon */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '2px solid rgba(168, 85, 247, 0.4)',
              color: '#a855f7',
              filter: 'drop-shadow(0 0 24px rgba(168, 85, 247, 0.5))',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
        </div>

        {/* Başlık */}
        <h1
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: '42px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
          id="manager-dashboard-title"
        >
          Yönetici Paneli
        </h1>

        {/* Durum badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            background: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '999px',
            marginBottom: '32px',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
              color: '#a855f7',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Yapım Aşamasında
          </span>
        </div>

        {/* Açıklama kartı */}
        <div
          style={{
            padding: '32px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '2px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '16px',
            backdropFilter: 'blur(8px)',
            marginBottom: '32px',
          }}
        >
          <p
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.7,
              margin: '0 0 8px',
            }}
          >
            Henüz yapım aşamasında
          </p>
          <p
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px',
              color: 'rgba(168, 85, 247, 0.8)',
              margin: 0,
              fontWeight: 600,
            }}
          >
            Modül 13&apos;te açılacak →
          </p>
        </div>

        {/* Çıkış butonu */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          id="manager-logout-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 36px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            color: '#f87171',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            opacity: loggingOut ? 0.6 : 1,
            transition: 'all 0.25s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {loggingOut ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
        </button>
      </div>
    </div>
  );
}
