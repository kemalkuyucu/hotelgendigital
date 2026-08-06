import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * KALICI RATE LIMIT — denial-of-wallet savunmasi (migration 030).
 *
 * KOK SORUN: route.ts'teki `_rateLimitMap` MODUL-SEVIYESI bir Map'tir. Vercel'de
 * her invocation ayri instance olabilir -> sayac cold start'ta SIFIRLANIR ve
 * instance'lar birbirinin sayacini GORMEZ. Ayrica yalniz chat basinadir: N sahte
 * hesapla gelen bir saldirgan otelin AI butcesini (Anthropic + Whisper) tuketebilir,
 * cunku OTEL CAPINDA tavan YOKTU.
 *
 * Bu modul sayaci tenant DB'ye tasir (tum instance'lar ayni satiri gorur) ve
 * ikinci bir tavan ekler: otel basina.
 *
 * IN-MEMORY GATE'IN YERINI ALMAZ — onun ONUNDE degil, ARKASINDA durur:
 *   in-memory = ucuz, DB'ye hic gitmeden bariz floodu keser (ayni instance).
 *   bu modul  = otoriter, instance'lar arasi ve otel capinda.
 *
 * FAIL-OPEN (BILINCLI, yon TERSINE CEVRILEMEZ): sayac okunamazsa istek GECER.
 * Migration'i kosmamis tenant'ta `rate_limit_hit` fonksiyonu YOKTUR -> rpc hata
 * doner -> eski davranisa (yalniz in-memory) duseriz. Ters yon (hatada blokla)
 * bir DB kesintisinde TUM misafirleri susturur — §3 SESSIZ YUTMA'nin en agir
 * hali. Fazladan AI maliyeti, kayip misafir talebinden iyidir.
 */

/** Sabit pencere boyu (saniye). route.ts'teki in-memory pencereyle AYNI. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Tek misafir (telegram user id) icin pencere basina tavan.
 * In-memory gate ile AYNI deger: bu kapinin tek isi ayni siniri instance'lar
 * ARASINDA da gecerli kilmak, siniri SIKILASTIRMAK degil.
 */
export const RATE_LIMIT_MAX_PER_CHAT = 10;

/**
 * Otel capinda pencere basina tavan — dakikada 600 mesaj (~10/sn).
 * BILINCLI olarak YUKSEK: normal bir otelin tum misafirleri birlikte bile bu
 * hacme ulasmaz, yani mesru trafigi kesmez; tavan yalniz otomatize bir
 * tuketim saldirisinda devreye girer. Esigi dusurmek once GERCEK zirve
 * trafiginin olculmesini gerektirir (bkz. rapor: canli olcum YOK).
 */
export const RATE_LIMIT_MAX_PER_HOTEL = 600;

export type RateLimitScope = 'chat' | 'hotel';

export interface RateLimitVerdict {
  /** false = esik asildi, cagiran istegi DUSURMELI. */
  allowed: boolean;
  /** Hangi tavan asildi (allowed=true iken null). */
  scope: RateLimitScope | null;
  /** Asilan sayacin guncel degeri (bilinmiyorsa null). */
  hits: number | null;
  /** true = sayac okunamadi, karar FAIL-OPEN verildi (teshis icin). */
  degraded: boolean;
}

const ALLOW: RateLimitVerdict = { allowed: true, scope: null, hits: null, degraded: false };

interface RateLimitRow {
  chat_hits: number | null;
  hotel_hits: number | null;
}

/**
 * Sayaclari ATOMIK artirir ve tavan asildi mi karar verir. (IO — tenant DB)
 *
 * Artirma ve okuma TEK deyimde (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`,
 * migration 030) olur; uygulama tarafinda SELECT+UPDATE yarisi YOKTUR.
 *
 * DIKKAT — sayac cagri BASINA artar, "izin verilen" basina DEGIL: esigi asan
 * istek de sayilir. Israrla devam eden bir saldirgan pencerenin sonuna kadar
 * bloklu kalir; bu istenen davranistir.
 */
export async function claimRateLimit(
  supa: SupabaseClient,
  hotelSlug: string,
  subject: string,
): Promise<RateLimitVerdict> {
  try {
    const { data, error } = await supa.rpc('rate_limit_hit', {
      p_hotel_slug: hotelSlug,
      p_subject: subject,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (error) {
      console.log('[rate-limit] sayac okunamadi, FAIL-OPEN:', error.message);
      return { allowed: true, scope: null, hits: null, degraded: true };
    }

    // RETURNS TABLE -> tek satirlik dizi
    const row: RateLimitRow | null = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    if (!row) return { allowed: true, scope: null, hits: null, degraded: true };

    const chatHits = typeof row.chat_hits === 'number' ? row.chat_hits : null;
    const hotelHits = typeof row.hotel_hits === 'number' ? row.hotel_hits : null;

    if (chatHits !== null && chatHits > RATE_LIMIT_MAX_PER_CHAT) {
      return { allowed: false, scope: 'chat', hits: chatHits, degraded: false };
    }
    if (hotelHits !== null && hotelHits > RATE_LIMIT_MAX_PER_HOTEL) {
      return { allowed: false, scope: 'hotel', hits: hotelHits, degraded: false };
    }
    return ALLOW;
  } catch (err) {
    // Ag/timeout gibi atilan hatalar da FAIL-OPEN tarafinda kalir.
    console.log('[rate-limit] claim-error, FAIL-OPEN:', err instanceof Error ? err.message : 'bilinmeyen');
    return { allowed: true, scope: null, hits: null, degraded: true };
  }
}
