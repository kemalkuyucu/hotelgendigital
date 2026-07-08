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
        stay.begin + ' - ' + stay.end + ' tarihleri icin sectiginiz kisi sayisina uygun musait oda bulunamadi. ' +
        'Farkli tarih veya kisi sayisi ile tekrar deneyebilirsiniz.',
    };
  }

  const kisi =
    stay.adultCount + ' yetiskin' + (stay.childCount > 0 ? ' ' + stay.childCount + ' cocuk' : '');
  const lines = rooms
    .map((r) => '- ' + r.name + ': ' + fmtMoney(r.totalPrice, r.currency) + ' (' + nights + ' gece toplam)')
    .join('\n');

  const reply =
    stay.begin + ' - ' + stay.end + ' | ' + kisi + ' icin musait odalar:\n' +
    lines +
    '\n\nFiyatlar ' + nights + ' gecelik toplam ve yarim pansiyon dahildir. ' +
    'Bir odanin detaylarini (metrekare, ozellikler) veya fotograflarini gormek ister misiniz? ' +
    'Rezervasyon icin de yardimci olabilirim.';

  return { status: 'ok', reply };
}
