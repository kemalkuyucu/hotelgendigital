-- ============================================================================
-- Modül 10: In-house Misafir Doğrulama
-- Demo Hotel Supabase projesinde SQL editor'ünde çalıştırılacak.
-- ============================================================================

-- 1) inhouse_guests tablosu
CREATE TABLE IF NOT EXISTS inhouse_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (
    COALESCE(first_name || ' ', '') || last_name
  ) STORED,
  phone TEXT,
  email TEXT,
  language TEXT DEFAULT 'tr',
  package TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','checked_out','cancelled')),
  notes TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aktif misafir lookup'ı için index
CREATE INDEX IF NOT EXISTS idx_inhouse_active_room
  ON inhouse_guests(room_no, lower(last_name))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_inhouse_dates
  ON inhouse_guests(check_in_date, check_out_date);

-- 2) conversations tablosuna doğrulama state kolonları
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS verified_inhouse_guest_id UUID REFERENCES inhouse_guests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_pending_intent TEXT,
  ADD COLUMN IF NOT EXISTS verification_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_last_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_verified
  ON conversations(verified_inhouse_guest_id)
  WHERE verified_inhouse_guest_id IS NOT NULL;

-- 3) Doğrulama log tablosu (audit + analytics)
CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  attempted_room_no TEXT,
  attempted_last_name TEXT,
  result TEXT NOT NULL CHECK (result IN ('success','no_match','expired','locked','format_error')),
  matched_guest_id UUID REFERENCES inhouse_guests(id) ON DELETE SET NULL,
  intent_at_attempt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_conv
  ON verification_attempts(conversation_id, created_at DESC);
