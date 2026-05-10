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
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          📊 Dashboard
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 40px' }}>
          Hoş geldiniz, <strong>{admin?.full_name}</strong> · {slug}
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
            { icon: '💬', label: 'Aktif Konuşmalar', value: '—', color: '#6366f1' },
            { icon: '📨', label: 'Bugün İletilen', value: '—', color: '#10b981' },
            { icon: '👥', label: 'Aktif Personel', value: '—', color: '#f59e0b' },
            { icon: '📂', label: 'Toplam Belge', value: totalDocs > 0 ? String(totalDocs) : '—', color: '#0ea5e9' },
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

        {/* Belgeler detay kartı — sadece kayıt varsa */}
        {totalDocs > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.06))',
              border: '1px solid rgba(14,165,233,0.15)',
              borderRadius: '16px',
              padding: '28px 32px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0369a1', margin: '0 0 16px' }}>
              📂 Departman Belgeleri
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {Object.entries(docCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, count]) => (
                  <span
                    key={dept}
                    style={{
                      background: 'rgba(14,165,233,0.1)',
                      color: '#0369a1',
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
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#4338ca', margin: '0 0 12px' }}>
            🚀 Modül 9 Aktif
          </h2>
          <p style={{ color: '#6366f1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            Belge yükleme ve KB Self-Service aktif. Departman sayfalarından PDF, Excel veya Word
            belgelerinizi yükleyebilirsiniz. AI otomatik olarak parse edip misafir asistanına bilgi
            olarak ekleyecek.
          </p>
        </div>
      </div>
    </div>
  )
}
