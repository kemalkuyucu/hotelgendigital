import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const DEMO_HOTEL_SUPABASE_URL = process.env.DEMO_HOTEL_SUPABASE_URL;
const DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;

if (!DEMO_HOTEL_SUPABASE_URL || !DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('EKSIK ENV: DEMO_HOTEL_SUPABASE_*');
  process.exit(1);
}

const supabase = createClient(DEMO_HOTEL_SUPABASE_URL, DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws }
});

const tables = ['hotel_settings', 'hotel_documents', 'hotel_facts'];

for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`${table}: HATA — ${error.message}`);
  } else {
    console.log(`${table}: ${count} satır`);
  }
}
