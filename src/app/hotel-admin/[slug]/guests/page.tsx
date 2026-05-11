import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import Link from 'next/link'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

interface Guest {
  id: string
  room_number: string
  first_name: string | null
  last_name: string
  full_name: string
  phone: string | null
  language: string
  package: string | null
  check_in_date: string
  check_out_date: string
  is_active: boolean
  notes: string | null
}

function statusBadge(isActive: boolean) {
  return isActive
    ? <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>Aktif</span>
    : <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>Pasif</span>
}

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const { slug } = await params
  const { status = 'active', search = '' } = await searchParams
  const admin = await getHotelAdminFromCookie()

  if (!admin) redirect(`/hotel-admin/${slug}/login`)
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return (
      <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>Yetkiniz Yok</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        </div>
      </div>
    )
  }

  const tenant = await resolveTenantBySlug(slug)
  let query = tenant.hotelSupabase
    .from('inhouse_guests')
    .select('id, room_number, first_name, last_name, full_name, phone, language, package, check_in_date, check_out_date, is_active, notes')
    .order('check_in_date', { ascending: false })

  if (status === 'active') query = query.eq('is_active', true)
  if (search) query = query.or(`room_number.ilike.%${search}%,last_name.ilike.%${search}%`)

  const { data: guests } = await query
  const list = (guests ?? []) as Guest[]

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>🛎️ Misafirler</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>In-house misafir listesi ve doğrulama yönetimi</p>
        </div>
        <Link
          href={`/hotel-admin/${slug}/guests/new`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', textDecoration: 'none',
            padding: '12px 22px', borderRadius: '12px',
            fontSize: '14px', fontWeight: 600,
            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
          }}
        >
          ＋ Yeni Misafir
        </Link>
      </div>

      {/* Filtreler */}
      <form method="GET" style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          {[{ v: 'active', label: 'Aktifler' }, { v: 'all', label: 'Tümü' }].map(({ v, label }) => (
            <button
              key={v}
              type="submit"
              name="status"
              value={v}
              style={{
                padding: '9px 18px', fontSize: '13px', fontWeight: status === v ? 700 : 400,
                background: status === v ? '#6366f1' : '#fff',
                color: status === v ? '#fff' : '#64748b',
                border: 'none', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          name="search"
          defaultValue={search}
          placeholder="Oda no veya soyad ara..."
          style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', width: '220px' }}
        />
        <button type="submit" style={{ padding: '9px 18px', fontSize: '13px', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer' }}>
          Ara
        </button>
      </form>

      {/* Tablo */}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏨</div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz misafir yok.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Oda', 'Ad Soyad', 'Giriş', 'Çıkış', 'Dil', 'Durum', 'İşlem'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((g, i) => (
                <tr key={g.id} style={{ borderBottom: i < list.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>{g.room_number}</td>
                  <td style={{ padding: '14px 16px', color: '#1e293b', fontWeight: 500 }}>{g.full_name}</td>
                  <td style={{ padding: '14px 16px', color: '#475569' }}>{g.check_in_date}</td>
                  <td style={{ padding: '14px 16px', color: '#475569' }}>{g.check_out_date}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{g.language?.toUpperCase()}</td>
                  <td style={{ padding: '14px 16px' }}>{statusBadge(g.is_active)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link
                        href={`/hotel-admin/${slug}/guests/${g.id}/edit`}
                        style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: '#6366f1', textDecoration: 'none' }}
                      >
                        Düzenle
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
