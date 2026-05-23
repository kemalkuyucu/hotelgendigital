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

    // 3. Central DB'den sorgu — İKİ ADIM:
    //    Adım 1: group_hotel_links → bu gruba ait hotel_id listesi
    //    Adım 2: hotels tablosu → bu ID'lerden status='active' olanlar
    //
    //    NOT: Supabase JS v2'de !inner join üzerinde .eq('hotels.status','active')
    //    PostgREST tarafında geçersiz bir kolon referansı oluşturur ve
    //    "Veritabanı hatası" döndürür. İki ayrı sorgu en güvenli yöntemdir.
    const db = getCentralSupabase();

    // Adım 1: Bu gruba bağlı hotel_id'lerini al
    const { data: linkRows, error: linkError } = await db
      .from('group_hotel_links')
      .select('hotel_id')
      .eq('group_id', manager.group_id);

    if (linkError) {
      console.error('[group-admin/hotels] group_hotel_links sorgu hatası:', linkError);
      return NextResponse.json({ hotels: [], error: 'Veritabanı hatası.' }, { status: 500 });
    }

    const hotelIds = (linkRows ?? []).map((r) => r.hotel_id as string);

    if (hotelIds.length === 0) {
      return NextResponse.json({ hotels: [] }, { status: 200 });
    }

    // Adım 2: Bu ID'lerden status='active' olanları çek (sadece id, name, slug)
    const { data: hotelRows, error: hotelError } = await db
      .from('hotels')
      .select('id, name, slug')
      .in('id', hotelIds)
      .eq('status', 'active');

    if (hotelError) {
      console.error('[group-admin/hotels] hotels sorgu hatası:', hotelError);
      return NextResponse.json({ hotels: [], error: 'Veritabanı hatası.' }, { status: 500 });
    }

    // Sadece gerekli alanları dön — hassas veri yok
    const hotels: GroupHotel[] = (hotelRows ?? []).map((h) => ({
      id: h.id as string,
      name: h.name as string,
      slug: h.slug as string,
    }));

    return NextResponse.json({ hotels }, { status: 200 });
  } catch (err) {
    console.error('[group-admin/hotels] Beklenmedik hata:', err);
    return NextResponse.json({ hotels: [] }, { status: 500 });
  }
}
