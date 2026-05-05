/**
 * ============================================================================
 * /api/health-check — System verification endpoint
 * ============================================================================
 *
 * Tests that all environment variables are set and connections work.
 * Run after deployment to verify Module 1 is alive.
 *
 * Usage: GET /api/health-check
 * Returns: { status: "ok" | "error", checks: {...} }
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { getCentralSupabase, getDemoHotelSupabase } from '@/lib/supabase-client';
import { testEncryptionRoundTrip } from '@/lib/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckResult {
  ok: boolean;
  message: string;
}

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  checks: Record<string, CheckResult>;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checks: Record<string, CheckResult> = {};

  // Check 1: Required env vars
  checks.env_vars = checkEnvVars();

  // Check 2: Central Supabase connection
  checks.central_supabase = await checkCentralSupabase();

  // Check 3: Demo hotel Supabase connection
  checks.demo_hotel_supabase = await checkDemoHotelSupabase();

  // Check 4: Encryption round-trip
  checks.encryption = await checkEncryption();

  // Check 5: pgvector extension
  checks.pgvector = await checkPgVector();

  // Check 6: Seed data
  checks.seed_data = await checkSeedData();

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}

// ----------------------------------------------------------------------------
// CHECKS
// ----------------------------------------------------------------------------

function checkEnvVars(): CheckResult {
  const required = [
    'CENTRAL_SUPABASE_URL',
    'CENTRAL_SUPABASE_SERVICE_ROLE_KEY',
    'DEMO_HOTEL_SUPABASE_URL',
    'DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_MASTER_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  return missing.length === 0
    ? { ok: true, message: 'All required env vars present' }
    : { ok: false, message: `Missing: ${missing.join(', ')}` };
}

async function checkCentralSupabase(): Promise<CheckResult> {
  try {
    const sb = getCentralSupabase();
    const { error } = await sb.from('packages').select('code').limit(1);
    return error
      ? { ok: false, message: `Central query failed: ${error.message}` }
      : { ok: true, message: 'Connected, packages table accessible' };
  } catch (err) {
    return { ok: false, message: `Central client error: ${(err as Error).message}` };
  }
}

async function checkDemoHotelSupabase(): Promise<CheckResult> {
  try {
    const sb = getDemoHotelSupabase();
    const { error } = await sb.from('departments').select('code').limit(1);
    return error
      ? { ok: false, message: `Demo hotel query failed: ${error.message}` }
      : { ok: true, message: 'Connected, departments table accessible' };
  } catch (err) {
    return { ok: false, message: `Demo hotel client error: ${(err as Error).message}` };
  }
}

async function checkEncryption(): Promise<CheckResult> {
  try {
    const ok = await testEncryptionRoundTrip();
    return ok
      ? { ok: true, message: 'AES-256-GCM round-trip successful' }
      : { ok: false, message: 'Encryption round-trip mismatch' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

async function checkPgVector(): Promise<CheckResult> {
  try {
    const sb = getDemoHotelSupabase();
    const { data, error } = await sb.rpc('match_documents', {
      query_embedding: new Array(1536).fill(0),
      match_threshold: 0.0,
      match_count: 1,
    });
    if (error) {
      return { ok: false, message: `pgvector RPC failed: ${error.message}` };
    }
    return { ok: true, message: 'pgvector extension active, match_documents RPC works' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

async function checkSeedData(): Promise<CheckResult> {
  try {
    const central = getCentralSupabase();
    const [pkgs, admins, demoHotel] = await Promise.all([
      central.from('packages').select('code'),
      central.from('master_admins').select('username'),
      central.from('hotels').select('slug').eq('slug', 'demo-resort-spa').maybeSingle(),
    ]);

    const pkgCount = pkgs.data?.length ?? 0;
    const adminCount = admins.data?.length ?? 0;
    const hasDemoHotel = !!demoHotel.data;

    if (pkgCount < 3) return { ok: false, message: `Expected 3 packages, got ${pkgCount}` };
    if (adminCount < 3) return { ok: false, message: `Expected 3 admins, got ${adminCount}` };
    if (!hasDemoHotel) return { ok: false, message: 'Demo hotel not seeded' };

    return { ok: true, message: '3 packages + 3 admins + demo hotel present' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
