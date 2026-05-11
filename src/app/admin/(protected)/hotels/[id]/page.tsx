import { notFound } from 'next/navigation'
import { getCentralSupabase } from '@/lib/supabase-client'
import { updateHotelAction } from '@/app/admin/actions/hotels'
import { TelegramSection } from './_components/telegram-section'
import { getTelegramWebhookInfo } from './actions'

interface Hotel {
  id: string
  name: string
  slug: string
  status: string
  is_demo: boolean
  package_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  telegram_manager_chat_id: number | null
}

interface Package {
  id: string
  code: string
  display_name: string
}

export default async function EditHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getCentralSupabase()

  const [{ data: hotel }, { data: packages }] = await Promise.all([
    supabase
      .from('hotels')
      .select('id, name, slug, status, is_demo, package_id, contact_name, contact_email, contact_phone, address, telegram_manager_chat_id')
      .eq('id', id)
      .single(),
    supabase.from('packages').select('id, code, display_name').eq('is_active', true).order('monthly_price_usd'),
  ])

  if (!hotel) notFound()

  const h = hotel as Hotel

  // Telegram webhook info (hata olursa null döner, sayfa yine açılır)
  const webhookInfo = await getTelegramWebhookInfo(h.slug).catch(() => null)

  // Bind the id into the action
  const updateAction = updateHotelAction.bind(null, id)

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Otel Düzenle</h1>
        <p className="text-gray-500 mb-8 text-sm font-mono text-xs">{id}</p>

        <form action={updateAction} className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Otel İsmi *</label>
              <input
                name="name"
                required
                defaultValue={h.name}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                defaultValue={h.slug}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paket *</label>
              <select
                name="package_id"
                required
                defaultValue={h.package_id ?? ''}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Paket seçin...</option>
                {(packages as Package[] | null)?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                name="status"
                defaultValue={h.status}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İletişim Adı</label>
              <input
                name="contact_name"
                defaultValue={h.contact_name ?? ''}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                name="contact_phone"
                defaultValue={h.contact_phone ?? ''}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                name="contact_email"
                type="email"
                defaultValue={h.contact_email ?? ''}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
              <input
                name="address"
                defaultValue={h.address ?? ''}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              Kaydet
            </button>
            <a
              href="/admin/hotels"
              className="text-gray-500 hover:text-gray-700 px-6 py-2.5 rounded-lg text-sm"
            >
              İptal
            </a>
          </div>
        </form>
      </div>

      <div className="mt-8 max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Hızlı Erişim</h2>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href={`/admin/hotels/${h.id}/knowledge`}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            📚 Bilgi Bankası
          </a>
          <a
            href={`/admin/hotels/${h.id}/admin-users`}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
          >
            👤 Yöneticiler
          </a>
          <a
            href={`/admin/hotels/${h.id}/guests`}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            🛎️ Misafirler
          </a>
        </div>
      </div>

      <div className="mt-2 max-w-2xl">
        <TelegramSection
          hotelId={h.id}
          hotelSlug={h.slug}
          managerChatId={h.telegram_manager_chat_id}
          webhookInfo={webhookInfo}
        />
      </div>
    </div>
  )
}
