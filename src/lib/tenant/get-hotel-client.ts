import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getDecryptedBridge } from './decrypt-credentials'

// Process içinde basit cache (Vercel serverless'da request bazlı kalır)
const clientCache = new Map<string, { client: SupabaseClient; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 dakika

export async function getHotelClient(
  hotelId: string,
  options: { mode?: 'service' | 'anon' } = {}
): Promise<SupabaseClient | null> {
  const mode = options.mode ?? 'service'
  const cacheKey = `${hotelId}:${mode}`

  const cached = clientCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client
  }

  const bridge = await getDecryptedBridge(hotelId)
  if (!bridge) return null

  const key = mode === 'service' ? bridge.supabaseServiceKey : bridge.supabaseAnonKey
  const client = createClient(bridge.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  clientCache.set(cacheKey, { client, expiresAt: Date.now() + CACHE_TTL_MS })
  return client
}

export function clearHotelClientCache(hotelId?: string) {
  if (hotelId) {
    clientCache.delete(`${hotelId}:service`)
    clientCache.delete(`${hotelId}:anon`)
  } else {
    clientCache.clear()
  }
}
