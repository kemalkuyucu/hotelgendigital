// Barboon (Protel) rezervasyon motorundan canli oda + fiyat + gorsel ceker.
// Rez sitesi olan oteller icin. Giris/sifre yok, tek POST + tek GET.

type BarboonRoom = {
  code: string;
  name: string;
  totalPrice: number;
  nightlyFirst: number;
  currency: string;
  rateName: string;
  availableRooms: number;
  images: string[];
};

type BarboonResult = { ok: true; rooms: BarboonRoom[] } | { ok: false; error: string };

// Katalog (oda kodu -> gorsel listesi) ilk sayfadan gelir; fiyat POST'tan gelir.
async function fetchCatalogImages(ibeDomain: string): Promise<Record<string, string[]>> {
  const res = await fetch(`https://${ibeDomain}/`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await res.text();
  const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  const out: Record<string, string[]> = {};
  if (!m) return out;
  try {
    const state = JSON.parse(m[1]);
    const payloads =
      state?.domain?.property?.roomTypePayloads ||
      state?.__propertySettingsData?.roomTypePayloads ||
      {};
    for (const key of Object.keys(payloads)) {
      const p = payloads[key];
      const code: string | undefined = p?.roomType?.code;
      const imgs: string[] = (p?.multimedia?.imageList || [])
        .map((i: any) => i?.imageUrl)
        .filter(Boolean);
      if (code) out[code] = imgs;
    }
  } catch {
    return out;
  }
  return out;
}

export async function fetchBarboonLive(params: {
  ibeDomain: string;
  hotelId: string;
  begin: string; // "2026-08-01"
  end: string;   // "2026-08-04"
  adultCount: number;
  childCount?: number;
  currency?: string;
  language?: string;
}): Promise<BarboonResult> {
  const {
    ibeDomain,
    hotelId,
    begin,
    end,
    adultCount,
    childCount = 0,
    currency = "TRY",
    language = "TR",
  } = params;

  try {
    const body = {
      period: { begin, end },
      hotelId,
      roomOccupancies: [{ adultCount, childCount }],
      currency,
      viewCurrency: currency,
      language,
      promoCodes: [],
      rateTypes: [],
      roomTypes: [],
    };

    const priceRes = await fetch(`https://${ibeDomain}/api/search/single`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `https://${ibeDomain}`,
        Referer: `https://${ibeDomain}/`,
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify(body),
    });

    if (!priceRes.ok) {
      return { ok: false, error: `price HTTP ${priceRes.status}` };
    }

    const json: any = await priceRes.json();
    const options: any[] = json?.data?.roomList?.[0]?.accommodationOptionList || [];
    const images = await fetchCatalogImages(ibeDomain);

    const rooms: BarboonRoom[] = options.map((opt) => {
      const rt = opt?.roomType || {};
      const code: string = rt?.code || "";
      const name: string =
        rt?.names?.descriptions?.TR ||
        rt?.names?.descriptions?.EN ||
        rt?.names?.description ||
        code;
      const rate = opt?.rateOptionList?.[0] || {};
      const daily = rate?.dailyPrices || {};
      const firstKey = Object.keys(daily)[0];
      const nightlyFirst = firstKey ? Number(daily[firstKey]?.totalPrice || 0) : 0;
      return {
        code,
        name,
        totalPrice: Number(rate?.price || 0),
        nightlyFirst,
        currency: rate?.currency || currency,
        rateName:
          rate?.rateType?.names?.descriptions?.TR ||
          rate?.rateType?.names?.description ||
          "",
        availableRooms: Number(opt?.availableRoomCount || 0),
        images: images[code] || [],
      };
    });

    return { ok: true, rooms };
  } catch (e: any) {
    return { ok: false, error: e?.message || "unknown error" };
  }
}
