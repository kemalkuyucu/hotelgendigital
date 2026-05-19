// =============================================================================
// src/app/api/admin/migrations/status/route.ts
// GET /api/admin/migrations/status?hotelSlug=demo-hotel
// hotelSlug yoksa tüm otellerin durumunu döndürür.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSessionAdmin } from '@/lib/auth/session';
import { getMigrationStatus } from '@/lib/migrations';
import { getCentralSupabase } from '@/lib/supabase-client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Yetki kontrolü
  const admin = await getSessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const hotelSlug = searchParams.get('hotelSlug');

  try {
    if (hotelSlug) {
      // Tek hotel durumu
      const status = await getMigrationStatus(hotelSlug.trim());
      return NextResponse.json({ statuses: [status] });
    } else {
      // Tüm oteller — Central DB'den hotel listesi çek
      const supabase = getCentralSupabase();
      const { data: hotels, error } = await supabase
        .from('hotels')
        .select('id, slug, name, status')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Otel listesi alınamadı: ${error.message}`);
      }

      if (!hotels || hotels.length === 0) {
        return NextResponse.json({ statuses: [] });
      }

      // Paralel durum sorguları
      const statusPromises = hotels.map(async (hotel) => {
        try {
          return await getMigrationStatus(hotel.slug as string);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            hotel_slug: hotel.slug as string,
            total_available: 6,
            applied: [],
            pending: [],
            last_error: {
              version: 'N/A',
              message: `Durum alınamadı: ${message}`,
              at: new Date().toISOString(),
            },
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      return NextResponse.json({ statuses });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatası.';
    console.error('[migrations/status] Hata:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
