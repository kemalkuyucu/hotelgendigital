// Modül 22 Adım 1 — Süper Admin Kullanıcı Yönetimi Sayfası
// Central DB'den aktif otel listesini çeker, client'a iletir.
// Kullanıcı listesi client-side (hotel seçimi sonrası API çağrısı) yüklenir.

import { redirect } from 'next/navigation'
import { getSessionAdmin } from '@/lib/auth/session'
import { getCentralSupabase } from '@/lib/supabase-client'
import UserManagementClient from './_user-management-client'

export const dynamic = 'force-dynamic'

export default async function UserManagementPage() {
  // ── Sadece super_admin erişebilir ──────────────────────────────────────────
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')
  if (admin.role !== 'super_admin') redirect('/admin')

  // ── Aktif otelleri Central DB'den çek ─────────────────────────────────────
  const supabase = getCentralSupabase()
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, slug, status, is_demo')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return <UserManagementClient hotels={hotels ?? []} />
}
