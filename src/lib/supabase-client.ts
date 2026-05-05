/**
 * ============================================================================
 * SUPABASE CLIENT FACTORY
 * ============================================================================
 *
 * Provides typed Supabase clients for:
 *   - Central DB (our master DB managing hotels)
 *   - Hotel-specific DBs (returned by tenant-resolver)
 *
 * IMPORTANT:
 *   - This module ONLY runs server-side (API routes, server actions)
 *   - Service role keys must NEVER reach the browser
 *   - For client-side reads, build a separate read-only client elsewhere
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// CENTRAL SUPABASE (singleton)
// ----------------------------------------------------------------------------

let centralClient: SupabaseClient | null = null;

export function getCentralSupabase(): SupabaseClient {
  if (centralClient) return centralClient;

  const url = process.env.CENTRAL_SUPABASE_URL;
  const serviceKey = process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'CENTRAL_SUPABASE_URL and CENTRAL_SUPABASE_SERVICE_ROLE_KEY must be set in environment'
    );
  }

  centralClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  return centralClient;
}

// ----------------------------------------------------------------------------
// DEMO HOTEL SUPABASE (singleton, used during Module 1 testing only)
// ----------------------------------------------------------------------------
// In Module 2+, all hotel access goes through tenant-resolver.ts.
// This direct accessor is for bootstrap & health checks only.

let demoHotelClient: SupabaseClient | null = null;

export function getDemoHotelSupabase(): SupabaseClient {
  if (demoHotelClient) return demoHotelClient;

  const url = process.env.DEMO_HOTEL_SUPABASE_URL;
  const serviceKey = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'DEMO_HOTEL_SUPABASE_URL and DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY must be set in environment'
    );
  }

  demoHotelClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  return demoHotelClient;
}

// ----------------------------------------------------------------------------
// RESET (for testing)
// ----------------------------------------------------------------------------

export function resetSupabaseClients(): void {
  centralClient = null;
  demoHotelClient = null;
}
