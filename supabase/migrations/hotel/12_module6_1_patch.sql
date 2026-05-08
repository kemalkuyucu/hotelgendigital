-- Modül 6.1 Patch — forwarded_messages eksik kolonlar
-- is_off_hours: Mesajın mesai dışında alınıp alınmadığını gösterir.
-- source_department: AI'ın asıl sınıfladığı departman (off-hours yönlendirmesinden önce).

ALTER TABLE public.forwarded_messages
  ADD COLUMN IF NOT EXISTS is_off_hours BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.forwarded_messages
  ADD COLUMN IF NOT EXISTS source_department TEXT;

COMMENT ON COLUMN public.forwarded_messages.is_off_hours IS
  'Mesaj off-hours sürecinde mi işlendi? Off-hours yönlendirmesi tetiklendiyse TRUE.';

COMMENT ON COLUMN public.forwarded_messages.source_department IS
  'AI sınıflamasının döndürdüğü asıl departman kodu. Off-hours yönlendirmesi olsa bile orijinal sınıf burada saklanır. NULL = sınıflandırılamadı.';
