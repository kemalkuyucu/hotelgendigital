import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import { countDocumentsByDept } from '@/lib/documents/document-client'
import { deptLabel } from '@/lib/hotel-admin/types'

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = await getHotelAdminFromCookie()

  // Belge istatistikleri
  let docCounts: Record<string, number> = {}
  let totalDocs = 0
  try {
    const tenant = await resolveTenantBySlug(slug)
    docCounts = await countDocumentsByDept(tenant.hotelSupabase)
    totalDocs = Object.values(docCounts).reduce((a, b) => a + b, 0)
  } catch {
    // Dashboard hata fırlatmamalı
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>
          📊 Dashboard
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 40px' }}>
          Hoş geldiniz, <strong style={{ color: '#94a3b8' }}>{admin?.full_name}</strong> · {slug}
        </p>

        {/* Stat Kartları */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {[
            { icon: '💬', label: 'Aktif Konuşmalar', value: '—', color: '#a5b4fc' },
            { icon: '📨', label: 'Bugün İletilen', value: '—', color: '#6ee7b7' },
            { icon: '👥', label: 'Aktif Personel', value: '—', color: '#fcd34d' },
            { icon: '📂', label: 'Toplam Belge', value: totalDocs > 0 ? String(totalDocs) : '—', color: '#7dd3fc' },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: 'rgba(15,23,42,0.7)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '24px',
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

        {/* Belgeler detay kartı — sadece kayıt varsa */}
        {totalDocs > 0 && (
          <div
            style={{
              background: 'rgba(14,165,233,0.08)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: '16px',
              padding: '28px 32px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#7dd3fc', margin: '0 0 16px' }}>
              📂 Departman Belgeleri
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {Object.entries(docCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, count]) => (
                  <span
                    key={dept}
                    style={{
                      background: 'rgba(14,165,233,0.15)',
                      color: '#7dd3fc',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {deptLabel(dept as Parameters<typeof deptLabel>[0])}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Modül bilgi kartı */}
        <div
          style={{
            background: 'rgba(99,102,241,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#a5b4fc', margin: '0 0 12px' }}>
            🚀 Modül 9 Aktif
          </h2>
          <p style={{ color: '#818cf8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            Belge yükleme ve KB Self-Service aktif. Departman sayfalarından PDF, Excel veya Word
            belgelerinizi yükleyebilirsiniz. AI otomatik olarak parse edip misafir asistanına bilgi
            olarak ekleyecek.
          </p>
        </div>
      </div>
    </div>
  )
}
