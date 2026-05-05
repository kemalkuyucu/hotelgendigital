/**
 * ============================================================================
 * TENANT RESOLVER — The heart of multi-tenant architecture
 * ============================================================================
 *
 * When a message arrives from WhatsApp/Telegram/Instagram, we need to know:
 *   1. Which hotel does this guest belong to?
 *   2. Which Supabase database holds that hotel's data?
 *
 * This module resolves channel ID → hotel → hotel-specific Supabase client.
 *
 * Flow:
 *   1. Webhook receives message with channel_id
 *   2. resolveTenant(channelType, channelId) is called
 *   3. We look up channel_routing table in Central DB
 *   4. We fetch encrypted bridge_credentials for that hotel
 *   5. We decrypt the hotel's Supabase URL + service key
 *   6. We return a Supabase client connected to THAT hotel's DB
 *   7. All subsequent queries in this request use that client
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decryptCredential } from './encryption';
import { getCentralSupabase } from './supabase-client';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type ChannelType = 'whatsapp' | 'telegram' | 'instagram';

export interface TenantContext {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  packageCode: 'basic' | 'full' | 'premium';
  packageFeatures: Record<string, unknown>;
  hotelLogoUrl: string | null;
  hotelBrandColor: string | null;
  defaultLanguage: string;
  isDemo: boolean;
  hotelSupabase: SupabaseClient;
}

interface CachedTenant {
  context: TenantContext;
  expiresAt: number;
}

// ----------------------------------------------------------------------------
// IN-MEMORY CACHE (5 minutes — refreshed on cache miss)
// ----------------------------------------------------------------------------
// Note: This cache is per-Vercel-instance. In production with many hotels,
// consider Redis. For now, in-memory is fine.

const CACHE_TTL_MS = 5 * 60 * 1000;
const tenantCache = new Map<string, CachedTenant>();

function cacheKey(channelType: ChannelType, channelId: string): string {
  return `${channelType}:${channelId}`;
}

// ----------------------------------------------------------------------------
// MAIN RESOLVER
// ----------------------------------------------------------------------------

/**
 * Resolves a channel identifier to a fully-loaded tenant context.
 * Throws if the channel is not registered or hotel is suspended.
 */
export async function resolveTenant(
  channelType: ChannelType,
  channelId: string
): Promise<TenantContext> {
  const key = cacheKey(channelType, channelId);

  // Check cache
  const cached = tenantCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  // Cache miss — fetch from Central DB
  const central = getCentralSupabase();

  // Step 1: Find hotel via channel_routing
  const { data: routing, error: routingError } = await central
    .from('channel_routing')
    .select('hotel_id')
    .eq('channel_type', channelType)
    .eq('channel_identifier', channelId)
    .eq('is_active', true)
    .maybeSingle();

  if (routingError) {
    throw new Error(`Channel routing lookup failed: ${routingError.message}`);
  }
  if (!routing) {
    throw new TenantNotFoundError(channelType, channelId);
  }

  // Step 2: Fetch hotel details + package + bridge credentials in parallel
  const [hotelResult, bridgeResult] = await Promise.all([
    central
      .from('hotels')
      .select(`
        id, name, slug, logo_url, brand_color, status, is_demo,
        package:packages(code, features)
      `)
      .eq('id', routing.hotel_id)
      .single(),
    central
      .from('bridge_credentials')
      .select('supabase_url_encrypted, supabase_service_key_encrypted, is_healthy')
      .eq('hotel_id', routing.hotel_id)
      .single(),
  ]);

  if (hotelResult.error || !hotelResult.data) {
    throw new Error(`Hotel lookup failed: ${hotelResult.error?.message}`);
  }
  if (bridgeResult.error || !bridgeResult.data) {
    throw new Error(`Bridge credentials lookup failed: ${bridgeResult.error?.message}`);
  }

  const hotel = hotelResult.data;
  const bridge = bridgeResult.data;

  // Step 3: Validate hotel status
  if (hotel.status === 'suspended' || hotel.status === 'cancelled') {
    throw new TenantSuspendedError(hotel.id, hotel.status);
  }
  if (!bridge.is_healthy) {
    throw new Error(`Bridge to hotel ${hotel.id} is marked unhealthy`);
  }

  // Step 4: Decrypt credentials
  const supabaseUrl = await decryptCredential(bridge.supabase_url_encrypted);
  const supabaseServiceKey = await decryptCredential(bridge.supabase_service_key_encrypted);

  // Step 5: Build hotel-specific Supabase client
  const hotelSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  // Step 6: Build context
  const pkg = (hotel.package as unknown) as { code: string; features: Record<string, unknown> };
  const context: TenantContext = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelSlug: hotel.slug,
    packageCode: (pkg?.code ?? 'full') as 'basic' | 'full' | 'premium',
    packageFeatures: pkg?.features ?? {},
    hotelLogoUrl: hotel.logo_url,
    hotelBrandColor: hotel.brand_color,
    defaultLanguage: 'tr',
    isDemo: hotel.is_demo ?? false,
    hotelSupabase,
  };

  // Step 7: Cache and return
  tenantCache.set(key, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return context;
}

// ----------------------------------------------------------------------------
// CACHE INVALIDATION
// ----------------------------------------------------------------------------
// Call this when bridge_credentials change for a hotel
export function invalidateTenantCache(channelType?: ChannelType, channelId?: string): void {
  if (channelType && channelId) {
    tenantCache.delete(cacheKey(channelType, channelId));
  } else {
    tenantCache.clear();
  }
}

// ----------------------------------------------------------------------------
// CUSTOM ERRORS
// ----------------------------------------------------------------------------

export class TenantNotFoundError extends Error {
  constructor(channelType: string, channelId: string) {
    super(`No hotel registered for ${channelType}:${channelId}`);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantSuspendedError extends Error {
  constructor(hotelId: string, status: string) {
    super(`Hotel ${hotelId} is ${status}`);
    this.name = 'TenantSuspendedError';
  }
}
