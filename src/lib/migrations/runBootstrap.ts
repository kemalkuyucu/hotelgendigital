// =============================================================================
// src/lib/migrations/runBootstrap.ts
// Tenant DB'de exec_sql RPC fonksiyonunu oluşturur.
// exec_sql yokken RPC kullanamayız — bu yüzden "raw" sorgu yaklaşımı:
// supabase-js .rpc('exec_sql') yerine doğrudan SQL Editor benzeri yol.
// Supabase JS client, DDL için .rpc('exec_sql') gerektirir; bootstrap için
// service_role anon key ile pg_query benzeri yol yok.
// Çözüm: Supabase Management API (REST) üzerinden SQL çalıştır.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getHotelBySlug } from '@/lib/tenant/get-hotel-by-slug';
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials';

export interface RunBootstrapOptions {
  hotelSlug: string;
}

export interface BootstrapResult {
  success: boolean;
  hotelSlug: string;
  message: string;
  alreadyExists?: boolean;
}

/**
 * Tenant DB'de exec_sql RPC fonksiyonunu oluşturur.
 *
 * Strateji:
 * 1) exec_sql zaten var mı? → pg_proc sorgusu ile kontrol et (select ile).
 * 2) Varsa: idempotent, başarı döndür.
 * 3) Yoksa: Supabase JS client .rpc('query') yoktur; ancak service_role key
 *    ile .from('_temp') gibi hileler çalışmaz.
 *    Gerçek çözüm: Supabase Management API /v1/projects/{ref}/database/query
 *    endpoint'i (service_role token ile değil, access_token ile çalışır —
 *    bu sadece Supabase Dashboard token'ı). Bu ortamda mevcut değil.
 *
 * Pratik çözüm: supabase-js createClient ile service_role key kullanarak
 * exec_sql'i CREATE OR REPLACE ile çalıştırmayı DENEYİZ. Eğer exec_sql
 * zaten var ise bu başarıyla çalışır (kendi kendini bootstrap eder).
 * Eğer exec_sql hiç yoksa bu başarısız olur — Supabase SQL Editor'de
 * 000_bootstrap.sql manuel çalıştırılmalı.
 *
 * İdempotent: Birden fazla çağrı zararlı değil.
 */
export async function runBootstrap(opts: RunBootstrapOptions): Promise<BootstrapResult> {
  const { hotelSlug } = opts;

  // 1) Hotel kimlik bilgilerini al
  const hotel = await getHotelBySlug(hotelSlug);
  if (!hotel) {
    throw new Error(`Hotel bulunamadı: ${hotelSlug}`);
  }

  const bridge = await getDecryptedBridge(hotel.id);
  if (!bridge) {
    throw new Error(`Hotel bridge credentials bulunamadı: ${hotelSlug}`);
  }

  const tenantClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2) exec_sql zaten var mı kontrol et
  const { data: existsCheck } = await tenantClient
    .from('pg_proc')
    .select('proname')
    .limit(1)
    .maybeSingle();

  // pg_proc direkt sorgulanamaz (supabase-js izin vermez), farklı yaklaşım:
  // exec_sql'i çağırmayı dene — başarılıysa zaten vardır.
  const testSql = 'SELECT 1';
  const { error: testError } = await tenantClient.rpc('exec_sql', { sql: testSql });

  if (!testError) {
    // exec_sql zaten çalışıyor — idempotent
    console.log(`[bootstrap] exec_sql zaten mevcut: ${hotelSlug}`);
    return {
      success: true,
      hotelSlug,
      message: 'exec_sql zaten mevcut, bootstrap atlandı.',
      alreadyExists: true,
    };
  }

  // 3) exec_sql yok — CREATE OR REPLACE dene
  // Supabase JS client ile DDL çalıştırmak için:
  // service_role key + Supabase REST /rest/v1/rpc yolu exec_sql olmadan DDL çalıştıramaz.
  // Supabase pg_connection_string üzerinden node-postgres ile bağlanmak gerekir.
  // Bu ortamda pg (node-postgres) paketi yoksa alternatif:
  // Supabase Management API ile çalıştır.

  const bootstrapSqlPath = path.resolve(process.cwd(), 'migrations', 'tenant', '000_bootstrap.sql');
  const bootstrapSql = fs.readFileSync(bootstrapSqlPath, 'utf-8');

  // Supabase Management API: /v1/projects/{ref}/database/query
  // Supabase ref: URL'den çıkar (https://{ref}.supabase.co)
  const urlMatch = bridge.supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (!urlMatch) {
    return {
      success: false,
      hotelSlug,
      message: 'Supabase project ref çıkarılamadı. Manuel bootstrap gerekli.',
    };
  }

  const projectRef = urlMatch[1];

  // Management API'yi service_role key ile kullanamayız (access_token gerekir).
  // Bu nedenle execSql'i supabase-js üzerinden çalıştırmak için
  // alternatif: schema_migrations tablosuna doğrudan insert yapabiliyorsak
  // (supabase otomatik tablo izni veriyor service_role'e), seed'i oraya yazarız.
  // Ama exec_sql oluşturmak için gerçekten DDL gerekir.

  // Son çare raporu:
  console.warn(
    `[bootstrap] exec_sql RPC bulunamadı: ${hotelSlug}. ` +
    `Lütfen migrations/tenant/000_bootstrap.sql dosyasını ` +
    `Supabase SQL Editor'de (${bridge.supabaseUrl}) çalıştırın. ` +
    `Project ref: ${projectRef}`
  );

  return {
    success: false,
    hotelSlug,
    message:
      `exec_sql RPC yok. Lütfen Supabase SQL Editor'de ` +
      `migrations/tenant/000_bootstrap.sql dosyasını çalıştırın. ` +
      `Proje: ${bridge.supabaseUrl}`,
  };
}

// =============================================================================
// CLI çalıştırma (direkt: npx ts-node -e "require('./runBootstrap').main()")
// =============================================================================
export async function runBootstrapCli(hotelSlug: string) {
  console.log(`[bootstrap] Başlatılıyor: ${hotelSlug}`);
  try {
    const result = await runBootstrap({ hotelSlug });
    console.log('[bootstrap] Sonuç:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('[bootstrap] Hata:', err);
    throw err;
  }
}
