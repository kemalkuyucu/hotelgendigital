/**
 * seed-department-users.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Modül 12.9 — 7 departman seed kullanıcısı oluştur
 *
 * Tablo   : hotel_admin_users  (Demo Hotel Supabase)
 * Hash    : bcryptjs.hash(password, 12)
 * Çalıştır: npm run seed-departments
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * hotel_admin_users.role enum (20260510_001_admin_users_staff.sql):
 *   'hotel_owner' | 'front_office_manager' | 'housekeeping_manager' |
 *   'technical_manager' | 'fb_manager' | 'guest_relation_manager' |
 *   'spa_manager' | 'animation_manager'
 *
 * Login akışı: /api/hotel-admin/login → hotel_admin_users tablosunu sorgular
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import ws from 'ws';

// .env.local yükle
config({ path: '.env.local' });

const SUPABASE_URL = process.env.DEMO_HOTEL_SUPABASE_URL;
const SUPABASE_KEY = process.env.DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ DEMO_HOTEL_SUPABASE_URL veya DEMO_HOTEL_SUPABASE_SERVICE_ROLE_KEY .env.local içinde eksik!'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Seed listesi ─────────────────────────────────────────────────────────────
// role değerleri hotel_admin_users.role CHECK constraint ile eşleşmeli

const SEED_USERS = [
  {
    username: 'fo_user',
    password: '1234',
    full_name: 'Ön Büro Kullanıcısı',
    role: 'front_office_manager',
  },
  {
    username: 'fb_user',
    password: '1234',
    full_name: 'Yiyecek & İçecek Kullanıcısı',
    role: 'fb_manager',
  },
  {
    username: 'hk_user',
    password: '1234',
    full_name: 'Kat Hizmetleri Kullanıcısı',
    role: 'housekeeping_manager',
  },
  {
    username: 'gr_user',
    password: '1234',
    full_name: 'Misafir İlişkileri Kullanıcısı',
    role: 'guest_relation_manager',
  },
  {
    username: 'ts_user',
    password: '1234',
    full_name: 'Teknik Servis Kullanıcısı',
    role: 'technical_manager',
  },
  {
    username: 'spa_user',
    password: '1234',
    full_name: 'SPA Kullanıcısı',
    role: 'spa_manager',
  },
  {
    username: 'anim_user',
    password: '1234',
    full_name: 'Animasyon Kullanıcısı',
    role: 'animation_manager',
  },
];

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 HotelGen — Demo Hotel Departman Seed\n');

  let created = 0;
  let skipped = 0;

  for (const seedUser of SEED_USERS) {
    // Önce var mı kontrol et
    const { data: existing } = await supabase
      .from('hotel_admin_users')
      .select('id')
      .eq('username', seedUser.username)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️  ${seedUser.username} zaten var, atlandı`);
      skipped++;
      continue;
    }

    // Hash üret (saltRounds=12, src/lib/auth/password.ts ile aynı)
    const passwordHash = await bcrypt.hash(seedUser.password, 12);

    const { error } = await supabase.from('hotel_admin_users').insert({
      username: seedUser.username,
      password_hash: passwordHash,
      full_name: seedUser.full_name,
      role: seedUser.role,
      is_active: true,
    });

    if (error) {
      if (error.code === '23505') {
        console.log(`⚠️  ${seedUser.username} zaten var, atlandı`);
        skipped++;
      } else {
        console.error(`❌ ${seedUser.username} oluşturulurken hata: ${error.message}`);
        // Devam et, diğer kullanıcıları işle
      }
    } else {
      console.log(`✅ ${seedUser.username} oluşturuldu`);
      created++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Toplam: ${created} yeni, ${skipped} atlandı`);
  console.log(`─────────────────────────────────────\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err);
  process.exit(1);
});
