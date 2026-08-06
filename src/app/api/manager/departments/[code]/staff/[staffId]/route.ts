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

// Basit UUID format check
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; staffId: string }> }
) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code, staffId } = await params

    if (!VALID_DEPT_CODES.has(code)) {
      return NextResponse.json({ error: 'Geçersiz departman kodu' }, { status: 400 })
    }

    if (!isValidUUID(staffId)) {
      return NextResponse.json({ error: 'Geçersiz staff ID formatı' }, { status: 400 })
    }

    const supabase = getDemoHotelSupabase()

    // ── Güvenlik: department_key de eşleşmeli ───────────────────────────────
    const { data: existing } = await supabase
      .from('department_staff')
      .select('id')
      .eq('id', staffId)
      .eq('department_key', code)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: 'Sorumlu bulunamadı veya bu departmana ait değil' },
        { status: 404 }
      )
    }

    // ── Delete ──────────────────────────────────────────────────────────────
    const { error: deleteError } = await supabase
      .from('department_staff')
      .delete()
      .eq('id', staffId)
      .eq('department_key', code)

    if (deleteError) {
      console.error('[staff/DELETE] DB error:', deleteError)
      return NextResponse.json(
        { error: 'Sorumlu silinemedi', detail: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ deleted: true }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staff/DELETE] Unexpected error:', msg)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
