/**
 * create-admin.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Modül 12.9 — Admin/Manager oluşturma scripti
 *
 * Tablo   : master_admins  (Central Supabase)
 * Hash    : bcryptjs.hash(password, 12)   ← src/lib/auth/password.ts ile aynı
 * Çalıştır: npm run create-admin
 * ─────────────────────────────────────────────────────────────────────────────
 */

import readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// .env.local'den değerleri yükle
config({ path: '.env.local' });

const SUPABASE_URL = process.env.CENTRAL_SUPABASE_URL;
const SUPABASE_KEY = process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ CENTRAL_SUPABASE_URL veya CENTRAL_SUPABASE_SERVICE_ROLE_KEY .env.local içinde eksik!'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Yardımcı: readline rl oluştur ───────────────────────────────────────────

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// ─── Yardımcı: görünür soru ──────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ─── Yardımcı: gizli şifre okuma (raw mode, hiç karakter gösterme) ───────────

function askSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    const input = process.stdin;
    let password = '';

    // Windows + Node için raw mode + encoding
    if (typeof input.setRawMode === 'function') {
      input.setRawMode(true);
    }
    input.resume();
    input.setEncoding('utf8');

    function onData(ch) {
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        // Enter veya Ctrl+D
        process.stdout.write('\n');
        cleanup();
        resolve(password);
      } else if (ch === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        cleanup();
        process.exit(0);
      } else if (ch === '\u007f' || ch === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += ch;
      }
    }

    function cleanup() {
      input.removeListener('data', onData);
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(false);
      }
      input.pause();
    }

    input.on('data', onData);
  });
}

// ─── Validasyon ──────────────────────────────────────────────────────────────

function validateUsername(username) {
  if (!username || username.length < 3) return 'Kullanıcı adı en az 3 karakter olmalıdır.';
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Kullanıcı adı sadece a-z, A-Z, 0-9 ve _ içerebilir.';
  return null;
}

// ─── Ana akış ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔐 HotelGen — Admin Kullanıcı Oluşturma\n');

  // Tekrar döngüsü (şifre uyuşmazlığında baştan alır)
  while (true) {
    const rl = createRl();

    // 1) Kullanıcı adı
    let username = await ask(rl, 'Kullanıcı adı: ');
    const usernameErr = validateUsername(username);
    if (usernameErr) {
      console.error(`❌ ${usernameErr}`);
      rl.close();
      continue;
    }

    // 2) Rol seçimi
    const rolInput = await ask(rl, 'Rol seçin (1=admin, 2=super_admin): ');
    rl.close(); // readline'ı kapat, stdin'i raw mode'a geçirmeden önce

    if (rolInput !== '1' && rolInput !== '2') {
      console.error('❌ Geçersiz rol. 1 veya 2 giriniz.');
      continue;
    }

    // master_admins.role enum: 'super_admin' | 'admin' | 'support' | 'default_admin'
    const role = rolInput === '1' ? 'admin' : 'super_admin';

    // 3) Şifre (gizli)
    const password = await askSecret('Şifre: ');
    if (!password || password.length < 6) {
      console.error('❌ Şifre en az 6 karakter olmalıdır.');
      continue;
    }

    // 4) Şifre tekrar (gizli)
    const password2 = await askSecret('Şifre tekrar: ');
    if (password !== password2) {
      console.error('❌ Şifreler uyuşmuyor, tekrar deneyin.\n');
      continue;
    }

    // ─── Hash + INSERT ─────────────────────────────────────────────────────
    console.log('\n⏳ Hesap oluşturuluyor...');

    const passwordHash = await bcrypt.hash(password, 12);

    const { error } = await supabase.from('master_admins').insert({
      username,
      password_hash: passwordHash,
      full_name: username, // full_name NOT NULL, username ile doldur; sonradan güncellenir
      role,
      is_active: true,
      failed_login_attempts: 0,
    });

    if (error) {
      if (error.code === '23505') {
        console.error(`❌ Bu kullanıcı adı zaten kullanılıyor: "${username}"`);
      } else {
        console.error(`❌ Veritabanı hatası: ${error.message}`);
      }
      process.exit(1);
    }

    console.log(`\n✅ Kullanıcı oluşturuldu: ${username} (${role})\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err);
  process.exit(1);
});
