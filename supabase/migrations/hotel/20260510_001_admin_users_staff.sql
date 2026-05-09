-- ===========================================================================
-- Modül 8 — Hotel Admin Users + Department Staff
-- Demo Hotel Supabase'ine uygulanır
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. hotel_admin_users — Otelin kendi yöneticileri
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hotel_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hotel_admin_users_role_check CHECK (
    role IN (
      'hotel_owner',
      'front_office_manager',
      'housekeeping_manager',
      'technical_manager',
      'fb_manager',
      'guest_relation_manager',
      'spa_manager',
      'animation_manager'
    )
  )
);

CREATE INDEX IF NOT EXISTS hotel_admin_users_username_idx ON hotel_admin_users(username);
CREATE INDEX IF NOT EXISTS hotel_admin_users_role_idx ON hotel_admin_users(role);

-- ---------------------------------------------------------------------------
-- 2. department_staff — Departman personeli + vardiya bilgisi
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS department_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_title TEXT,
  telegram_user_id TEXT,
  telegram_username TEXT,
  whatsapp_id TEXT,
  shift_start TIME,
  shift_end TIME,
  days_off TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT department_staff_department_check CHECK (
    department_key IN (
      'front_office','housekeeping','technical','fb',
      'guest_relation','spa','animation'
    )
  ),
  CONSTRAINT department_staff_days_off_check CHECK (
    days_off <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']
  )
);

CREATE INDEX IF NOT EXISTS department_staff_department_idx ON department_staff(department_key);
CREATE INDEX IF NOT EXISTS department_staff_is_active_idx ON department_staff(is_active);
CREATE INDEX IF NOT EXISTS department_staff_telegram_idx ON department_staff(telegram_user_id);

-- ---------------------------------------------------------------------------
-- 3. forwarded_messages — target_type kolonu ekle
-- ---------------------------------------------------------------------------

ALTER TABLE forwarded_messages
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'group'
  CHECK (target_type IN ('group', 'staff_dm'));

-- ---------------------------------------------------------------------------
-- 4. Seed — Demo Hotel sahibi (DemoOwner2026, bcrypt saltRounds=10)
-- ---------------------------------------------------------------------------

INSERT INTO hotel_admin_users (username, password_hash, full_name, role)
VALUES (
  'demo_owner',
  '$2b$10$2DN/PzCn.gHBV89vEnN8Lef3ZB5I6J4RPjwZuHgM5DBdxh4daiisy',
  'Demo Hotel Sahibi',
  'hotel_owner'
)
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Doğrulama sorgusu (çalıştırın, ~22 satır beklenir)
-- ---------------------------------------------------------------------------
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('hotel_admin_users','department_staff')
-- ORDER BY table_name, ordinal_position;
--
-- SELECT username, role FROM hotel_admin_users;
