import Link from 'next/link'
import { getCentralSupabase } from '@/lib/supabase-client'

type PackageRef = { display_name: string }

interface Hotel {
  id: string
  name: string
  slug: string
  status: string
  is_demo: boolean
  package_id: string | null
  packages: unknown
}

function getPackageName(packages: unknown): string | null {
  if (!packages) return null
  if (Array.isArray(packages)) {
    return (packages as PackageRef[])[0]?.display_name ?? null
  }
  return (packages as PackageRef).display_name ?? null
}

export default async function HotelsListPage() {
  const supabase = getCentralSupabase()
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, slug, status, is_demo, package_id, packages(display_name)')
    .order('created_at', { ascending: false })

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-500',
      suspended: 'bg-red-100 text-red-600',
    }
    return map[status] ?? 'bg-gray-100 text-gray-500'
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Oteller</h1>
          <p className="text-gray-500 mt-1">{hotels?.length ?? 0} otel kayıtlı</p>
        </div>
        <Link
          href="/admin/hotels/new"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Yeni Otel
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Otel</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paket</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hotels && hotels.length > 0 ? (
              (hotels as Hotel[]).map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{h.name}</span>
                      {h.is_demo && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          DEMO
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 font-mono text-sm">{h.slug}</td>
                  <td className="p-4 text-gray-700 text-sm">
                    {getPackageName(h.packages) ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Link href={`/admin/hotels/${h.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                        Düzenle
                      </Link>
                      <Link href={`/admin/hotels/${h.id}/credentials`} className="text-purple-600 hover:text-purple-700 font-medium">
                        Bridge
                      </Link>
                      <Link href={`/admin/hotels/${h.id}/vip-managers`} className="text-green-600 hover:text-green-700 font-medium">
                        VIP
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">
                  Henüz otel eklenmemiş.{' '}
                  <Link href="/admin/hotels/new" className="text-blue-600 hover:underline">
                    İlk oteli ekle →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
