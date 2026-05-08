/**
 * Seed script: Demo Hotel için 12 fact + 2 section yükler.
 * Çalıştırma: npm run seed:demo-knowledge
 *
 * Gerekli env: DEMO_HOTEL_SUPABASE_URL, DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DEMO_HOTEL_ID = '11840871-1bf3-450f-91bf-0820b82e5416';

const url = process.env.DEMO_HOTEL_SUPABASE_URL;
const key = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('HATA: DEMO_HOTEL_SUPABASE_URL ve DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

const seedFacts = [
  { fact_key: 'pool_open_time',             fact_value: '09:00',            fact_label: 'Havuz Açılış Saati',       category: 'pool' },
  { fact_key: 'pool_close_time',            fact_value: '19:00',            fact_label: 'Havuz Kapanış Saati',      category: 'pool' },
  { fact_key: 'restaurant_breakfast_start', fact_value: '07:00',            fact_label: 'Kahvaltı Başlangıç',       category: 'restaurant' },
  { fact_key: 'restaurant_breakfast_end',   fact_value: '10:30',            fact_label: 'Kahvaltı Bitiş',           category: 'restaurant' },
  { fact_key: 'restaurant_dinner_start',    fact_value: '19:00',            fact_label: 'Akşam Yemeği Başlangıç',   category: 'restaurant' },
  { fact_key: 'restaurant_dinner_end',      fact_value: '22:00',            fact_label: 'Akşam Yemeği Bitiş',       category: 'restaurant' },
  { fact_key: 'check_in_time',              fact_value: '14:00',            fact_label: 'Check-in Saati',           category: 'rooms' },
  { fact_key: 'check_out_time',             fact_value: '12:00',            fact_label: 'Check-out Saati',          category: 'rooms' },
  { fact_key: 'wifi_ssid',                  fact_value: 'DemoHotelGuest',   fact_label: 'Wi-Fi Ağ Adı',             category: 'wifi' },
  { fact_key: 'wifi_password',              fact_value: 'misafir2026',      fact_label: 'Wi-Fi Şifresi',            category: 'wifi' },
  { fact_key: 'spa_open_time',              fact_value: '10:00',            fact_label: 'Spa Açılış',               category: 'spa' },
  { fact_key: 'spa_close_time',             fact_value: '20:00',            fact_label: 'Spa Kapanış',              category: 'spa' },
] as const;

const seedSections = [
  {
    title: 'Otelimiz Hakkında',
    content: 'Demo Hotel, Antalya kıyısında 5 yıldızlı bir tatil köyüdür. 250 oda, 4 restoran, 3 havuz ve özel plaj imkânı sunmaktadır.',
    category: 'general',
    display_order: 0,
  },
  {
    title: 'Evcil Hayvan Politikası',
    content: 'Otelimizde evcil hayvan kabul edilmemektedir.',
    category: 'rules',
    display_order: 1,
  },
];

async function seed() {
  console.log(`[seed] Demo Hotel ID: ${DEMO_HOTEL_ID}`);

  // ── Facts ────────────────────────────────────────────────────────────────────
  console.log('[seed] hotel_facts yükleniyor...');
  for (const fact of seedFacts) {
    const { error } = await supa
      .from('hotel_facts')
      .upsert(
        { ...fact, is_active: true, display_order: 0, updated_at: new Date().toISOString() },
        { onConflict: 'fact_key', ignoreDuplicates: false }
      );
    if (error) {
      console.error(`  ❌ ${fact.fact_key}: ${error.message}`);
    } else {
      console.log(`  ✅ ${fact.fact_key}`);
    }
  }

  // ── Sections ─────────────────────────────────────────────────────────────────
  console.log('[seed] knowledge_sections yükleniyor...');
  for (const section of seedSections) {
    // Aynı başlık varsa tekrar ekleme
    const { data: existing } = await supa
      .from('knowledge_sections')
      .select('id')
      .eq('title', section.title)
      .maybeSingle();

    if (existing) {
      console.log(`  ⏩ "${section.title}" — zaten mevcut, atlanıyor`);
      continue;
    }

    const { error } = await supa
      .from('knowledge_sections')
      .insert({ ...section, is_active: true });

    if (error) {
      console.error(`  ❌ "${section.title}": ${error.message}`);
    } else {
      console.log(`  ✅ "${section.title}"`);
    }
  }

  // ── Doğrulama ─────────────────────────────────────────────────────────────────
  const [{ count: factCount }, { count: sectionCount }] = await Promise.all([
    supa.from('hotel_facts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supa.from('knowledge_sections').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  console.log(`\n[seed] Sonuç: ${factCount} fact, ${sectionCount} section`);
  if ((factCount ?? 0) >= 12 && (sectionCount ?? 0) >= 2) {
    console.log('[seed] ✅ Başarılı');
  } else {
    console.error('[seed] ❌ Beklenen sayıya ulaşılamadı!');
    process.exit(1);
  }
}

seed().catch((err) => {
  console.error('[seed] Beklenmeyen hata:', err);
  process.exit(1);
});
