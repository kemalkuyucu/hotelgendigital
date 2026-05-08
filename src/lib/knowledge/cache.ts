/**
 * ============================================================================
 * KNOWLEDGE BASE — In-Memory Cache
 * ============================================================================
 * buildKnowledgeSummary her mesajda DB'ye gitmesin diye 5 dakikalık cache.
 *
 * ÖNEMLI: Her CRUD endpoint sonunda invalidateSummary() mutlaka çağrılmalı.
 * Çağrılmazsa admin güncelleme yapar ama bot eski bilgi döner.
 * ============================================================================
 */

import { buildKnowledgeSummary } from './build-summary';

interface CacheEntry {
  summary: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 dakika

export async function getCachedSummary(hotelId: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(hotelId);
  if (hit && hit.expiresAt > now) {
    return hit.summary;
  }

  const summary = await buildKnowledgeSummary(hotelId);
  cache.set(hotelId, { summary, expiresAt: now + TTL_MS });
  return summary;
}

/**
 * Cache'i iptal eder. Her CRUD mutasyonundan sonra çağrılmalı.
 * Aksi takdirde bot 5 dakikaya kadar eski veriyi döner.
 */
export function invalidateSummary(hotelId: string): void {
  cache.delete(hotelId);
}
