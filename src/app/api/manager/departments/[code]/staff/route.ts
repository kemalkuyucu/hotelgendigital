import { NextRequest, NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

// ── Whitelist: bilinen 7 departman ──────────────────────────────────────────
const VALID_DEPT_CODES = new Set([
  'front_office',
  'fb',
  'housekeeping',
  'technical',
  'guest_relation',
  'spa',
  'animation',
])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await params

    if (!VALID_DEPT_CODES.has(code)) {
      return NextResponse.json({ error: 'Geçersiz departman kodu' }, { status: 400 })
    }

    const supabase = getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('department_staff')
      .select('id, full_name, role_title, telegram_user_id, telegram_username, whatsapp_id, created_at')
      .eq('department_key', code)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('[staff/GET] DB error:', error)
      return NextResponse.json({ error: 'Sorumlular getirilemedi' }, { status: 500 })
    }

    return NextResponse.json({ staff: data ?? [] }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/GET] Unexpected error:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await params

    if (!VALID_DEPT_CODES.has(code)) {
      return NextResponse.json({ error: 'Geçersiz departman kodu' }, { status: 400 })
    }

    const body = await req.json()
    const { full_name, role_title, telegram_user_id, telegram_username, whatsapp_id } = body

    // ── Validation ──────────────────────────────────────────────────────────
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
      return NextResponse.json({ error: 'Tam isim zorunludur' }, { status: 400 })
    }
    if (full_name.trim().length > 100) {
      return NextResponse.json({ error: 'Tam isim en fazla 100 karakter olabilir' }, { status: 400 })
    }
    if (!telegram_user_id || isNaN(Number(telegram_user_id))) {
      return NextResponse.json({ error: 'Telegram User ID zorunlu ve sayı olmalıdır' }, { status: 400 })
    }

    const supabase = getDemoHotelSupabase()

    // ── Duplicate check ─────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('department_staff')
      .select('id')
      .eq('department_key', code)
      .eq('telegram_user_id', Number(telegram_user_id))
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Bu Telegram User ID bu departmana zaten ekli' },
        { status: 409 }
      )
    }

    // ── Insert ──────────────────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from('department_staff')
      .insert({
        department_key: code,
        full_name: full_name.trim(),
        role_title: role_title?.trim() || null,
        telegram_user_id: Number(telegram_user_id),
        telegram_username: telegram_username?.trim() || null,
        whatsapp_id: whatsapp_id?.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[staff/POST] DB insert error:', insertError)
      return NextResponse.json(
        { error: 'Sorumlu eklenemedi', detail: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ staff: inserted }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/POST] Unexpected error:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
