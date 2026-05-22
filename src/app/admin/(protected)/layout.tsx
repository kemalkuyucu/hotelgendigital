import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionAdmin } from '@/lib/auth/session'
import { logoutAction } from '@/app/admin/actions/auth'
import AdminParticleWrapper from './_admin-particle-wrapper'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

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
      <AdminParticleWrapper />

      {/* Sidebar + content — above particles */}
      <div className="min-h-screen flex" style={{ position: 'relative', zIndex: 10 }}>
        <aside
          className="w-64 flex flex-col"
          style={{
            background: 'rgba(10,15,30,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="text-xl font-bold text-white">HotelGen</h2>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Admin Panel v2</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <Link
              href="/admin"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>📊</span> Dashboard
            </Link>
            <Link
              href="/admin/hotels"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>🏨</span> Oteller
            </Link>
            <Link
              href="/admin/system-health"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>💚</span> Sistem Sağlığı
            </Link>
            <Link
              href="/admin/audit-log"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>📋</span> Audit Log
            </Link>
            <Link
              href="/admin/safety-rules"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>🛡️</span> Güvenlik Kuralları
            </Link>
            <Link
              href="/admin/migrations"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>🗄️</span> Veritabanı Sürümleri
            </Link>
            <Link
              href="/admin/user-management"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
              style={{ color: '#cbd5e1' }}
            >
              <span>👥</span> Kullanıcı Yönetimi
            </Link>
          </nav>

          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs mb-3 px-1" style={{ color: '#94a3b8' }}>
              <span className="block font-medium" style={{ color: '#e2e8f0' }}>{admin.full_name}</span>
              <span>{admin.role}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full text-left p-3 rounded-lg hover:bg-white/10 text-sm transition-colors"
                style={{ color: '#f87171' }}
              >
                🚪 Çıkış Yap
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
