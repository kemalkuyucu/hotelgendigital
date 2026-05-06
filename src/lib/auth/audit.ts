import { getCentralServerClient } from '@/lib/supabase/central-server'

export async function logAudit(params: {
  actorId: string
  actorUsername: string
  action: string
  resourceType?: string
  resourceId?: string
  hotelId?: string
  details?: Record<string, unknown>
  ip?: string
  userAgent?: string
}) {
  const supabase = await getCentralServerClient()
  await supabase.from('audit_log').insert({
    actor_type: 'master_admin',
    actor_id: params.actorId,
    actor_username: params.actorUsername,
    action: params.action,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    hotel_id: params.hotelId ?? null,
    details: params.details ?? {},
    ip_address: params.ip ?? null,
    user_agent: params.userAgent ?? null,
  })
}
