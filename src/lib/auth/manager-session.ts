import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getCentralSupabase } from '@/lib/supabase-client'

const COOKIE_NAME = 'hg_manager_session'
const SESSION_HOURS = 12

export async function createManagerSession(managerId: string, ip: string, ua: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000)

  const supabase = getCentralSupabase()
  await supabase.from('master_admin_sessions').insert({
    admin_id: managerId,
    token_hash: tokenHash,
    ip_address: ip,
    user_agent: ua,
    expires_at: expiresAt.toISOString(),
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export async function getSessionManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const supabase = getCentralSupabase()
  const { data: session } = await supabase
    .from('master_admin_sessions')
    .select('admin_id, expires_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  const { data: manager } = await supabase
    .from('master_admins')
    .select('id, username, full_name, role, is_active')
    .eq('id', session.admin_id)
    .eq('role', 'super_admin')
    .single()

  if (!manager || !manager.is_active) return null

  await supabase
    .from('master_admin_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return manager
}

export async function destroyManagerSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const supabase = getCentralSupabase()
    await supabase.from('master_admin_sessions').delete().eq('token_hash', tokenHash)
  }
  cookieStore.delete(COOKIE_NAME)
}
