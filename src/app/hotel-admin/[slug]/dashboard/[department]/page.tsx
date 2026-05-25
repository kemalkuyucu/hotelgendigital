import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { getAllowedDepartments, deptLabel } from '@/lib/hotel-admin/types'
import type { DepartmentKey } from '@/lib/hotel-admin/types'
import Link from 'next/link'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string; department: string }>
}) {
  const { slug, department } = await params
  const admin = await getHotelAdminFromCookie()

  if (!admin) redirect(`/hotel-admin/${slug}/login`)

  const dept = department as DepartmentKey
  const allowed = getAllowedDepartments(admin.role)

  if (!allowed.includes(dept)) {
    return (
      <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div
          style={{
            maxWidth: '500px',
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>
            Yetkiniz Yok
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Bu departmana erişim yetkiniz bulunmuyor.
          </p>
        </div>
      </div>
    )
  }

  const label = deptLabel(dept)

  // Modül 11: SLA ayarlarını DB'den çek
  let slaMinutes = 1
  let receptionSlaMinutes = 5
  try {
    const tenant = await resolveTenantBySlug(slug)
    const { data: deptRow } = await tenant.hotelSupabase
      .from('departments')
      .select('sla_minutes, reception_sla_minutes')
      .eq('code', dept)
      .maybeSingle()
    if (deptRow) {
      slaMinutes = (deptRow.sla_minutes as number | null) ?? 1
      receptionSlaMinutes = (deptRow.reception_sla_minutes as number | null) ?? 5
    }
  } catch {
    // Hata olursa varsayılan değerler kullan
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>
              {label}
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
              Departman Yönetimi
            </p>
          </div>
        </div>

        {/* Tab Butonları */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <Link
            href={`/hotel-admin/${slug}/dashboard/${dept}/staff`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              textDecoration: 'none',
              padding: '14px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
            }}
          >
            👥 Personel Yönetimi
          </Link>

          <Link
            href={`/hotel-admin/${slug}/dashboard/${dept}/documents`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              textDecoration: 'none',
              padding: '14px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(14,165,233,0.35)',
              transition: 'all 0.2s',
            }}
          >
            📂 Belgeler & KB
          </Link>
        </div>

        {/* Modül 11: SLA Ayarları Kartı */}
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '16px',
            padding: '28px 32px',
            marginBottom: '24px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', margin: '0 0 6px' }}>
            ⏱ SLA Ayarları (Modül 11)
          </h2>
          <p style={{ color: '#d97706', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
            Talep cevap süreleri. Aşılırsa sırasıyla resepsiyona escalation → &quot;cevap verilmedi&quot; otomatik kaydı yapılır.
          </p>

          <form
            action={`/api/hotel-admin/${slug}/departments/${dept}/sla`}
            method="PATCH"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}
            onSubmit={undefined}
          >
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#fbbf24', marginBottom: '6px' }}>
                🏢 Departman SLA (dakika)
              </label>
              <input
                type="number"
                name="sla_minutes"
                min={1}
                max={60}
                defaultValue={slaMinutes}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                Demo: 1 dk · Üretim önerisi: 3–5 dk
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#fbbf24', marginBottom: '6px' }}>
                🛎️ Resepsiyon SLA (dakika)
              </label>
              <input
                type="number"
                name="reception_sla_minutes"
                min={1}
                max={120}
                defaultValue={receptionSlaMinutes}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                Demo: 5 dk · Üretim önerisi: 15–30 dk
              </p>
            </div>
          </form>

          <p style={{ fontSize: '12px', color: '#b45309', marginTop: '16px', fontStyle: 'italic' }}>
            ℹ️ SLA güncellemesi için: Hotel Admin API PATCH /api/hotel-admin/{slug}/departments/{dept}/sla endpoint&apos;ini kullanın.
            Panelden fetch ile güncelleme Modül 11.1&apos;de eklenecek.
          </p>
        </div>

        {/* Info kartı */}
        <div
          style={{
            background: 'rgba(14,165,233,0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(14,165,233,0.2)',
            borderRadius: '16px',
            padding: '28px 32px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#7dd3fc', margin: '0 0 10px' }}>
            💡 Modül 11 — SLA Escalation Aktif
          </h2>
          <p style={{ color: '#60a5fa', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
            Departmana gönderilen talepler artık 2 inline buton içeriyor: 🟢 Hemen ilgileniyoruz / 🟡 Biraz sonra.
            Personel butona basmazsa SLA süresi aşımında resepsiyona escalation gider.
          </p>
        </div>
      </div>
    </div>
  )
}
