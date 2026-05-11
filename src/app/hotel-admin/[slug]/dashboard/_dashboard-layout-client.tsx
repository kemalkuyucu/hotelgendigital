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

interface NavItem {
  key: DepartmentKey | 'dashboard' | 'guests'
  label: string
  href: string
}

export default function DashboardLayoutClient({ slug, adminName, adminRole, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const allowedDepts = getAllowedDepartments(adminRole)

  const navItems: NavItem[] = [
    { key: 'dashboard', label: '📊 Dashboard', href: `/hotel-admin/${slug}/dashboard` },
    { key: 'guests', label: '🛎️ Misafirler', href: `/hotel-admin/${slug}/guests` },
    ...allowedDepts.map((dept) => ({
      key: dept,
      label: deptLabel(dept),
      href: `/hotel-admin/${slug}/dashboard/${dept}`,
    })),
  ]

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/hotel-admin/logout', { method: 'POST' })
    router.push(`/hotel-admin/${slug}/login`)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: "'Inter', system-ui, sans-serif",
        background: '#f8fafc',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '28px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
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
              <p
                style={{
                  color: '#64748b',
                  fontSize: '11px',
                  margin: 0,
                  fontFamily: 'monospace',
                }}
              >
                {slug}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive =
              item.key === 'dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href)


            return (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#a5b4fc' : '#94a3b8',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '16px 12px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
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
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  )
}
