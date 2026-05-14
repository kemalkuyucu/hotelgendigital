import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getCentralSupabase } from '@/lib/supabase-client'
import { verifyPassword } from '@/lib/auth/password'
import { createManagerSession } from '@/lib/auth/manager-session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Kullanıcı adı ve şifre gerekli.' },
        { status: 400 }
      )
    }

    const supabase = getCentralSupabase()
    const { data: manager } = await supabase
      .from('admin_users')
      .select('id, username, password_hash, role, is_active, failed_login_attempts, locked_until')
      .eq('username', username)
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .single()

    if (!manager) {
      return NextResponse.json(
        { error: 'Geçersiz kullanıcı adı veya şifre.' },
        { status: 401 }
      )
    }

    // Rate-limit: kilitli mi?
    if (manager.locked_until && new Date(manager.locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Hesap 15 dakika kilitlendi. Lütfen bekleyin.' },
        { status: 429 }
      )
    }

    const ok = await verifyPassword(password, manager.password_hash)

    if (!ok) {
      const attempts = (manager.failed_login_attempts ?? 0) + 1
      const lockUntil =
        attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
      await supabase
        .from('admin_users')
        .update({ failed_login_attempts: attempts, locked_until: lockUntil })
        .eq('id', manager.id)

      return NextResponse.json(
        { error: 'Geçersiz kullanıcı adı veya şifre.' },
        { status: 401 }
      )
    }

    // Başarılı giriş — sayaçları sıfırla
    await supabase
      .from('admin_users')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', manager.id)

    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const ua = h.get('user-agent') ?? 'unknown'

    await createManagerSession(manager.id, ip, ua)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[manager/login] error:', err)
    return NextResponse.json(
      { error: 'Sunucu hatası. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
