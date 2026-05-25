/**
 * Bilgi Yönetimi bölümü layout
 * Modul: VIP Panel Birlestirme (2026-05-19)
 *
 * Sadece hotel_owner erişebilir.
 * Middleware bu kontrolü zaten yapıyor ama layout'ta da double-check var.
 */

import { redirect } from 'next/navigation';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import DashboardLayoutClient from '../dashboard/_dashboard-layout-client';
import HotelAdminParticleWrapper from '../_hotel-admin-particle-wrapper';

export default async function BilgiYonetimiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const admin = await getHotelAdminFromCookie();
  if (!admin) {
    redirect(`/hotel-admin/${slug}/login`);
  }

  if (admin.hotel_slug !== slug) {
    redirect(`/hotel-admin/${slug}/login`);
  }

  // Sadece hotel_owner bu bölüme erişebilir (middleware zaten blokluyor, burada da güvenli)
  if (admin.role !== 'hotel_owner') {
    redirect(`/hotel-admin/${slug}/dashboard`);
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
      <HotelAdminParticleWrapper />
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
  );
}
