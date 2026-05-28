import { NextRequest, NextResponse } from 'next/server'
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

// ── GET /api/manager/knowledge ────────────────────────────────────────────────
export async function GET() {
  try {
    const manager = await getManagerOrHotelAdmin()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('hotel_facts')
      .select('id, fact_key, fact_label, fact_value, category, is_active, display_order, created_at, updated_at')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[knowledge GET] query error:', error)
      return NextResponse.json(
        { error: 'Bilgi tabanı getirilemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ facts: data ?? [] }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge GET] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi tabanı getirilemedi', detail: message },
      { status: 500 }
    )
  }
}

// ── POST /api/manager/knowledge ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const manager = await getManagerOrHotelAdmin()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fact_key, fact_label, fact_value, category, is_active } = body

    // Basic validation
    if (!fact_key || !fact_label || !fact_value) {
      return NextResponse.json(
        { error: 'fact_key, fact_label ve fact_value zorunludur' },
        { status: 400 }
      )
    }

    const supabase = getDemoHotelSupabase()

    // Calculate next display_order
    const { data: maxRow } = await supabase
      .from('hotel_facts')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (maxRow?.display_order ?? -1) + 1

    const { data, error } = await supabase
      .from('hotel_facts')
      .insert({
        fact_key: fact_key.trim().toLowerCase(),
        fact_label: fact_label.trim(),
        fact_value: fact_value.trim(),
        category: category ?? 'general',
        is_active: is_active ?? true,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('[knowledge POST] insert error:', error)
      // Unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Bu fact_key zaten kullanımda', field: 'fact_key' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Bilgi eklenemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ fact: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[knowledge POST] unexpected error:', message)
    return NextResponse.json(
      { error: 'Bilgi eklenemedi', detail: message },
      { status: 500 }
    )
  }
}
