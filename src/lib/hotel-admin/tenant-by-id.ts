// Modül 8 — Hotel ID ile tenant resolver (master admin tarafı için)
// slug yerine doğrudan hotel ID kullanır

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCentralSupabase } from '@/lib/supabase-client';
import { decryptCredential } from '@/lib/encryption';

export interface HotelTenantById {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  hotelSupabase: SupabaseClient;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const idCache = new Map<string, { info: HotelTenantById; expiresAt: number }>();

export async function resolveTenantByHotelId(hotelId: string): Promise<HotelTenantById> {
  const cached = idCache.get(hotelId);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const central = getCentralSupabase();

  const [hotelResult, bridgeResult] = await Promise.all([
    central.from('hotels').select('id, name, slug, status').eq('id', hotelId).single(),
    central
      .from('bridge_credentials')
      .select('supabase_url_encrypted, supabase_service_key_encrypted, is_healthy')
      .eq('hotel_id', hotelId)
      .single(),
  ]);

  if (hotelResult.error || !hotelResult.data) {
    throw new Error(`Hotel not found: ${hotelId}`);
  }
  if (bridgeResult.error || !bridgeResult.data) {
    throw new Error(`Bridge credentials not found for hotel: ${hotelId}`);
  }

  const hotel = hotelResult.data as { id: string; name: string; slug: string; status: string };
  const bridge = bridgeResult.data as {
    supabase_url_encrypted: string;
    supabase_service_key_encrypted: string;
    is_healthy: boolean;
  };

  if (!bridge.is_healthy) throw new Error(`Bridge for hotel ${hotelId} is unhealthy`);

  const supabaseUrl = await decryptCredential(bridge.supabase_url_encrypted);
  const supabaseServiceKey = await decryptCredential(bridge.supabase_service_key_encrypted);

  const hotelSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  const info: HotelTenantById = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelSlug: hotel.slug,
    hotelSupabase,
  };

  idCache.set(hotelId, { info, expiresAt: Date.now() + CACHE_TTL_MS });
  return info;
}
