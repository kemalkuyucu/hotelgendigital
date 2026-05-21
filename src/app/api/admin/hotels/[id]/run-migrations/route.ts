import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/auth/session'
import { getDecryptedBridge } from '@/lib/tenant/decrypt-credentials'
import { getCentralSupabase } from '@/lib/supabase-client'
import { logAudit } from '@/lib/auth/audit'
import { loadMigrations } from '@/lib/migrations/loadMigrations'
import { ensureMigrationsTable } from '@/lib/migrations/ensureMigrationsTable'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// =============================================================================
// POST /api/admin/hotels/[id]/run-migrations
// Tenant DB'ye 001–008 migration'larını sırayla uygular.
// Her başarılı adım schema_migrations'a yazılır (idempotent).
// Sadece super_admin rolü kullanabilir.
// =============================================================================

function hashSql(sql: string): string {
  return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden: super_admin required' }, { status: 403 })
  }

  const { id } = await params

  // 1) Bridge credentials al
  const bridge = await getDecryptedBridge(id)
  if (!bridge) {
    return NextResponse.json(
      { error: 'Bridge credentials bulunamadı. Önce bağlantı bilgilerini kaydedin.' },
      { status: 400 }
    )
  }

  // 2) Tenant client oluştur (service role)
  const tenantClient = createClient(bridge.supabaseUrl, bridge.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 3) schema_migrations tablosunu garanti et
  try {
    await ensureMigrationsTable(tenantClient)
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: `schema_migrations tablosu oluşturulamadı: ${errMsg}` },
      { status: 500 }
    )
  }

  // 4) Migration dosyalarını yükle (000 bootstrap hariç, 007 destructive hariç)
  let migrations
  try {
    migrations = loadMigrations({ includeDestructive: false })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Migration dosyaları yüklenemedi: ${errMsg}` }, { status: 500 })
  }

  // 5) Mevcut uygulanmış versiyonları çek
  const { data: existingRows } = await tenantClient
    .from('schema_migrations')
    .select('version')

  const appliedVersions = new Set<string>()
  for (const row of existingRows ?? []) {
    appliedVersions.add(row.version as string)
  }

  const success: string[] = []

  // 6) Sırayla uygula
  for (const migration of migrations) {
    // Zaten uygulanmış — idempotent, atla
    if (appliedVersions.has(migration.version)) {
      success.push(migration.version)
      continue
    }

    const migrationStart = Date.now()

    try {
      const { error: execError } = await tenantClient.rpc('exec_sql', {
        sql: migration.sql,
      })

      const durationMs = Date.now() - migrationStart

      if (execError) {
        // Hata kaydı (idempotent upsert)
        await tenantClient.from('schema_migrations').upsert({
          version: migration.version,
          name: migration.name,
          applied_by: `wizard:${admin.username}`,
          success: false,
          error_message: execError.message,
          duration_ms: durationMs,
          sql_hash: hashSql(migration.sql),
        })

        return NextResponse.json({
          success,
          failed: migration.version,
          error: execError.message,
        })
      }

      // Başarı kaydı
      await tenantClient.from('schema_migrations').upsert({
        version: migration.version,
        name: migration.name,
        applied_by: `wizard:${admin.username}`,
        success: true,
        error_message: null,
        duration_ms: durationMs,
        sql_hash: hashSql(migration.sql),
      })

      success.push(migration.version)
    } catch (err) {
      const durationMs = Date.now() - migrationStart
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Hata kaydı dene
      try {
        await tenantClient.from('schema_migrations').upsert({
          version: migration.version,
          name: migration.name,
          applied_by: `wizard:${admin.username}`,
          success: false,
          error_message: errorMessage,
          duration_ms: durationMs,
          sql_hash: hashSql(migration.sql),
        })
      } catch {
        // kayıt başarısız — yoksay
      }

      return NextResponse.json({
        success,
        failed: migration.version,
        error: errorMessage,
      })
    }
  }

  // 7) Audit log
  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.onboarding.migrations_completed',
    resourceType: 'hotel',
    hotelId: id,
    details: { applied: success.length, versions: success },
  })

  // bootstrap_confirmed audit (checkbox onayı client-side'da gerçekleşir,
  // migration runner tetiklendiğinde bootstrap zaten onaylanmış demektir)
  await logAudit({
    actorId: admin.id,
    actorUsername: admin.username,
    action: 'hotel.onboarding.bootstrap_confirmed',
    resourceType: 'hotel',
    hotelId: id,
    details: {},
  })

  // 8) Central: is_healthy hala false (admin oluşturulana kadar)
  const central = getCentralSupabase()
  await central
    .from('bridge_credentials')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('hotel_id', id)

  return NextResponse.json({ success, failed: null })
}
