import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionAdmin } from '@/lib/auth/session'
import { logoutAction } from '@/app/admin/actions/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">HotelGen</h2>
          <p className="text-xs text-gray-400 mt-1">Admin Panel v2</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>📊</span> Dashboard
          </Link>
          <Link
            href="/admin/hotels"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>🏨</span> Oteller
          </Link>
          <Link
            href="/admin/system-health"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>💚</span> Sistem Sağlığı
          </Link>
          <Link
            href="/admin/audit-log"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>📋</span> Audit Log
          </Link>
          <Link
            href="/admin/safety-rules"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>🛡️</span> Güvenlik Kuralları
          </Link>
          <Link
            href="/admin/migrations"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <span>🗄️</span> Veritabanı Sürümleri
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-3 px-1">
            <span className="block font-medium text-gray-300">{admin.full_name}</span>
            <span>{admin.role}</span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left p-3 rounded-lg hover:bg-gray-800 text-red-400 hover:text-red-300 transition-colors text-sm"
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
  )
}
