/**
 * Rezervasyon Linkleri Sayfası (Faz 1)
 * /hotel-admin/[slug]/dashboard/reservation-links
 * Yetki: hotel_owner | front_office_manager
 * Bot entegrasyonu FAZ 2 — burada YAPILMAZ.
 */

import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import ReservationLinksClient from './_reservation-links-client'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'] as const

export default async function ReservationLinksPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = await getHotelAdminFromCookie()

  if (!admin || !(ALLOWED_ROLES as readonly string[]).includes(admin.role)) {
    redirect(`/hotel-admin/${slug}/login`)
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '860px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>
          🔗 Rezervasyon Linkleri
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 32px', fontSize: '14px' }}>
          Misafir rezervasyon istediğinde bot bu linkleri sırayla iletecek.
          <strong style={{ color: '#94a3b8' }}> 1. sıra her zaman otelin resmi rezervasyon linki olmalı.</strong>
        </p>

        <ReservationLinksClient />
      </div>
    </div>
  )
}
