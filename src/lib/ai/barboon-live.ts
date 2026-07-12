// Barboon (Protel) rezervasyon motorundan canli oda + fiyat + gorsel + ozellik ceker.
// Rez sitesi olan oteller icin. Giris/sifre yok, tek POST + tek GET.
// TUM veri otelin kendi sisteminden gelir; hicbir bilgi uydurulmaz.

type BarboonRoom = {
  code: string;
  name: string;
  description: string; // otelin kendi metni (TR)
  squareMeter: number;
  maxAdult: number;
  maxChild: number;
  maxPax: number;
  facilities: string[]; // yatak, balkon, manzara vb. - siteden
  totalPrice: number;
  nightlyFirst: number;
  currency: string;
  rateName: string;
  availableRooms: number;
  images: string[];
};

type CatalogEntry = {
  images: string[];
  description: string;
  squareMeter: number;
  maxAdult: number;
  maxChild: number;
  maxPax: number;
  facilities: string[];
};

type BarboonResult = { ok: true; rooms: BarboonRoom[] } | { ok: false; error: string };

async function fetchCatalog(
  ibeDomain: string,
): Promise<{ entries: Record<string, CatalogEntry>; hotelId: string | null }> {
  let foundHotelId: string | null = null;
  const res = await fetch(`https://${ibeDomain}/`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await res.text();
  const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  const out: Record<string, CatalogEntry> = {};
  if (!m) return { entries: {}, hotelId: null };
  try {
    const state = JSON.parse(m[1]);
    foundHotelId =
      state?.domain?.property?.hotelId ||
      state?.domain?.property?.hotel?.id ||
      state?.domain?.property?.id ||
      state?.__propertySettingsData?.hotelId ||
      state?.__propertySettingsData?.hotel?.id ||
      null;
    const payloads =
      state?.domain?.property?.roomTypePayloads ||
      state?.__propertySettingsData?.roomTypePayloads ||
      {};
    for (const key of Object.keys(payloads)) {
      const p = payloads[key];
      const code: string | undefined = p?.roomType?.code;
      if (!code) continue;
      const fs = p?.factsheet || {};
      const occ = p?.roomType?.roomOccupancy || {};
      const facilities: string[] = (fs?.roomFacilityList || [])
        .map((f: any) => f?.name)
        .filter(Boolean);
      out[code] = {
        images: (p?.multimedia?.imageList || [])
          .map((i: any) => i?.imageUrl)
          .filter(Boolean),
        description:
          fs?.descriptions?.TR || fs?.descriptions?.EN || fs?.description || "",
        squareMeter: Number(fs?.squareMeter || 0),
        maxAdult: Number(occ?.maxAdult || 0),
        maxChild: Number(occ?.maxChild || 0),
        maxPax: Number(occ?.maxPax || 0),
        facilities,
      };
      console.error(`[DIAG-catalog] code=${code} imageCount=${out[code].images.length} firstUrl=${out[code].images[0] || 'YOK'}`);
    }
  } catch {
    return { entries: out, hotelId: foundHotelId };
  }
  return { entries: out, hotelId: foundHotelId };
}

export async function fetchBarboonLive(params: {
  ibeDomain: string;
  hotelId: string;
  begin: string;
  end: string;
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
    // hotelId POST body'sinde lazim -> katalogu (ve site hotelId'sini) once cek.
    const catalog = await fetchCatalog(ibeDomain);
    const effectiveHotelId = (hotelId && hotelId.trim()) ? hotelId : (catalog.hotelId || '');
    if (!effectiveHotelId) {
      return { ok: false, error: 'hotelId bulunamadi (ne parametre ne site)' };
    }

    const body = {
      period: { begin, end },
      hotelId: effectiveHotelId,
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
    const options: any[] =
      json?.data?.roomList?.[0]?.accommodationOptionList || [];

    const empty: CatalogEntry = {
      images: [],
      description: "",
      squareMeter: 0,
      maxAdult: 0,
      maxChild: 0,
      maxPax: 0,
      facilities: [],
    };

    const rooms: BarboonRoom[] = options.map((opt) => {
      const rt = opt?.roomType || {};
      const code: string = rt?.code || "";
      const cat = catalog.entries[code] || empty;
      const name: string =
        rt?.names?.descriptions?.TR ||
        rt?.names?.descriptions?.EN ||
        rt?.names?.description ||
        code;
      const rate = opt?.rateOptionList?.[0] || {};
      const daily = rate?.dailyPrices || {};
      const firstKey = Object.keys(daily)[0];
      const nightlyFirst = firstKey ? Number(daily[firstKey]?.totalPrice || 0) : 0;
      console.error(`[DIAG-live] room=${code || 'NOCODE'} imagesFromCat=${(cat?.images?.length ?? -1)}`);
      return {
        code,
        name,
        description: cat.description,
        squareMeter: cat.squareMeter,
        maxAdult: cat.maxAdult,
        maxChild: cat.maxChild,
        maxPax: cat.maxPax,
        facilities: cat.facilities,
        totalPrice: Number(rate?.price || 0),
        nightlyFirst,
        currency: rate?.currency || currency,
        rateName:
          rate?.rateType?.names?.descriptions?.TR ||
          rate?.rateType?.names?.description ||
          "",
        availableRooms: Number(opt?.availableRoomCount || 0),
        images: cat.images,
      };
    });

    return { ok: true, rooms };
  } catch (e: any) {
    return { ok: false, error: e?.message || "unknown error" };
  }
}
