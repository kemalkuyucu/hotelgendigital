import { getCentralSupabase } from '@/lib/supabase-client'
import { createHotelAction } from '@/app/admin/actions/hotels'

export default async function NewHotelPage() {
  const supabase = getCentralSupabase()
  const { data: packages } = await supabase
    .from('packages')
    .select('id, code, display_name')
    .eq('is_active', true)
    .order('monthly_price_usd')

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Yeni Otel</h1>
        <p className="text-gray-500 mb-8 text-sm">Sisteme yeni bir otel kaydı ekleyin.</p>

        <form action={createHotelAction} className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Otel İsmi *</label>
              <input
                name="name"
                required
                placeholder="Örn: Grand Palace Hotel"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="grand-palace-hotel"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Küçük harf, rakam ve tire kullanın</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paket *</label>
              <select
                name="package_id"
                required
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Paket seçin...</option>
                {packages?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İletişim Adı</label>
              <input
                name="contact_name"
                placeholder="Ad Soyad"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                name="contact_phone"
                placeholder="+90 500 000 00 00"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                name="contact_email"
                type="email"
                placeholder="iletisim@otel.com"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
              <input
                name="address"
                placeholder="Otel adresi"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_demo"
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Demo otel (test amaçlı)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              Oteli Oluştur
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
    </div>
  )
}
