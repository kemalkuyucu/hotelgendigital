import { getCentralSupabase } from '@/lib/supabase-client'
import OtellerClient from './_oteller-client'

export const dynamic = 'force-dynamic'

export default async function HotelsListPage() {
  const supabase = getCentralSupabase()
  const { data: hotels } = await supabase
    .from('hotels')
    .select('id, name, slug, status, is_demo, package_id, deleted_at, deleted_by, packages(display_name)')
    .order('created_at', { ascending: false })

  return <OtellerClient hotels={hotels ?? []} />
}

