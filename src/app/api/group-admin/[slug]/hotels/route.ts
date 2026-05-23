// GET /api/group-admin/[slug]/hotels
// Modül 22 Faz 2 — Gruba bağlı aktif otelleri listeler
//
// Güvenlik:
//   1. group_session cookie yoksa → 401
//   2. Cookie'deki group_slug, URL'deki slug ile eşleşmeli → 403
//   3. Sadece Central DB okunur, hotel DB'lerine bağlanılmaz
//   4. Sadece status='active' oteller döner

import { NextRequest, NextResponse } from 'next/server';
import { getGroupManagerFromCookie } from '@/lib/group-admin/auth';
import { getCentralSupabase } from '@/lib/supabase-client';

export interface GroupHotel {
  id: string;
  name: string;
  slug: string;
  package_tier: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params;

    // 1. Cookie doğrula
    const manager = await getGroupManagerFromCookie();
    if (!manager) {
      return NextResponse.json(
        { hotels: [], error: 'Oturum bulunamadı.' },
        { status: 401 }
      );
    }

    // 2. Slug eşleşmeli — başka grubun verisi görülemesin
    if (manager.group_slug !== slug) {
      return NextResponse.json(
        { hotels: [], error: 'Bu gruba erişim yetkiniz yok.' },
        { status: 403 }
      );
    }

    // 3. Central DB'den sorgu:
    //    group_hotel_links JOIN hotels
    //    Sadece bu gruba ait (group_id) VE status='active' olan oteller
    const db = getCentralSupabase();

    const { data, error } = await db
      .from('group_hotel_links')
      .select(`
        hotel_id,
        hotels!inner (
          id,
          name,
          slug,
          package_tier,
          status
        )
      `)
      .eq('group_id', manager.group_id)
      .eq('hotels.status', 'active');

    if (error) {
      console.error('[group-admin/hotels] DB hatası:', error.message);
      return NextResponse.json({ hotels: [] }, { status: 200 });
    }

    // Sadece gerekli alanları dön — hassas veri yok
    const hotels: GroupHotel[] = (data ?? [])
      .map((row) => {
        const hotel = Array.isArray(row.hotels) ? row.hotels[0] : row.hotels;
        if (!hotel) return null;
        return {
          id: hotel.id as string,
          name: hotel.name as string,
          slug: hotel.slug as string,
          package_tier: (hotel.package_tier as string) ?? 'basic',
        };
      })
      .filter((h): h is GroupHotel => h !== null);

    return NextResponse.json({ hotels }, { status: 200 });
  } catch (err) {
    console.error('[group-admin/hotels] Beklenmedik hata:', err);
    return NextResponse.json({ hotels: [] }, { status: 500 });
  }
}
