import { notFound } from 'next/navigation'
import { getCentralSupabase } from '@/lib/supabase-client'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import Link from 'next/link'

interface Hotel {
  id: string
  name: string
  slug: string
  status: string
}

interface Guest {
  id: string
  room_number: string
  first_name: string | null
  last_name: string
  full_name: string
  check_in_date: string
  check_out_date: string
  is_active: boolean
  language: string
  gender: 'male' | 'female' | null
  package: string | null
}

function statusBadge(isActive: boolean) {
  return isActive
    ? <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '12px' }}>Aktif</span>
    : <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12px' }}>Pasif</span>
}

export default async function AdminHotelGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const { id } = await params
  const { status = 'active', search = '' } = await searchParams

  const central = getCentralSupabase()
  const { data: hotel } = await central
    .from('hotels')
    .select('id, name, slug, status')
    .eq('id', id)
    .single()

  if (!hotel) notFound()
  const h = hotel as Hotel

  // Hotel tenant client üzerinden inhouse_guests'e eriş
  let guests: Guest[] = []
  let dbError: string | null = null

  try {
    const tenant = await resolveTenantBySlug(h.slug)
    let query = tenant.hotelSupabase
      .from('inhouse_guests')
      .select('id, room_number, first_name, last_name, full_name, check_in_date, check_out_date, is_active, language, gender, package')
      .order('check_in_date', { ascending: false })

    if (status === 'active') query = query.eq('is_active', true)
    if (search) query = query.or(`room_number.ilike.%${search}%,last_name.ilike.%${search}%`)

    const { data, error } = await query
    if (error) dbError = error.message
    else guests = (data ?? []) as Guest[]
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB bağlantı hatası'
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl">
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <a href={`/admin/hotels/${id}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: '13px' }}>← {h.name}</a>
            <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-1">🛎️ Misafirler</h1>
            <p className="text-gray-500 text-sm">{h.name} — In-house misafir listesi</p>
          </div>
          <a
            href={`/hotel-admin/${h.slug}/guests/new`}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', textDecoration: 'none' }}
          >
            ＋ Yeni Misafir
          </a>
        </div>

        {/* Filtreler */}
        <form method="GET" className="flex gap-3 mb-6 flex-wrap">
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
            {['active', 'all'].map((s) => (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                style={{
                  padding: '8px 18px', fontSize: '13px', fontWeight: status === s ? 700 : 400,
                  background: status === s ? '#6366f1' : '#fff',
                  color: status === s ? '#fff' : '#6b7280',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {s === 'active' ? 'Aktifler' : 'Tümü'}
              </button>
            ))}
          </div>
          <input
            name="search"
            defaultValue={search}
            placeholder="Oda no veya soyad..."
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none w-52"
          />
          <button type="submit" className="bg-gray-100 text-gray-600 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium">Ara</button>
        </form>

        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            ⚠️ DB Hatası: {dbError}
          </div>
        )}

        {guests.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏨</div>
            <p className="text-gray-400 text-sm">Misafir bulunamadı.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Oda', 'Ad Soyad', 'Cinsiyet', 'Giriş', 'Çıkış', 'Dil', 'Durum', 'İşlem'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map((g, i) => (
                  <tr key={g.id} className={i < guests.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{g.room_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{g.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {g.gender === 'male' ? 'Erkek' : g.gender === 'female' ? 'Kadın' : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.check_in_date}</td>
                    <td className="px-4 py-3 text-gray-600">{g.check_out_date}</td>
                    <td className="px-4 py-3 text-gray-500 uppercase text-xs">{g.language}</td>
                    <td className="px-4 py-3">{statusBadge(g.is_active)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hotel-admin/${h.slug}/guests/${g.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                      >
                        Düzenle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
