# Tenant Migrations

Versiyonlu, idempotent SQL dosyaları. Her tenant (otel) Supabase DB'sine
sırayla uygulanır.

## Dosya Adlandırma
`NNN_description.sql` (NNN = 3 haneli, 001'den başlar)
Örnek: `005_add_module17_inhouse.sql`

## Kurallar
1. Her dosya idempotent olmalı (yeniden çalıştırmak güvenli)
2. Eski dosyaları ASLA değiştirme — yeni dosya ekle
3. DROP veya destructive op içeren dosya ayrı review gerektirir
4. Her dosya BEGIN/COMMIT içinde olmalı
5. Test: Boş bir Supabase'de tüm dosyaları sırayla çalıştır, sonra 2. kez çalıştır.
   Hata vermemeli.
