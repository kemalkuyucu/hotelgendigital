// Misafir oda/fiyat sorunca calisan arac.
// Otelin rez sitesi (ibe) varsa canli fiyat ceker; yoksa devrede degil (Excel yontemi calisir).
// TUM veri otelin kendi sisteminden gelir; uydurma yok.

import { fetchBarboonLive } from './barboon-live';
import { parseStayQuery } from './parse-stay-query';

export type RoomPriceResult =
  | { status: 'not_ibe' }                       // otelde rez sitesi yok -> eski yontem
  | { status: 'need_dates'; adultCount: number; childCount: number } // tarih sor
  | { status: 'error'; message: string }
  | { status: 'ok'; reply: string };            // hazir cevap metni

function fmtMoney(n: number, cur: string): string {
  try {
    return new Intl.NumberFormat('tr-TR').format(Math.round(n)) + ' ' + cur;
  } catch {
    return String(Math.round(n)) + ' ' + cur;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTrDate(iso: string): string {
  // "2026-08-01" -> "1 Agustos 2026"
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const p = (iso || '').split('-');
  if (p.length !== 3) return iso;
  const y = p[0]; const m = parseInt(p[1], 10); const d = parseInt(p[2], 10);
  if (!m || !d) return iso;
  return `${d} ${aylar[m - 1]} ${y}`;
}

function nightsBetween(begin: string, end: string): number {
  const a = new Date(begin + 'T00:00:00');
  const b = new Date(end + 'T00:00:00');
  const d = Math.round((b.getTime() - a.getTime()) / 86400000);
  return d > 0 ? d : 1;
}

export async function handleRoomPriceQuery(params: {
  ibeType: string | null;   // caller hotels tablosundan gecirir
  ibeDomain: string | null; // caller hotels tablosundan gecirir
  hotelId: string;          // barboon icin gerekli
  message: string;
  history?: string;
  todayISO: string;
}): Promise<RoomPriceResult> {
  const { ibeType, ibeDomain, hotelId, message, history = '', todayISO } = params;

  // 1) Otelin rez sitesi yoksa -> eski (Excel) yontem calissin
  if (!ibeType || !ibeDomain) {
    return { status: 'not_ibe' };
  }

  // 2) Tarih + kisi cikar
  const stay = await parseStayQuery({ message, history, todayISO });
  if (stay.needsDates || !stay.begin || !stay.end) {
    return { status: 'need_dates', adultCount: stay.adultCount, childCount: stay.childCount };
  }

  // 3) Canli cek (su an yalniz barboon destekli)
  if (ibeType !== 'barboon') {
    return { status: 'not_ibe' };
  }

  const res = await fetchBarboonLive({
    ibeDomain,
    hotelId,
    begin: stay.begin,
    end: stay.end,
    adultCount: stay.adultCount,
    childCount: stay.childCount,
  });

  if (!res.ok) {
    return { status: 'error', message: res.error };
  }

  const rooms = res.rooms.filter((r) => r.totalPrice > 0).sort((a, b) => a.totalPrice - b.totalPrice);
  const nights = nightsBetween(stay.begin, stay.end);

  if (rooms.length === 0) {
    return {
      status: 'ok',
      reply:
        formatTrDate(stay.begin) + ' – ' + formatTrDate(stay.end) + ' tarihleri için seçtiğiniz kişi sayısına uygun müsait oda bulunamadı. ' +
        'Farklı tarih veya kişi sayısı ile tekrar deneyebilirsiniz.',
    };
  }

  // Rezervasyon linki (tarih + kisi dolu) - o odalarin sonuc sayfasi
  const roomCount = 1;
  const bookingUrl =
    `https://${ibeDomain}/search-result?adultCount=${stay.adultCount}` +
    `&adultCountRoom1=${stay.adultCount}` +
    `&checkIn=${stay.begin}&checkOut=${stay.end}` +
    `&childCount=${stay.childCount}&childCountRoom1=${stay.childCount}` +
    `&currency=TRY&language=TR&roomCount=${roomCount}`;

  const kisiStr =
    `${stay.adultCount} yetişkin` + (stay.childCount > 0 ? ` ${stay.childCount} çocuk` : '');

  const header =
    `🏨 <b>${formatTrDate(stay.begin)} – ${formatTrDate(stay.end)}</b>\n` +
    `👥 ${kisiStr}  ·  🌙 ${nights} gece\n` +
    `━━━━━━━━━━━━━━━━━━━`;

  const MAX_ROOMS = 4; // genel fiyat sorusunda en ucuz kac oda gosterilsin
  const shownRooms = rooms.slice(0, MAX_ROOMS);
  const remainingCount = rooms.length - shownRooms.length;

  const roomLines = shownRooms
    .map((r) => {
      const parts: string[] = [`💰 ${fmtMoney(r.totalPrice, r.currency)}`];
      if (r.squareMeter > 0) parts.push(`📐 ${r.squareMeter} m²`);
      if (r.maxPax > 0) parts.push(`👥 ${r.maxPax} kişi`);
      return `🛏 <b>${escapeHtml(r.name)}</b>\n${parts.join(' · ')}`;
    })
    .join('\n\n');

  const linkTail =
    remainingCount > 0
      ? `${remainingCount} kategori daha, görseller ve detaylar burada.`
      : `görseller ve detaylar burada.`;

  const footer =
    `━━━━━━━━━━━━━━━━━━━\n` +
    `ℹ️ Fiyatlar ${nights} gecelik toplam, yarım pansiyon dahildir.\n\n` +
    `🔗 <a href="${escapeHtml(bookingUrl)}">Rezervasyon Sayfası</a> — ${linkTail}`;

  const reply = `${header}\n\n${roomLines}\n\n${footer}`;

  return { status: 'ok', reply };
}

export type RoomDetailResult =
  | { status: 'not_ibe' }
  | { status: 'need_dates' }
  | { status: 'error'; message: string }
  | { status: 'ok'; reply: string; images: string[]; roomName: string };

export async function handleRoomDetailQuery(params: {
  ibeType: string | null;
  ibeDomain: string | null;
  hotelId: string;
  roomCode: string;      // hangi oda (detect-room-detail-intent'ten)
  begin: string | null;  // tarih varsa
  end: string | null;
  adultCount: number;
  childCount: number;
}): Promise<RoomDetailResult> {
  const { ibeType, ibeDomain, hotelId, roomCode, begin, end, adultCount, childCount } = params;

  if (!ibeType || !ibeDomain) return { status: 'not_ibe' };
  if (ibeType !== 'barboon') return { status: 'not_ibe' };
  if (!begin || !end) return { status: 'need_dates' };

  // Canli cek (o odanin gercek ozelliklerini almak icin)
  const res = await fetchBarboonLive({
    ibeDomain,
    hotelId,
    begin,
    end,
    adultCount,
    childCount,
  });

  if (!res.ok) return { status: 'error', message: res.error };

  const room = res.rooms.find((r) => r.code === roomCode);
  if (!room) {
    // Oda o tarihte musait degil -> genel rez sayfasina nazikce yonlendir
    const genelUrl =
      `https://${ibeDomain}/search-result?adultCount=${adultCount}` +
      `&adultCountRoom1=${adultCount}` +
      `&checkIn=${begin}&checkOut=${end}` +
      `&childCount=${childCount}&childCountRoom1=${childCount}` +
      `&currency=TRY&language=TR&roomCount=1`;
    return {
      status: 'ok',
      reply:
        `Seçtiğiniz tarihlerde bu oda için güncel bilgiyi aşağıdaki sayfamızdan inceleyebilirsiniz.\n\n` +
        `🔗 <a href="${escapeHtml(genelUrl)}">Rezervasyon Sayfası</a> — tüm oda kategorileri, görseller ve detaylar burada.\n\n` +
        `ℹ️ Rezervasyon ve ödeme işlemleri otelin kendi sayfası üzerinden yapılır.`,
      images: [],
      roomName: '',
    };
  }

  // Oda-detay linki (o odaya ozel, room1=KOD)
  const detailUrl =
    `https://${ibeDomain}/room-detail?adultCount=${adultCount}` +
    `&adultCountRoom1=${adultCount}` +
    `&checkIn=${begin}&checkOut=${end}` +
    `&childCount=${childCount}&childCountRoom1=${childCount}` +
    `&currency=TRY&language=TR&room1=${roomCode}&roomCount=1`;

  // Ozet ozellikler (siteden gelen gercek veriler)
  const capLine =
    room.maxPax > 0
      ? `👥 En fazla ${room.maxPax} kişi` +
        (room.maxAdult > 0 ? ` (${room.maxAdult} yetişkin` + (room.maxChild > 0 ? `, ${room.maxChild} çocuk` : '') + ')' : '')
      : '';

  const sizeLine = room.squareMeter > 0 ? `📐 ${room.squareMeter} m²` : '';

  // Olanaklar: ilk 12 tanesini virgulle (cok uzamasin)
  const facLine =
    room.facilities && room.facilities.length > 0
      ? `✨ ${escapeHtml(room.facilities.slice(0, 12).join(', '))}`
      : '';

  const descLine = room.description ? escapeHtml(room.description) : '';

  const partsArr: string[] = [];
  if (sizeLine) partsArr.push(sizeLine);
  if (capLine) partsArr.push(capLine);
  if (descLine) partsArr.push('📝 ' + descLine);
  if (facLine) partsArr.push(facLine);

  const reply =
    `🛏 <b>${escapeHtml(room.name)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    partsArr.join('\n') +
    `\n\n🔗 <a href="${escapeHtml(detailUrl)}">Oda Detayı ve Görseller</a> — fotoğraflar ve tüm detaylar burada.` +
    `\n\nℹ️ Rezervasyon ve ödeme işlemleri otelin kendi sayfası üzerinden yapılır.`;

  console.error(`[DIAG-detail] roomCode=${roomCode} roomName=${room.name} imageCount=${(room.images?.length ?? -1)} first=${room.images?.[0] || 'YOK'}`);
  return { status: 'ok', reply, images: room.images || [], roomName: room.name };
}
