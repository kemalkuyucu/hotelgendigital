import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getCentralServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.CENTRAL_SUPABASE_URL!,
    process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — set is ignored
          }
        },
      },
    }
  )
}
