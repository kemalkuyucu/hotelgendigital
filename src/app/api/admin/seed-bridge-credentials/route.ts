import { NextRequest, NextResponse } from 'next/server';
import { getCentralSupabase } from '@/lib/supabase-client';
import { encryptCredential } from '@/lib/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_HOTEL_ID = '11840871-1bf3-450f-91bf-0820b82e5416';

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!bootstrapToken) {
    console.error('[seed-bridge] ADMIN_BOOTSTRAP_TOKEN env eksik');
    return NextResponse.json(
      { ok: false, error: 'ADMIN_BOOTSTRAP_TOKEN not configured' },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (provided !== bootstrapToken) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // ── Env değerlerini oku ──────────────────────────────────────────────────
  const supabaseUrl = process.env.DEMO_HOTEL_SUPABASE_URL;
  const supabaseAnonKey = process.env.DEMO_HOTEL_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN_DEMO;
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME_DEMO ?? null;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('DEMO_HOTEL_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('DEMO_HOTEL_SUPABASE_ANON_KEY');
  if (!supabaseServiceKey) missing.push('DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY');
  if (!telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN_DEMO');

  if (missing.length > 0) {
    console.error('[seed-bridge] eksik env değişkenleri:', missing);
    return NextResponse.json(
      { ok: false, error: 'missing env vars', missing },
      { status: 500 },
    );
  }

  // ── Şifreleme ────────────────────────────────────────────────────────────
  let supabaseUrlEncrypted: string;
  let supabaseAnonKeyEncrypted: string;
  let supabaseServiceKeyEncrypted: string;
  let telegramBotTokenEncrypted: string;

  try {
    [
      supabaseUrlEncrypted,
      supabaseAnonKeyEncrypted,
      supabaseServiceKeyEncrypted,
      telegramBotTokenEncrypted,
    ] = await Promise.all([
      encryptCredential(supabaseUrl!),
      encryptCredential(supabaseAnonKey!),
      encryptCredential(supabaseServiceKey!),
      encryptCredential(telegramBotToken!),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown encrypt error';
    console.error('[seed-bridge] şifreleme hatası:', msg);
    return NextResponse.json({ ok: false, error: `encrypt failed: ${msg}` }, { status: 500 });
  }

  // ── Mevcut kayıt var mı kontrol et ───────────────────────────────────────
  const supa = getCentralSupabase();
  const { data: existing, error: selectError } = await supa
    .from('bridge_credentials')
    .select('id')
    .eq('hotel_id', DEMO_HOTEL_ID)
    .maybeSingle();

  if (selectError) {
    console.error('[seed-bridge] select error:', selectError.message);
    return NextResponse.json(
      { ok: false, error: `db select failed: ${selectError.message}` },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  const payload = {
    hotel_id: DEMO_HOTEL_ID,
    supabase_url_encrypted: supabaseUrlEncrypted,
    supabase_anon_key_encrypted: supabaseAnonKeyEncrypted,
    supabase_service_key_encrypted: supabaseServiceKeyEncrypted,
    telegram_bot_token_encrypted: telegramBotTokenEncrypted,
    telegram_bot_username: telegramBotUsername,
    is_healthy: true,
    last_verified_at: now,
    updated_at: now,
  };

  // ── Upsert ───────────────────────────────────────────────────────────────
  let action: 'inserted' | 'updated';

  if (existing) {
    // Güncelle
    const { error: updateError } = await supa
      .from('bridge_credentials')
      .update(payload)
      .eq('hotel_id', DEMO_HOTEL_ID);

    if (updateError) {
      console.error('[seed-bridge] update error:', updateError.message);
      return NextResponse.json(
        { ok: false, error: `db update failed: ${updateError.message}` },
        { status: 500 },
      );
    }
    action = 'updated';
  } else {
    // Yeni kayıt
    const { error: insertError } = await supa
      .from('bridge_credentials')
      .insert({ ...payload, created_at: now });

    if (insertError) {
      console.error('[seed-bridge] insert error:', insertError.message);
      return NextResponse.json(
        { ok: false, error: `db insert failed: ${insertError.message}` },
        { status: 500 },
      );
    }
    action = 'inserted';
  }

  console.log(`[seed-bridge] OK — hotel_id=${DEMO_HOTEL_ID} action=${action}`);
  return NextResponse.json({ ok: true, hotel_id: DEMO_HOTEL_ID, action });
}
