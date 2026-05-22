import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { getAllowedDepartments, deptLabel, roleLabel } from '@/lib/hotel-admin/types'
import DepartmanPersonelClient from './_departman-personel-client'

export default async function DepartmanPersonelPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = await getHotelAdminFromCookie()

  if (!admin) redirect(`/hotel-admin/${slug}/login`)
  if (admin.hotel_slug !== slug) redirect(`/hotel-admin/${slug}/login`)

  const allowedDepts = getAllowedDepartments(admin.role)
  const isOwner = admin.role === 'hotel_owner'

  return (
    <DepartmanPersonelClient
      slug={slug}
      adminRole={admin.role}
      adminRoleLabel={roleLabel(admin.role)}
      allowedDepts={allowedDepts}
      isOwner={isOwner}
    />
  )
}
