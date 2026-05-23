-- =============================================================================
-- 010_group_admin_tables.sql
-- Modül 22 — Grup Yöneticisi Paneli: Faz 1 Veri Katmanı
--
-- Oluşturulan tablolar:
--   - hotel_groups       : Otel zinciri/grubu
--   - group_managers     : Gruba giriş yapan yönetici hesapları (salt-okunur)
--   - group_hotel_links  : Hangi otel hangi gruba bağlı
--
-- NOT: hotel_id, Central'daki hotels.id'ye işaret eder ama FK KONMAZ
--      (hotels soft-delete edilebiliyor, CASCADE istemeyiz).
--      Uygulama katmanında join yapılacak.
--
-- Bu dosya exec_sql RPC ile çalışır: BEGIN/COMMIT YOK, idempotent IF NOT EXISTS.
-- =============================================================================

-- hotel_groups: bir otel zinciri/grubu
CREATE TABLE IF NOT EXISTS hotel_groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- group_managers: gruba giriş yapan yönetici hesapları (salt-okunur rapor görür)
CREATE TABLE IF NOT EXISTS group_managers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID        NOT NULL REFERENCES hotel_groups(id) ON DELETE CASCADE,
  username      TEXT        NOT NULL UNIQUE,
  full_name     TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_hotel_links: hangi otel hangi gruba bağlı
CREATE TABLE IF NOT EXISTS group_hotel_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES hotel_groups(id) ON DELETE CASCADE,
  hotel_id   UUID        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, hotel_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_group_hotel_links_group ON group_hotel_links(group_id);
CREATE INDEX IF NOT EXISTS idx_group_managers_group    ON group_managers(group_id);
