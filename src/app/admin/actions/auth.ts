'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCentralSupabase } from '@/lib/supabase-client'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, destroySession, getSessionAdmin } from '@/lib/auth/session'
import { logAudit } from '@/lib/auth/audit'

export async function loginAction(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !password) redirect('/admin/login?error=missing')

  const supabase = getCentralSupabase()
  const { data: admin } = await supabase
    .from('master_admins')
    .select('id, username, password_hash, role, is_active, failed_login_attempts, locked_until')
    .eq('username', username)
    .single()

  if (!admin || !admin.is_active) redirect('/admin/login?error=invalid')

  // GÜVENLİK: Sadece super_admin ve admin rolü giriş yapabilir
  const ALLOWED_ROLES = ['super_admin', 'admin']
  if (!ALLOWED_ROLES.includes(admin.role)) redirect('/admin/login?error=invalid')
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    redirect('/admin/login?error=locked')
  }

  const ok = await verifyPassword(password, admin.password_hash)
  if (!ok) {
    const attempts = (admin.failed_login_attempts ?? 0) + 1
    const lockUntil =
      attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
    await supabase
      .from('master_admins')
      .update({ failed_login_attempts: attempts, locked_until: lockUntil })
      .eq('id', admin.id)
    redirect('/admin/login?error=invalid')
  }

  await supabase
    .from('master_admins')
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq('id', admin.id)

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const ua = h.get('user-agent') ?? 'unknown'

  await createSession(admin.id, ip, ua)
  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'login',
    ip,
    userAgent: ua,
  })

  redirect('/admin')
}

export async function logoutAction() {
  const admin = await getSessionAdmin()
  if (admin) {
    await logAudit({
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'logout',
    })
  }
  await destroySession()
  redirect('/admin/login')
}
