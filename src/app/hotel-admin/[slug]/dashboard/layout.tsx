import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import DashboardLayoutClient from './_dashboard-layout-client'

export default async function DashboardLayout({
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

  // Slug uyuşmuyor mu? (Başka otelin cookie'si)
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
