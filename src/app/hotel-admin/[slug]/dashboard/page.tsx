import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = await getHotelAdminFromCookie()

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          📊 Dashboard
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 40px' }}>
          Hoş geldiniz, <strong>{admin?.full_name}</strong> · {slug}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {[
            { icon: '💬', label: 'Aktif Konuşmalar', value: '—', color: '#6366f1' },
            { icon: '📨', label: 'Bugün İletilen', value: '—', color: '#10b981' },
            { icon: '👥', label: 'Aktif Personel', value: '—', color: '#f59e0b' },
            { icon: '⭐', label: 'Memnuniyet', value: '—', color: '#ef4444' },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{card.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: card.color, marginBottom: '4px' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#4338ca', margin: '0 0 12px' }}>
            🚀 Modül 8 Aktif
          </h2>
          <p style={{ color: '#6366f1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            Personel ve vardiya yönetimi aktif. Departman sekmelerinden personel ekleyip
            vardiya saatleri atayabilirsiniz. Vardiyaya göre akıllı Telegram bildirimleri
            bu modülde devreye girdi.
          </p>
        </div>
      </div>
    </div>
  )
}
