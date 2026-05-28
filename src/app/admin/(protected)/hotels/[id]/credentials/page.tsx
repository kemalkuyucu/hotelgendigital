import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCentralServerClient } from '@/lib/supabase/central-server'
import { saveCredentialsAction } from '@/app/admin/actions/credentials'
import TestBridgeButton from './test-button'

interface CredRow {
  manychat_workspace_id: string | null
  telegram_bot_username: string | null
  whatsapp_business_id: string | null
  is_healthy: boolean | null
  last_verified_at: string | null
}

export default async function CredentialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; tested?: string; err?: string }>
}) {
  const { id } = await params
  const { saved, tested, err } = await searchParams

  const supabase = await getCentralServerClient()
  const [{ data: hotel }, { data: cred }] = await Promise.all([
    supabase.from('hotels').select('id, name').eq('id', id).single(),
    supabase
      .from('bridge_credentials')
      .select('manychat_workspace_id, telegram_bot_username, whatsapp_business_id, is_healthy, last_verified_at')
      .eq('hotel_id', id)
      .single(),
  ])

  if (!hotel) notFound()

  const c = cred as CredRow | null
  const saveAction = saveCredentialsAction.bind(null, id)

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/hotels" className="text-gray-400 hover:text-gray-600 text-sm">← Oteller</Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Bridge Credentials</h1>
        <p className="text-gray-500 text-sm mb-8">{hotel.name}</p>

        {saved && tested === 'ok' && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            ✅ Credentials kaydedildi ve bağlantı doğrulandı — Sağlıklı!
          </div>
        )}

        {saved && tested === 'fail' && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-1">⚠️ Credentials kaydedildi fakat bağlantı doğrulanamadı</div>
            {err && <div className="text-xs mt-1 font-mono">{decodeURIComponent(err)}</div>}
            <div className="text-xs mt-2 opacity-75">Anahtarları kontrol edip tekrar kaydedin veya &quot;Bağlantıyı Test Et&quot; butonunu kullanın.</div>
          </div>
        )}

        {saved && !tested && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            ✅ Credentials başarıyla kaydedildi.
          </div>
        )}

        {c && (
          <div className="mb-6 flex items-center gap-3 text-sm">
            <span className={`px-3 py-1 rounded-full font-medium ${c.is_healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {c.is_healthy ? '✅ Sağlıklı' : '⚠️ Doğrulanmamış'}
            </span>
            {c.last_verified_at && (
              <span className="text-gray-400">
                Son kontrol: {new Date(c.last_verified_at).toLocaleString('tr-TR')}
              </span>
            )}
          </div>
        )}

        <form action={saveAction} className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            ⚠️ Şifreli alanlar boş bırakılırsa mevcut değer korunur. Yeni değer girerseniz şifrelenerek kaydedilir.
          </p>

          {/* Supabase */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-green-100 text-green-700 rounded text-xs flex items-center justify-center">S</span>
              Otel Supabase
            </h2>
            <div className="space-y-3">
              <input
                name="supabase_url"
                type="password"
                placeholder="Supabase URL (boş bırakırsan değişmez)"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="supabase_anon_key"
                type="password"
                placeholder="Anon Key"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="supabase_service_key"
                type="password"
                placeholder="Service Role Key"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ManyChat */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center">M</span>
              ManyChat
            </h2>
            <div className="space-y-3">
              <input
                name="manychat_api_key"
                type="password"
                placeholder="ManyChat API Key (boş bırakırsan değişmez)"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="manychat_workspace_id"
                defaultValue={c?.manychat_workspace_id ?? ''}
                placeholder="Workspace ID (plaintext)"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Telegram */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded text-xs flex items-center justify-center">T</span>
              Telegram
            </h2>
            <div className="space-y-3">
              <input
                name="telegram_bot_token"
                type="password"
                placeholder="Bot Token (boş bırakırsan değişmez)"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="telegram_bot_username"
                defaultValue={c?.telegram_bot_username ?? ''}
                placeholder="Bot Username (@...)"
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-green-100 text-green-700 rounded text-xs flex items-center justify-center">W</span>
              WhatsApp
            </h2>
            <input
              name="whatsapp_business_id"
              defaultValue={c?.whatsapp_business_id ?? ''}
              placeholder="WhatsApp Business ID (plaintext)"
              className="w-full border border-gray-300 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              Kaydet
            </button>
            <Link
              href={`/admin/hotels/${id}`}
              className="text-gray-500 hover:text-gray-700 px-6 py-2.5 rounded-lg text-sm"
            >
              İptal
            </Link>
          </div>
        </form>

        {/* Bridge Test Section */}
        <div className="mt-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Bağlantı Testi</h2>
            <p className="text-xs text-gray-500 mb-4">Credentials kaydedildikten sonra otelin Supabase veritabanına bağlantıyı test edin.</p>
            <TestBridgeButton hotelId={id} />
          </div>
        </div>
      </div>
    </div>
  )
}
