import { NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

export async function GET() {
  try {
    // ── 1. Session doğrula ──────────────────────────────────────────────────
    const manager = await getSessionManager()
    if (!manager) {
      console.error('[departments/list] Unauthorized: no manager session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getDemoHotelSupabase()

    // ── 2. Query 1: departments tablosunu çek ──────────────────────────────
    const { data: deptRows, error: deptError } = await supabase
      .from('departments')
      .select(
        'id, code, display_name, is_enabled, sla_minutes, working_hours, off_hours_behavior, notification_channel_priority'
      )
      .order('display_name', { ascending: true })

    if (deptError) {
      console.error('[departments/list] departments query error:', deptError)
      return NextResponse.json(
        { error: 'Departmanlar getirilemedi', detail: deptError.message },
        { status: 500 }
      )
    }

    // ── 3. Query 2: department_staff tablosunu çek ─────────────────────────
    const { data: staffRows, error: staffError } = await supabase
      .from('department_staff')
      .select('department_key')

    if (staffError) {
      console.error('[departments/list] department_staff query error:', staffError)
      return NextResponse.json(
        { error: 'Departmanlar getirilemedi', detail: staffError.message },
        { status: 500 }
      )
    }

    // ── 4. JS tarafında count hesapla ──────────────────────────────────────
    const staffCounts = (staffRows ?? []).reduce<Record<string, number>>((acc, row) => {
      const key = row.department_key as string
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    // ── 5. Her departmana staff_count ekle ────────────────────────────────
    const departments = (deptRows ?? []).map((d) => ({
      id: d.id as string,
      code: d.code as string,
      display_name: d.display_name as string,
      is_enabled: d.is_enabled as boolean,
      sla_minutes: d.sla_minutes as number | null,
      working_hours: d.working_hours as Record<string, unknown> | null,
      off_hours_behavior: d.off_hours_behavior as string | null,
      notification_channel_priority: d.notification_channel_priority as string | null,
      staff_count: staffCounts[d.code as string] ?? 0,
    }))

    return NextResponse.json({ departments }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[departments/list] Unexpected error:', message)
    return NextResponse.json(
      { error: 'Departmanlar getirilemedi', detail: message },
      { status: 500 }
    )
  }
}
