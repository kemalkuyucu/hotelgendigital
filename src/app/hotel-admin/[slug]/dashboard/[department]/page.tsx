import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { getAllowedDepartments, deptLabel } from '@/lib/hotel-admin/types'
import type { DepartmentKey } from '@/lib/hotel-admin/types'
import Link from 'next/link'

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

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              {label}
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
              Departman Yönetimi
            </p>
          </div>
        </div>

        {/* Personel Yönetimi Butonu */}
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
            marginBottom: '32px',
          }}
        >
          👥 Personel Yönetimi
        </Link>

        {/* Placeholder */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🚧</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#94a3b8', margin: '0 0 8px' }}>
            Bu Bölüm Yapım Aşamasında
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0 }}>
            {label} departman detayları Modül 9&apos;da eklenecek.
          </p>
        </div>
      </div>
    </div>
  )
}
