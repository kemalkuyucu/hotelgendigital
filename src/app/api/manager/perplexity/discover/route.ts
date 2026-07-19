import { NextResponse } from 'next/server';
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { getDemoHotelSupabase } from '@/lib/supabase-client';
import { queryPerplexity } from '@/lib/perplexity/client';
import { getCategoryByTag, PERPLEXITY_CATEGORIES } from '@/lib/perplexity/categories';
import type { InterestTag } from '@/lib/perplexity/types';

/**
 * GET — Tüm cache'lenmiş keşif sonuçlarını listele
 * Query: ?tag=restaurant (opsiyonel filtre)
 */
export async function GET(request: Request) {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');

  const supabase = session.hotel_slug
    ? (await resolveTenantBySlug(session.hotel_slug)).hotelSupabase
    : getDemoHotelSupabase();
  let query = supabase
    .from('perplexity_discoveries')
    .select('*')
    .order('created_at', { ascending: false });

  if (tag) {
    query = query.eq('interest_tag', tag);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    discoveries: data ?? [],
    categories: PERPLEXITY_CATEGORIES,
  });
}

/**
 * POST — Yeni keşif sorgusu yap (cache kontrolü ile)
 * Body: { tag: 'restaurant', force_refresh?: boolean }
 */
export async function POST(request: Request) {
  const session = await getManagerOrHotelAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { tag?: string; force_refresh?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const tag = body.tag;
  const forceRefresh = body.force_refresh === true;

  if (!tag) {
    return NextResponse.json({ error: 'tag parametresi zorunlu' }, { status: 400 });
  }

  const category = getCategoryByTag(tag);
  if (!category) {
    return NextResponse.json(
      { error: `Geçersiz kategori: ${tag}` },
      { status: 400 },
    );
  }

  const supabase = session.hotel_slug
    ? (await resolveTenantBySlug(session.hotel_slug)).hotelSupabase
    : getDemoHotelSupabase();

  // 1. Cache kontrol (force_refresh değilse)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('perplexity_discoveries')
      .select('*')
      .eq('interest_tag', tag)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        discovery: cached,
        cache_hit: true,
      });
    }
  }

  // 2. Otel adresini al
  const { data: hotelSettings, error: hotelError } = await supabase
    .from('hotel_settings')
    .select('address, hotel_name')
    .limit(1)
    .maybeSingle();

  if (hotelError) {
    return NextResponse.json({ error: hotelError.message }, { status: 500 });
  }
  if (!hotelSettings?.address) {
    return NextResponse.json(
      { error: 'Otel adresi tanımlı değil. Önce Otel Bilgileri sekmesinden adres ekleyin.' },
      { status: 400 },
    );
  }

  // 3. Perplexity'ye sor
  let result;
  try {
    result = await queryPerplexity(tag as InterestTag, hotelSettings.address);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Perplexity API hatası',
      },
      { status: 502 },
    );
  }

  // 4. Sonucu DB'ye yaz
  const queryText = category.prompt_template.replace('{address}', hotelSettings.address);

  // FIX 1a: expires_at her zaman set edilmeli — NULL kayıtlar UI'da "süresi doldu" gösteriyor
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Ayni tag icin eski kayitlari temizle — birikmeyi onle (bot en yeniyi okur, eskiler artik kalmaz)
  await supabase.from('perplexity_discoveries').delete().eq('interest_tag', tag);

  const { data: inserted, error: insertError } = await supabase
    .from('perplexity_discoveries')
    .insert({
      interest_tag: tag,
      query_text: queryText,
      results: result.places,
      raw_response: result.raw_response,
      sources: result.sources,
      model_used: result.model_used,
      tokens_used: result.tokens_used,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    discovery: inserted,
    cache_hit: false,
  });
}
