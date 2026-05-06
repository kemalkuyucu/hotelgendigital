import { createBrowserClient } from '@supabase/ssr'

export function getCentralBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_CENTRAL_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CENTRAL_SUPABASE_ANON_KEY!
  )
}
