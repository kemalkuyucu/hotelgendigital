import { NextRequest, NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

// ── PATCH /api/manager/knowledge/[id] ────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Build patch payload from only the fields that were sent
    const allowed = ['fact_key', 'fact_label', 'fact_value', 'category', 'is_active', 'display_order']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        patch[key] = body[key]
      }
    }

    // Normalise fact_key if present
    if (typeof patch.fact_key === 'string') {
      patch.fact_key = patch.fact_key.trim().toLowerCase()
    }
    if (typeof patch.fact_label === 'string') {
      patch.fact_label = patch.fact_label.trim()
    }
    if (typeof patch.fact_value === 'string') {
      patch.fact_value = patch.fact_value.trim()
    }

    patch.updated_at = new Date().toISOString()

    const supabase = getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('hotel_facts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[knowledge PATCH] update error:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Bu fact_key zaten kullanımda', field: 'fact_key' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Bilgi güncellenemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ fact: data }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge PATCH] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi güncellenemedi', detail: message },
      { status: 500 }
    )
  }
}

// ── DELETE /api/manager/knowledge/[id] ───────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getDemoHotelSupabase()

    const { error } = await supabase
      .from('hotel_facts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[knowledge DELETE] delete error:', error)
      return NextResponse.json(
        { error: 'Bilgi silinemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge DELETE] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi silinemedi', detail: message },
      { status: 500 }
    )
  }
}
