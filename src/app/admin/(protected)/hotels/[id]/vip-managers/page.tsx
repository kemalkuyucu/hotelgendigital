import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCentralSupabase } from '@/lib/supabase-client'
import { createVipManagerAction, deleteVipManagerAction } from '@/app/admin/actions/vip-managers'

interface VipManager {
  id: string
  full_name: string
  email: string | null
  whatsapp_id: string | null
  telegram_id: string | null
  preferred_channel: string
  preferred_language: string
  receives_voice_reports: boolean
  is_active: boolean
}

export default async function VipManagersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getCentralSupabase()

  const [{ data: hotel }, { data: vipManagers }] = await Promise.all([
    supabase.from('hotels').select('id, name').eq('id', id).single(),
    supabase
      .from('vip_managers')
      .select('id, full_name, email, whatsapp_id, telegram_id, preferred_channel, preferred_language, receives_voice_reports, is_active')
      .eq('hotel_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!hotel) notFound()

  const createAction = createVipManagerAction.bind(null, id)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/hotels" className="text-gray-400 hover:text-gray-600 text-sm">← Oteller</Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">VIP Yöneticiler</h1>
          <p className="text-gray-500 text-sm">{hotel.name}</p>
        </div>
      </div>

      {/* Existing VIP Managers */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Kayıtlı VIP Yöneticiler ({vipManagers?.length ?? 0})</h2>
        </div>
        {vipManagers && vipManagers.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">İletişim</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kanal / Dil</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sesli Rapor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(vipManagers as VipManager[]).map((v) => {
                const deleteAction = deleteVipManagerAction.bind(null, id, v.id)
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">
                      {v.full_name}
                      {!v.is_active && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pasif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="space-y-0.5">
                        {v.email && <div>✉️ {v.email}</div>}
                        {v.whatsapp_id && <div>📱 {v.whatsapp_id}</div>}
                        {v.telegram_id && <div>✈️ {v.telegram_id}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="font-mono">{v.preferred_channel}</span> / {v.preferred_language}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {v.receives_voice_reports ? (
                        <span className="text-green-600">✅</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={deleteAction}>
                        <button
                          type="submit"
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                          onClick={(e) => {
                            if (!confirm('Bu VIP yöneticiyi silmek istediğinizden emin misiniz?')) {
                              e.preventDefault()
                            }
                          }}
                        >
                          Sil
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            Henüz VIP yönetici eklenmemiş.
          </div>
        )}
      </div>

      {/* Add New VIP Manager */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Yeni VIP Yönetici Ekle</h2>
        </div>
        <form action={createAction} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad *</label>
              <input
                name="full_name"
                required
                placeholder="Ad Soyad"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                name="email"
                type="email"
                placeholder="email@ornek.com"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp ID</label>
              <input
                name="whatsapp_id"
                placeholder="+905001234567"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telegram ID</label>
              <input
                name="telegram_id"
                placeholder="@kullanici"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tercih Edilen Kanal</label>
              <select
                name="preferred_channel"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="email">E-posta</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tercih Edilen Dil</label>
              <select
                name="preferred_language"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="receives_voice_reports" className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm text-gray-700">Sesli rapor alacak</span>
          </label>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
          >
            VIP Yönetici Ekle
          </button>
        </form>
      </div>
    </div>
  )
}
