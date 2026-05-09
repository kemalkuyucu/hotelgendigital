// Modül 8 — Slug-based Tenant Resolver
// central DB'den hotel bilgisini slug ile çeker + bridge credentials decrypt eder

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCentralSupabase } from '@/lib/supabase-client';
import { decryptCredential } from '@/lib/encryption';

export interface HotelTenantInfo {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  hotelSupabase: SupabaseClient;
}

// In-memory cache (5 dk)
const CACHE_TTL_MS = 5 * 60 * 1000;
const slugCache = new Map<string, { info: HotelTenantInfo; expiresAt: number }>();

export async function resolveTenantBySlug(slug: string): Promise<HotelTenantInfo> {
  // Cache hit?
  const cached = slugCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.info;
  }

  const central = getCentralSupabase();

  // Hotel + bridge credentials
  const [hotelResult, bridgeResult] = await Promise.all([
    central
      .from('hotels')
      .select('id, name, slug, status')
      .eq('slug', slug)
      .single(),
    central
      .from('hotels')
      .select('id')
      .eq('slug', slug)
      .single(),
  ]);

  if (hotelResult.error || !hotelResult.data) {
    throw new Error(`Hotel not found for slug: ${slug}`);
  }

  const hotel = hotelResult.data as { id: string; name: string; slug: string; status: string };

  if (hotel.status === 'suspended' || hotel.status === 'cancelled') {
    throw new Error(`Hotel ${slug} is ${hotel.status}`);
  }

  const { data: bridge, error: bridgeError } = await central
    .from('bridge_credentials')
    .select('supabase_url_encrypted, supabase_service_key_encrypted, is_healthy')
    .eq('hotel_id', hotel.id)
    .single();

  if (bridgeError || !bridge) {
    throw new Error(`Bridge credentials not found for hotel: ${slug}`);
  }

  if (!bridge.is_healthy) {
    throw new Error(`Bridge for hotel ${slug} is unhealthy`);
  }

  const supabaseUrl = await decryptCredential(bridge.supabase_url_encrypted as string);
  const supabaseServiceKey = await decryptCredential(bridge.supabase_service_key_encrypted as string);

  const hotelSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  const info: HotelTenantInfo = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelSlug: hotel.slug,
    hotelSupabase,
  };

  slugCache.set(slug, { info, expiresAt: Date.now() + CACHE_TTL_MS });
  return info;
}

export function invalidateSlugCache(slug?: string): void {
  if (slug) {
    slugCache.delete(slug);
  } else {
    slugCache.clear();
  }
}
