import { createClient } from '@supabase/supabase-js';

export interface HotelRow {
  id: string;
  slug: string;
  name: string;
  status: string;
}

let centralClient: ReturnType<typeof createClient> | null = null;

function getCentralClient() {
  if (!centralClient) {
    centralClient = createClient(
      process.env.CENTRAL_SUPABASE_URL!,
      process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return centralClient;
}

export async function getHotelBySlug(slug: string): Promise<HotelRow | null> {
  const { data, error } = await getCentralClient()
    .from('hotels')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`getHotelBySlug error: ${error.message}`);
  return data as HotelRow | null;
}
