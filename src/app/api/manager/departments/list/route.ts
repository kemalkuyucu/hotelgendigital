import { NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

export async function GET() {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getDemoHotelSupabase()

    // Fetch departments with staff count via LEFT JOIN
    const { data, error } = await supabase
      .from('departments')
      .select(`
        id,
        code,
        display_name,
        is_enabled,
        sla_minutes,
        working_hours,
        off_hours_behavior,
        notification_channel_priority,
        department_staff (id)
      `)
      .order('display_name', { ascending: true })

    if (error) {
      console.error('[departments/list] Supabase error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Map to include staff_count
    const departments = (data ?? []).map((d: {
      id: string
      code: string
      display_name: string
      is_enabled: boolean
      sla_minutes: number | null
      working_hours: Record<string, unknown> | null
      off_hours_behavior: string | null
      notification_channel_priority: string | null
      department_staff: { id: string }[]
    }) => ({
      id: d.id,
      code: d.code,
      display_name: d.display_name,
      is_enabled: d.is_enabled,
      sla_minutes: d.sla_minutes,
      working_hours: d.working_hours,
      off_hours_behavior: d.off_hours_behavior,
      notification_channel_priority: d.notification_channel_priority,
      staff_count: Array.isArray(d.department_staff) ? d.department_staff.length : 0,
    }))

    return NextResponse.json({ departments })
  } catch (err) {
    console.error('[departments/list] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
