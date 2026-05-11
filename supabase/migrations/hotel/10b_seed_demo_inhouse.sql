-- ============================================================================
-- Modül 10b: Demo Hotel Seed — Test Misafirleri
-- 10_inhouse_verification.sql uygulandıktan SONRA çalıştırılacak.
-- ============================================================================

INSERT INTO inhouse_guests (room_no, first_name, last_name, phone, language, package, check_in_date, check_out_date, status, notes)
VALUES
  ('215', 'Özgür', 'Özen', '+905551112233', 'tr', 'premium', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 'active', 'Test misafiri — modül 10 doğrulama'),
  ('312', 'Kemal', 'Kuyucu', '+905554445566', 'tr', 'full', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days', 'active', 'Test misafiri'),
  ('408', 'John', 'Smith', '+447700900000', 'en', 'basic', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'active', 'EN test misafiri')
ON CONFLICT DO NOTHING;
