import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const DEMO_HOTEL_SUPABASE_URL = 'https://rvsyvegfeywzqbqljlij.supabase.co';
const DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3l2ZWdmZXl3enFicWxqbGlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzQ2OCwiZXhwIjoyMDkzNTQ5NDY4fQ.T1NtIugkuxcX0sLcw3LVDavJHLhdXzjwR4FO2oDiEio';

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
