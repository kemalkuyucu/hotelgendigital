/**
 * Modul 17a — Front-Office bolumu layout
 * Dashboard layout ile ayni sidebar'i kullanir.
 * Auth kontrolu yapilir, sonra DashboardLayoutClient wrap'i saglanir.
 */

import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import DashboardLayoutClient from '../dashboard/_dashboard-layout-client'

export default async function FrontOfficeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const admin = await getHotelAdminFromCookie()
  if (!admin) {
    redirect(`/hotel-admin/${slug}/login`)
  }

  if (admin.hotel_slug !== slug) {
    redirect(`/hotel-admin/${slug}/login`)
  }

  return (
    <DashboardLayoutClient
      slug={slug}
      adminName={admin.full_name}
      adminRole={admin.role}
    >
      {children}
    </DashboardLayoutClient>
  )
}
