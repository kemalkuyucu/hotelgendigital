import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { getAllowedDepartments, deptLabel } from '@/lib/hotel-admin/types'
import type { DepartmentKey } from '@/lib/hotel-admin/types'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import { listStaff } from '@/lib/hotel-admin/staff-client'
import StaffPageClient from './_staff-client'

export default async function StaffPage({
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

  const tenant = await resolveTenantBySlug(slug)
  const staff = await listStaff(tenant.hotelSupabase, dept)

  return (
    <StaffPageClient
      slug={slug}
      department={dept}
      departmentLabel={deptLabel(dept)}
      initialStaff={staff}
    />
  )
}
