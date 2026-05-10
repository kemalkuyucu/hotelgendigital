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
        {/* Header */}
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

        {/* Info kartı */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.06))',
            border: '1px solid rgba(14,165,233,0.15)',
            borderRadius: '16px',
            padding: '28px 32px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0369a1', margin: '0 0 10px' }}>
            💡 Modül 9 — Belge Yükleme + KB Self-Service
          </h2>
          <p style={{ color: '#0ea5e9', fontSize: '13.5px', lineHeight: 1.7, margin: 0 }}>
            Departman belgelerinizi (PDF, Excel, Word) yükleyin. Sistem otomatik olarak
            parse edip AI Knowledge Base&apos;e işler. Misafir asistanı bu bilgileri
            anında sorularınıza cevap vermek için kullanır.
          </p>
        </div>
      </div>
    </div>
  )
}
