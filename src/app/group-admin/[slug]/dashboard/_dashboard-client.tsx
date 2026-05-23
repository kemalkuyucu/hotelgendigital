'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { GroupManagerJwtPayload } from '@/lib/group-admin/auth'

const ParticleBackground = dynamic(
  () => import('@/components/landing/ParticleBackground'),
  { ssr: false }
)

interface Props {
  slug: string
  manager: GroupManagerJwtPayload
}

export default function GroupDashboardClient({ slug, manager }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch(`/api/group-admin/${slug}/logout`, { method: 'POST' })
    } catch {
      // no-op
    }
    window.location.href = `/group-admin/${slug}/login`
  }

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
          background:
            'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
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

        {/* Placeholder kart — Faz 2-3 bilgisi */}
        <div
          style={{
            background: 'rgba(10,15,30,0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(139,92,246,0.20)',
            borderRadius: '20px',
            padding: '48px 40px',
            boxShadow:
              '0 20px 50px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03) inset',
            textAlign: 'center',
          }}
        >
          {/* İkon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(139,92,246,0.20))',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              margin: '0 auto 24px',
            }}
          >
            📊
          </div>

          <h2
            style={{
              color: '#e2e8f0',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 0 16px',
              letterSpacing: '-0.3px',
            }}
          >
            Raporlama Paneli Yapım Aşamasında
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '15px',
              lineHeight: 1.7,
              margin: '0 0 32px',
              maxWidth: '520px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Raporlama paneli yapım aşamasında. Faz 2&apos;de otel seçimi, Faz 3&apos;te talep/iş/personel
            raporları gelecek.
          </p>

          {/* Yol haritası */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {[
              { faz: 'FAZ 1', label: 'Altyapı & Login', status: 'done', icon: '✅' },
              { faz: 'FAZ 2', label: 'Otel Seçimi', status: 'pending', icon: '🔜' },
              { faz: 'FAZ 3', label: 'Talep / İş / Personel Raporları', status: 'pending', icon: '📈' },
            ].map((item) => (
              <div
                key={item.faz}
                style={{
                  background:
                    item.status === 'done'
                      ? 'rgba(34,197,94,0.10)'
                      : 'rgba(99,102,241,0.08)',
                  border:
                    item.status === 'done'
                      ? '1px solid rgba(34,197,94,0.25)'
                      : '1px solid rgba(99,102,241,0.18)',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  minWidth: '160px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{item.icon}</div>
                <div
                  style={{
                    color: item.status === 'done' ? '#86efac' : '#a5b4fc',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    marginBottom: '4px',
                  }}
                >
                  {item.faz}
                </div>
                <div
                  style={{
                    color: item.status === 'done' ? '#dcfce7' : '#e2e8f0',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alt bilgi */}
        <p
          style={{
            textAlign: 'center',
            color: '#334155',
            fontSize: '12px',
            marginTop: '32px',
          }}
        >
          HotelGen · Grup Yönetim Paneli · Salt-Okunur Erişim · Modül 22
        </p>
      </main>
    </div>
  )
}
