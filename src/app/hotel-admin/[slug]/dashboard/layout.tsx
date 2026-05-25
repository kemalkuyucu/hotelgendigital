import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import DashboardLayoutClient from './_dashboard-layout-client'
import HotelAdminParticleWrapper from '../_hotel-admin-particle-wrapper'

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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0a0f1e 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Neural-network particle background — behind everything */}
      <HotelAdminParticleWrapper />

      {/* Sidebar + content — above particles */}
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex' }}>
        <DashboardLayoutClient
          slug={slug}
          adminName={admin.full_name}
          adminRole={admin.role}
        >
          {children}
        </DashboardLayoutClient>
      </div>
    </div>
  )
}
