import { NextRequest, NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'
import { getDemoHotelSupabase } from '@/lib/supabase-client'

// hotel_settings is a singleton table — no hotel_id column exists.

// ── Shape of the 7 fields we manage in this step ──────────────────────────────
interface HotelSettingsPayload {
  hotel_name: string
  contact_phone?: string | null
  contact_email?: string | null
  address?: string | null
  concept_type?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  general_rules?: string | null
}

// ── GET /api/manager/hotel-settings ──────────────────────────────────────────
export async function GET() {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getDemoHotelSupabase()

    const { data, error } = await supabase
      .from('hotel_settings')
      .select(
        'id, hotel_name, contact_phone, contact_email, address, concept_type, check_in_time, check_out_time, general_rules'
      )
      .maybeSingle()

    if (error) {
      console.error('[hotel-settings GET] query error:', error)
      return NextResponse.json(
        { error: 'Otel ayarları getirilemedi', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings: data ?? null }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[hotel-settings GET] unexpected error:', message)
    return NextResponse.json(
      { error: 'Otel ayarları getirilemedi', detail: message },
      { status: 500 }
    )
  }
}

// ── PUT /api/manager/hotel-settings ──────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as HotelSettingsPayload

    // Basic server-side validation
    if (!body.hotel_name || body.hotel_name.trim().length === 0) {
      return NextResponse.json({ error: 'Otel adı zorunludur' }, { status: 400 })
    }

    const supabase = getDemoHotelSupabase()

    // Check if a row already exists (singleton table — no hotel_id column)
    const { data: existing, error: selectError } = await supabase
      .from('hotel_settings')
      .select('id')
      .maybeSingle()

    if (selectError) {
      console.error('[hotel-settings PUT] select error:', selectError)
      return NextResponse.json(
        { error: 'Kayıt kontrol edilemedi', detail: selectError.message },
        { status: 500 }
      )
    }

    const payload = {
      hotel_name: body.hotel_name.trim(),
      contact_phone: body.contact_phone?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      address: body.address?.trim() || null,
      concept_type: body.concept_type || 'all_inclusive',
      check_in_time: body.check_in_time || '14:00',
      check_out_time: body.check_out_time || '12:00',
      general_rules: body.general_rules?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let upsertError: { message: string } | null = null

    if (existing?.id) {
      // UPDATE
      const { error } = await supabase
        .from('hotel_settings')
        .update(payload)
        .eq('id', existing.id)
      upsertError = error
    } else {
      // INSERT
      const { error } = await supabase
        .from('hotel_settings')
        .insert(payload)
      upsertError = error
    }

    if (upsertError) {
      console.error('[hotel-settings PUT] upsert error:', upsertError)
      return NextResponse.json(
        { error: 'Otel ayarları kaydedilemedi', detail: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[hotel-settings PUT] unexpected error:', message)
    return NextResponse.json(
      { error: 'Otel ayarları kaydedilemedi', detail: message },
      { status: 500 }
    )
  }
}
