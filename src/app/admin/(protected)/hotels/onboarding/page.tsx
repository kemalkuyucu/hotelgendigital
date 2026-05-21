import { redirect } from 'next/navigation'
import { getCentralSupabase } from '@/lib/supabase-client'
import { getSessionAdmin } from '@/lib/auth/session'
import OnboardingWizard from './_onboarding-wizard'

// =============================================================================
// /admin/hotels/onboarding
// Server component — paket listesi + kısmi devam (resume) desteği.
// =============================================================================

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function HotelOnboardingPage({ searchParams }: Props) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')
  if (admin.role !== 'super_admin') redirect('/admin/hotels')

  const { id } = await searchParams
  const supabase = getCentralSupabase()

  // Paket listesi
  const { data: packages } = await supabase
    .from('packages')
    .select('id, code, display_name')
    .eq('is_active', true)
    .order('monthly_price_usd')

  // Kısmi devam: ?id=X ile açılmışsa otel + bridge durumu oku
  let resumeHotel: {
    id: string
    name: string
    slug: string
    package_id: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    address: string | null
    is_demo: boolean
    is_healthy: boolean
    has_credentials: boolean
  } | null = null

  if (id) {
    const { data: hotel } = await supabase
      .from('hotels')
      .select('id, name, slug, package_id, contact_name, contact_email, contact_phone, address, is_demo')
      .eq('id', id)
      .single()

    if (hotel) {
      const { data: bridge } = await supabase
        .from('bridge_credentials')
        .select('is_healthy, supabase_url_encrypted')
        .eq('hotel_id', id)
        .maybeSingle()

      resumeHotel = {
        ...hotel,
        is_healthy: bridge?.is_healthy ?? false,
        has_credentials: !!bridge?.supabase_url_encrypted,
      }
    }
  }

  // Bootstrap SQL içeriği (migrations/tenant/000_bootstrap.sql okunur)
  const fs = await import('fs')
  const path = await import('path')
  const bootstrapPath = path.resolve(process.cwd(), 'migrations', 'tenant', '000_bootstrap.sql')
  const bootstrapSql = fs.existsSync(bootstrapPath)
    ? fs.readFileSync(bootstrapPath, 'utf-8')
    : '-- 000_bootstrap.sql bulunamadı'

  return (
    <OnboardingWizard
      packages={packages ?? []}
      bootstrapSql={bootstrapSql}
      resumeHotel={resumeHotel}
    />
  )
}
