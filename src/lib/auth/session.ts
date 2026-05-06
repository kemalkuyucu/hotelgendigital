import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getCentralServerClient } from '@/lib/supabase/central-server'

const COOKIE_NAME = 'hg_admin_session'
const SESSION_HOURS = 12

export async function createSession(adminId: string, ip: string, ua: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000)

  const supabase = await getCentralServerClient()
  await supabase.from('master_admin_sessions').insert({
    admin_id: adminId,
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

export async function getSessionAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const supabase = await getCentralServerClient()
  const { data: session } = await supabase
    .from('master_admin_sessions')
    .select('admin_id, expires_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  const { data: admin } = await supabase
    .from('master_admins')
    .select('id, username, full_name, email, role, is_active')
    .eq('id', session.admin_id)
    .single()

  if (!admin || !admin.is_active) return null

  await supabase
    .from('master_admin_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return admin
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const supabase = await getCentralServerClient()
    await supabase.from('master_admin_sessions').delete().eq('token_hash', tokenHash)
  }
  cookieStore.delete(COOKIE_NAME)
}
