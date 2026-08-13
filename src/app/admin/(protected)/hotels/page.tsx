import { getCentralSupabase } from '@/lib/supabase-client'
import { purgeInfo } from '@/lib/hotels/retention'
import OtellerClient from './_oteller-client'

export const dynamic = 'force-dynamic'

export default async function HotelsListPage() {
  const supabase = getCentralSupabase()
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, slug, status, is_demo, package_id, deleted_at, deleted_by, purge_hold, packages(display_name)')
    .order('created_at', { ascending: false })

  // Geri sayim SUNUCUDA hesaplanir: istemci saati degistirilebilir ve cron'un
  // kullandigi esikle ayrisirsa panel yalan soyler. Tek kaynak: retention.ts
  const now = new Date()
  const rows = (hotels ?? []).map((h) => {
    const info = purgeInfo(h.deleted_at as string | null, now)
    return {
      ...h,
      purge_days_left: info.daysLeft,
      purge_at: info.purgeAt?.toISOString() ?? null,
      purge_due: info.due,
    }
  })

  return <OtellerClient hotels={rows} />
}
