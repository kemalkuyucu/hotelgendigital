import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => { const lines = env.split('\n'); for (const line of lines) { if (line.startsWith(key + '=')) return line.slice(key.length + 1).replace(/^["']|["']\s*$/g, '').trim(); } return null; };
const url = getEnv('DEMO_HOTEL_SUPABASE_URL');
const svcKey = getEnv('DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY');
const res = await fetch(`${url}/rest/v1/telegram_send_failures?limit=0`, { headers: { 'apikey': svcKey, 'Authorization': `Bearer ${svcKey}` } });
console.log('telegram_send_failures status:', res.status);
