'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { HotelAdminRole, DepartmentKey } from '@/lib/hotel-admin/types'
import { getAllowedDepartments, deptLabel, roleLabel } from '@/lib/hotel-admin/types'

interface Props {
  slug: string
  adminName: string
  adminRole: HotelAdminRole
  children: React.ReactNode
}

type NavItemKey =
  | DepartmentKey
  | 'dashboard'
  | 'fo-list'
  | 'fo-upload'
  | 'fo-menu'
  | 'fo-history'
  | 'fo-rez-links'
  | 'bilgi-otel'
  | 'bilgi-tabani'
  | 'belgeler'
  | 'cevre-kesfi'
  | 'toplanti-salonlari'
  | 'eskalasyon'
  | 'departman-personeli'

interface NavItem {
  key: NavItemKey
  label: string
  href: string
  isSubItem?: boolean
}

/** Hangi roller ön büro alt menüsünü görür */
const FRONT_OFFICE_ROLES: HotelAdminRole[] = ['hotel_owner', 'front_office_manager']

/** Hangi roller bilgi yönetimi bölümünü görür */
const BILGI_ROLES: HotelAdminRole[] = ['hotel_owner']

/** Hangi roller departman personeli görebilir */
const PERSONEL_ROLES: HotelAdminRole[] = [
  'hotel_owner',
  'front_office_manager',
  'housekeeping_manager',
  'technical_manager',
  'fb_manager',
  'guest_relation_manager',
  'spa_manager',
  'animation_manager',
]

export default function DashboardLayoutClient({ slug, adminName, adminRole, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const allowedDepts = getAllowedDepartments(adminRole)

  // Ana nav: Dashboard + departmanlar (Misafirler kaldırıldı)
  const navItems: NavItem[] = [
    { key: 'dashboard', label: '📊 Dashboard', href: `/hotel-admin/${slug}/dashboard` },
    ...allowedDepts.map((dept) => ({
      key: dept,
      label: deptLabel(dept),
      href: `/hotel-admin/${slug}/dashboard/${dept}`,
    })),
  ]

  // Ön Büro alt menü (sadece hotel_owner ve front_office_manager)
  const showFrontOffice = FRONT_OFFICE_ROLES.includes(adminRole)
  const showPersonel = PERSONEL_ROLES.includes(adminRole)
  const frontOfficeItems: NavItem[] = [
    { key: 'fo-list',      label: 'In-House Listesi',     href: `/hotel-admin/${slug}/front-office`,              isSubItem: true },
    { key: 'fo-upload',   label: 'Excel Yükle',           href: `/hotel-admin/${slug}/front-office/upload`,       isSubItem: true },
    { key: 'fo-menu',     label: '🍽️ Menü Yükle',         href: `/hotel-admin/${slug}/menu-yukle`,                isSubItem: true },
    { key: 'fo-history',  label: 'Bildirim Geçmişi',      href: `/hotel-admin/${slug}/front-office/history`,      isSubItem: true },
    { key: 'fo-rez-links',label: '🔗 Rezervasyon Linkleri', href: `/hotel-admin/${slug}/dashboard/reservation-links`, isSubItem: true },
  ]

  // Bilgi Yönetimi alt menü (sadece hotel_owner)
  const showBilgiYonetimi = BILGI_ROLES.includes(adminRole)
  const bilgiItems: NavItem[] = [
    { key: 'bilgi-otel',         label: 'Otel Bilgileri',        href: `/hotel-admin/${slug}/bilgi-yonetimi/otel-bilgileri`,      isSubItem: true },
    { key: 'bilgi-tabani',       label: 'Bilgi Tabanı',          href: `/hotel-admin/${slug}/bilgi-yonetimi/bilgi-tabani`,         isSubItem: true },
    { key: 'belgeler',           label: 'Belgeler',               href: `/hotel-admin/${slug}/bilgi-yonetimi/belgeler`,             isSubItem: true },
    { key: 'cevre-kesfi',        label: 'Çevre Keşfi',           href: `/hotel-admin/${slug}/bilgi-yonetimi/cevre-kesfi`,          isSubItem: true },
    { key: 'toplanti-salonlari', label: '🏛️ Toplantı Salonları', href: `/hotel-admin/${slug}/bilgi-yonetimi/toplanti-salonlari`,   isSubItem: true },
    { key: 'eskalasyon', label: 'Eskalasyon', href: `/hotel-admin/${slug}/bilgi-yonetimi/eskalasyon`, isSubItem: true },
  ]

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/hotel-admin/logout', { method: 'POST' })
    router.push(`/hotel-admin/${slug}/login`)
  }

  const linkStyle = (isActive: boolean, isSubItem?: boolean): React.CSSProperties => ({
    display: 'block',
    padding: isSubItem ? '8px 14px 8px 24px' : '10px 14px',
    borderRadius: '10px',
    fontSize: isSubItem ? '13px' : '13.5px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? (isSubItem ? '#7dd3fc' : '#a5b4fc') : '#94a3b8',
    background: isActive
      ? isSubItem ? 'rgba(56,189,248,0.12)' : 'rgba(99,102,241,0.15)'
      : 'transparent',
    border: isActive
      ? isSubItem ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(99,102,241,0.25)'
      : '1px solid transparent',
    textDecoration: 'none',
    transition: 'all 0.15s',
  })

  const sectionLabel = (emoji: string, text: string) => (
    <div style={{ marginTop: '12px', marginBottom: '4px', padding: '0 6px' }}>
      <p style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: 0,
      }}>
        {emoji} {text}
      </p>
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: "'Inter', system-ui, sans-serif",
        background: 'transparent',
        width: '100%',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          minHeight: '100vh',
          background: 'rgba(10,15,30,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '28px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              🏨
            </div>
            <div>
              <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                HotelGen
              </p>
              <p style={{ color: '#64748b', fontSize: '11px', margin: 0, fontFamily: 'monospace' }}>
                {slug}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>

          {/* Ana menü öğeleri (Dashboard + departmanlar) */}
          {navItems.map((item) => {
            const isActive = item.key === 'dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link key={item.key} href={item.href} style={linkStyle(isActive, false)}>
                {item.label}
              </Link>
            )
          })}

          {/* 🏨 Ön Büro Bölümü — sadece hotel_owner ve front_office_manager */}
          {showFrontOffice && (
            <>
              {sectionLabel('🏨', 'Ön Büro')}
              {frontOfficeItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.key} href={item.href} style={linkStyle(isActive, true)}>
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}

          {/* 👥 Personel Yönetimi — hotel_owner + tüm departman müdürleri */}
          {showPersonel && (
            <>
              {sectionLabel('👥', 'Personel')}
              <Link
                href={`/hotel-admin/${slug}/dashboard/departman-personeli`}
                style={linkStyle(
                  pathname.startsWith(`/hotel-admin/${slug}/dashboard/departman-personeli`),
                  true
                )}
              >
                {adminRole === 'hotel_owner' ? '👁️ Departman Çalışanları' : '👥 Departman Çalışanları'}
              </Link>
            </>
          )}

          {/* 📚 Bilgi Yönetimi — sadece hotel_owner */}
          {showBilgiYonetimi && (
            <>
              {sectionLabel('📚', 'Bilgi Yönetimi')}
              {bilgiItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.key} href={item.href} style={linkStyle(isActive, true)}>
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}

        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              marginBottom: '8px',
            }}
          >
            <p style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>
              {adminName}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>
              {roleLabel(adminRole)}
            </p>
          </div>
          <button
            id="hotel-admin-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width: '100%',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#f87171',
              fontSize: '13px',
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            🚪 {loggingOut ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: 'transparent' }}>{children}</main>
    </div>
  )
}
