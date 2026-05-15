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

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
]

// ── Validation helpers ───────────────────────────────────────────────────────
function isValidTimeString(t: unknown): t is string {
  if (typeof t !== 'string') return false
  return /^\d{2}:\d{2}$/.test(t)
}

function validateWorkingHours(wh: unknown): string | null {
  if (!Array.isArray(wh)) return 'working_hours bir dizi olmalıdır'
  if (wh.length !== 7) return 'working_hours 7 gün içermelidir'
  for (const item of wh) {
    if (typeof item !== 'object' || item === null) return 'working_hours öğeleri nesne olmalıdır'
    const day = (item as Record<string, unknown>).day
    if (!DAYS_OF_WEEK.includes(day as string)) return `Geçersiz gün: ${day}`
    const enabled = (item as Record<string, unknown>).enabled
    const is_24h = (item as Record<string, unknown>).is_24h
    if (typeof enabled !== 'boolean') return 'enabled boolean olmalıdır'
    if (typeof is_24h !== 'boolean') return 'is_24h boolean olmalıdır'
    if (enabled && !is_24h) {
      const start = (item as Record<string, unknown>).start
      const end = (item as Record<string, unknown>).end
      if (!isValidTimeString(start)) return `start geçerli saat formatında olmalıdır (HH:MM) - gün: ${day}`
      if (!isValidTimeString(end)) return `end geçerli saat formatında olmalıdır (HH:MM) - gün: ${day}`
    }
  }
  return null
}

function validateHolidays(h: unknown): string | null {
  if (!Array.isArray(h)) return 'holidays bir dizi olmalıdır'
  for (const item of h) {
    if (typeof item !== 'object' || item === null) return 'holidays öğeleri nesne olmalıdır'
    const date = (item as Record<string, unknown>).date
    const label = (item as Record<string, unknown>).label
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return `date YYYY-MM-DD formatında olmalıdır: ${date}`
    }
    if (typeof label !== 'string' || label.trim().length === 0) {
      return 'label zorunludur ve boş olamaz'
    }
    if (label.trim().length > 100) return 'label en fazla 100 karakter olabilir'
  }
  return null
}

// ── PATCH /api/manager/departments/[code] ────────────────────────────────────
export async function PATCH(
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

    // ── Whitelist: sadece izin verilen alanlar ───────────────────────────────
    const ALLOWED_FIELDS = new Set(['sla_minutes', 'working_hours', 'holidays', 'is_enabled'])
    const updatePayload: Record<string, unknown> = {}

    for (const key of Object.keys(body)) {
      if (!ALLOWED_FIELDS.has(key)) {
        return NextResponse.json(
          { error: `İzin verilmeyen alan: ${key}` },
          { status: 400 }
        )
      }
    }

    // ── sla_minutes ─────────────────────────────────────────────────────────
    if ('sla_minutes' in body) {
      const v = body.sla_minutes
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 1440) {
        return NextResponse.json(
          { error: 'sla_minutes 1 ile 1440 arasında bir tam sayı olmalıdır' },
          { status: 400 }
        )
      }
      updatePayload.sla_minutes = n
    }

    // ── working_hours ────────────────────────────────────────────────────────
    if ('working_hours' in body) {
      const err = validateWorkingHours(body.working_hours)
      if (err) {
        return NextResponse.json({ error: `working_hours geçersiz: ${err}` }, { status: 400 })
      }
      updatePayload.working_hours = body.working_hours
    }

    // ── holidays ─────────────────────────────────────────────────────────────
    if ('holidays' in body) {
      const err = validateHolidays(body.holidays)
      if (err) {
        return NextResponse.json({ error: `holidays geçersiz: ${err}` }, { status: 400 })
      }
      updatePayload.holidays = body.holidays
    }

    // ── is_enabled ────────────────────────────────────────────────────────────
    if ('is_enabled' in body) {
      if (typeof body.is_enabled !== 'boolean') {
        return NextResponse.json({ error: 'is_enabled boolean olmalıdır' }, { status: 400 })
      }
      updatePayload.is_enabled = body.is_enabled
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 })
    }

    const supabase = getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('departments')
      .update(updatePayload)
      .eq('code', code)
      .select()
      .single()

    if (error) {
      console.error('[departments/PATCH] DB error:', error)
      return NextResponse.json(
        { error: 'Departman güncellenemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, department: data }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[departments/PATCH] Unexpected error:', msg)
    return NextResponse.json({ error: 'Sunucu hatası', detail: msg }, { status: 500 })
  }
}
