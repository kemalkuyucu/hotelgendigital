// POST /api/group-admin/[slug]/report
// Modül 22 Faz 3 — SLA Events Rapor Üretimi
//
// Güvenlik:
//   1. group_session cookie yoksa → 401
//   2. Cookie'deki group_slug, URL'deki slug eşleşmeli → 403
//   3. hotelIds içindeki her ID'nin bu gruba ait olup olmadığı kontrol edilir
//      (başka grubun verisini sızdırma YASAK)
//   4. Sadece SEÇ (SELECT) — hiçbir tenant verisini değiştirme
//
// Vercel Hobby: sıralı await kullanılır (waitUntil/void async YOK)

import { NextRequest, NextResponse } from 'next/server';
import { getGroupManagerFromCookie } from '@/lib/group-admin/auth';
import { getCentralSupabase } from '@/lib/supabase-client';
import { resolveTenantByHotelId } from '@/lib/hotel-admin/tenant-by-id';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

interface DepartmanSatir {
  departman: string;
  toplam: number;
  cevaplanan: number;
  escalation: number;
}

interface PersonelSatir {
  personel: string;
  cozulen_adet: number;
}

interface OtelOzet {
  toplam: number;
  cevaplanan: number;
  cevapsiz: number;
  escalation: number;
  ortalamaYanitDakika: number | null;
}

interface CevapsizAciklama {
  departman: string;
  aciklama: string | null;
}

interface OtelRapor {
  hotelId: string;
  hotelName: string;
  veriAlinabildi: boolean;
  hataDetay?: string;
  ozet: OtelOzet;
  departmanBazli: DepartmanSatir[];
  personelBazli: PersonelSatir[];
  cevapsizAciklamalar: CevapsizAciklama[];
}

interface ReportBody {
  hotelIds: string[];
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

// ---------------------------------------------------------------------------
// SLA event satırı tipi
// ---------------------------------------------------------------------------

interface SlaEventRow {
  department_code: string | null;
  forwarded_at: string | null;
  responded_at: string | null;
  escalated_at: string | null;
  final_status: string | null;
  responder_username: string | null;
  reception_response_text: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Tek otel için özet hesaplama
// ---------------------------------------------------------------------------

function hesaplaOtelOzeti(rows: SlaEventRow[]): {
  ozet: OtelOzet;
  departmanBazli: DepartmanSatir[];
  personelBazli: PersonelSatir[];
  cevapsizAciklamalar: CevapsizAciklama[];
} {
  if (rows.length === 0) {
    return {
      ozet: { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0, ortalamaYanitDakika: null },
      departmanBazli: [],
      personelBazli: [],
      cevapsizAciklamalar: [],
    };
  }

  let cevaplanan = 0;
  let cevapsiz = 0;
  let escalation = 0;
  let yanitToplamDakika = 0;
  let yanitSayisi = 0;

  const departmanMap = new Map<
    string,
    { toplam: number; cevaplanan: number; escalation: number }
  >();
  const personelMap = new Map<string, number>();
  const cevapsizAciklamalar: CevapsizAciklama[] = [];

  for (const row of rows) {
    // ---- genel sayaçlar ----
    if (row.responded_at) {
      cevaplanan++;
      // Ortalama yanıt: responded_at - forwarded_at (dakika)
      if (row.forwarded_at) {
        const diff =
          new Date(row.responded_at).getTime() - new Date(row.forwarded_at).getTime();
        if (diff >= 0) {
          yanitToplamDakika += diff / 60000;
          yanitSayisi++;
        }
      }
    }

    if (row.final_status === 'no_response') {
      cevapsiz++;
      cevapsizAciklamalar.push({
        departman: row.department_code ?? 'bilinmeyen',
        aciklama: row.reception_response_text ?? null,
      });
    }
    if (row.escalated_at) escalation++;

    // ---- departman ----
    const dept = row.department_code ?? 'bilinmeyen';
    if (!departmanMap.has(dept)) {
      departmanMap.set(dept, { toplam: 0, cevaplanan: 0, escalation: 0 });
    }
    const d = departmanMap.get(dept)!;
    d.toplam++;
    if (row.responded_at) d.cevaplanan++;
    if (row.escalated_at) d.escalation++;

    // ---- personel ----
    const personel = row.responder_username ?? null;
    if (row.responded_at) {
      // Sadece cevaplanan taleplerde personel sayılır
      const key = personel ?? '__atanmamis__';
      personelMap.set(key, (personelMap.get(key) ?? 0) + 1);
    }
  }

  const departmanBazli: DepartmanSatir[] = Array.from(departmanMap.entries()).map(
    ([departman, d]) => ({ departman, ...d })
  );

  // Personel listesi: en çok çözenden aza
  const personelBazli: PersonelSatir[] = Array.from(personelMap.entries())
    .map(([key, cozulen_adet]) => ({
      personel: key === '__atanmamis__' ? 'Atanmamış' : key,
      cozulen_adet,
    }))
    .sort((a, b) => b.cozulen_adet - a.cozulen_adet);

  return {
    ozet: {
      toplam: rows.length,
      cevaplanan,
      cevapsiz,
      escalation,
      ortalamaYanitDakika: yanitSayisi > 0 ? Math.round(yanitToplamDakika / yanitSayisi) : null,
    },
    departmanBazli,
    personelBazli,
    cevapsizAciklamalar,
  };
}

// ---------------------------------------------------------------------------
// ROUTE HANDLER
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params;

    // 1. Cookie doğrula
    const manager = await getGroupManagerFromCookie();
    if (!manager) {
      return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    // 2. Slug eşleşmeli
    if (manager.group_slug !== slug) {
      return NextResponse.json({ error: 'Bu gruba erişim yetkiniz yok.' }, { status: 403 });
    }

    // 3. Body parse
    let body: ReportBody;
    try {
      body = (await req.json()) as ReportBody;
    } catch {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const { hotelIds, startDate, endDate } = body;

    if (
      !Array.isArray(hotelIds) ||
      typeof startDate !== 'string' ||
      typeof endDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return NextResponse.json({ error: 'hotelIds, startDate ve endDate zorunludur.' }, { status: 400 });
    }

    if (hotelIds.length === 0) {
      return NextResponse.json({ rapor: [], genelToplam: { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0 } });
    }

    // 4. GÜVENLİK: Gelen hotelId'lerin HEPSİ bu gruba bağlı mı kontrol et
    const db = getCentralSupabase();
    const { data: linkRows, error: linkErr } = await db
      .from('group_hotel_links')
      .select('hotel_id')
      .eq('group_id', manager.group_id);

    if (linkErr) {
      console.error('[group-admin/report] group_hotel_links sorgu hatası:', linkErr);
      return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 500 });
    }

    const allowedIds = new Set((linkRows ?? []).map((r) => r.hotel_id as string));

    // Sadece bu gruba bağlı olan otel ID'lerini kullan (diğerlerini sessizce atla)
    const guvenliBirlesim = hotelIds.filter((id) => allowedIds.has(id));

    if (guvenliBirlesim.length === 0) {
      return NextResponse.json({
        rapor: [],
        genelToplam: { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0 },
      });
    }

    // 5. Tarih aralığı: TR (+03:00) günü sınırları
    // startDate başlangıcı: TR 00:00 → UTC: startDate - 3 saat öncesi
    // endDate sonu: TR 23:59:59 → UTC: endDate gece yarısı + 21 saat = nextDay UTC 00:00 - 1s
    // Pratik yaklaşım: created_at >= startDate 00:00 TR  ve  < (endDate + 1 gün) 00:00 TR
    // TR offset: +03:00 → startDate'in UTC karşılığı = startDate - 3s
    const startUtc = new Date(`${startDate}T00:00:00+03:00`).toISOString();
    const endDateNextDay = new Date(
      new Date(`${endDate}T00:00:00+03:00`).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    // 6. Her otel için bridge → sla_events → hesapla (sıralı, Vercel Hobby)
    const rapor: OtelRapor[] = [];

    for (const hotelId of guvenliBirlesim) {
      try {
        // Tenant bağlantısı — mevcut bridge altyapısı
        const { hotelName, hotelSupabase } = await resolveTenantByHotelId(hotelId);

        // sla_events sorgusundan sadece ihtiyaç duyulan kolonlar
        const { data: events, error: eventsError } = await hotelSupabase
          .from('sla_events')
          .select(
            'department_code, forwarded_at, responded_at, escalated_at, final_status, responder_username, reception_response_text, created_at'
          )
          .gte('created_at', startUtc)
          .lt('created_at', endDateNextDay)
          .order('created_at', { ascending: true });

        if (eventsError) {
          console.error(`[group-admin/report] Hotel ${hotelId} sla_events hatası:`, eventsError);
          rapor.push({
            hotelId,
            hotelName,
            veriAlinabildi: false,
            hataDetay: eventsError.message,
            ozet: { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0, ortalamaYanitDakika: null },
            departmanBazli: [],
            personelBazli: [],
            cevapsizAciklamalar: [],
          });
          continue;
        }

        const { ozet, departmanBazli, personelBazli, cevapsizAciklamalar } = hesaplaOtelOzeti(
          (events ?? []) as SlaEventRow[]
        );

        rapor.push({
          hotelId,
          hotelName,
          veriAlinabildi: true,
          ozet,
          departmanBazli,
          personelBazli,
          cevapsizAciklamalar,
        });
      } catch (err) {
        // Bridge veya başka hata — bu oteli işaretle, diğerlerine devam et
        console.error(`[group-admin/report] Hotel ${hotelId} işlenirken hata:`, err);
        rapor.push({
          hotelId,
          hotelName: hotelId, // isim bilinemiyor
          veriAlinabildi: false,
          hataDetay: err instanceof Error ? err.message : 'Bilinmeyen hata',
          ozet: { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0, ortalamaYanitDakika: null },
          departmanBazli: [],
          personelBazli: [],
          cevapsizAciklamalar: [],
        });
      }
    }

    // 7. Genel toplam (tüm otellerin toplamı, sadece veriAlinabildi=true olanlar)
    const genelToplam = rapor
      .filter((r) => r.veriAlinabildi)
      .reduce(
        (acc, r) => ({
          toplam: acc.toplam + r.ozet.toplam,
          cevaplanan: acc.cevaplanan + r.ozet.cevaplanan,
          cevapsiz: acc.cevapsiz + r.ozet.cevapsiz,
          escalation: acc.escalation + r.ozet.escalation,
        }),
        { toplam: 0, cevaplanan: 0, cevapsiz: 0, escalation: 0 }
      );

    return NextResponse.json({ rapor, genelToplam });
  } catch (err) {
    console.error('[group-admin/report] Beklenmedik hata:', err);
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 });
  }
}
