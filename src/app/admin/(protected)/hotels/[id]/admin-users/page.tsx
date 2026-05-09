import { notFound } from 'next/navigation'
import { getCentralSupabase } from '@/lib/supabase-client'
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id'
import AdminUsersClient from './_admin-users-client'
import type { HotelAdminUser, HotelAdminRole } from '@/lib/hotel-admin/types'

interface Hotel {
  id: string
  name: string
  slug: string
}

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getCentralSupabase()

  const { data: hotel } = await supabase
    .from('hotels')
    .select('id, name, slug')
    .eq('id', id)
    .single()

  if (!hotel) notFound()

  const h = hotel as Hotel

  // Otel admin kullanıcılarını çek
  let users: HotelAdminUser[] = []
  try {
    const tenant = await resolveTenantByHotelId(id)
    const { data } = await tenant.hotelSupabase
      .from('hotel_admin_users')
      .select('id, username, full_name, role, is_active, last_login_at, created_at, updated_at')
      .order('created_at')
    users = ((data ?? []) as HotelAdminUser[])
  } catch (err) {
    console.error('[admin-users] fetch error:', err)
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '900px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <a
            href={`/admin/hotels/${id}`}
            style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}
          >
            ← {h.name}
          </a>
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
          Yöneticiler
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 32px' }}>
          {h.name} · Otel Admin Kullanıcıları
        </p>

        <AdminUsersClient hotelId={id} hotelSlug={h.slug} initialUsers={users} />
      </div>
    </div>
  )
}

// Silence: Role type re-export
export type { HotelAdminRole }
