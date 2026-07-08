// Misafirin dogal dildeki mesajindan konaklama sorgusu cikarir:
// giris/cikis tarihi + yetiskin/cocuk sayisi. Tarih yoksa needsDates=true doner.
// Bugunun tarihine gore hesaplar. Uydurma yok: emin degilse tarihi bos birakir.

import { callAI } from './anthropic-client';

export type StayQuery = {
  needsDates: boolean;      // tarih anlasilamadi -> misafire sor
  begin: string | null;     // "YYYY-MM-DD" giris
  end: string | null;       // "YYYY-MM-DD" cikis
  adultCount: number;       // en az 1
  childCount: number;       // varsayilan 0
  childAges: number[];      // varsa cocuk yaslari
};

export async function parseStayQuery(params: {
  message: string;
  history?: string; // onceki konusma (opsiyonel, tarih baglami icin)
  todayISO: string; // "YYYY-MM-DD" bugun
}): Promise<StayQuery> {
  const { message, history = '', todayISO } = params;

  const system =
    'Sen bir otel rezervasyon asistanisin. Kullanicinin mesajindan konaklama tarih ve kisi bilgisini cikar. ' +
    'BUGUNUN TARIHI: ' + todayISO + '. Goreli ifadeleri buna gore hesapla ("yarin", "hafta sonu", "gelecek cumartesi", "3 gece" vb.). ' +
    'Hafta sonu = en yakin cumartesi girisi, pazar cikisi (1 gece) degilse kullanici gece sayisi verdiyse ona uy. ' +
    'Kullanici sadece giris tarihi + gece sayisi verdiyse cikis = giris + gece. ' +
    'Sadece giris tarihi verip gece demediyse 1 gece varsay. ' +
    'Tarih hic yoksa veya emin degilsen begin ve end NULL birak, needsDates true yap. TARIH UYDURMA. ' +
    'Kisi: yetiskin sayisi yoksa 2 varsay. Cocuk yoksa 0. Cocuk varsa yaslarini childAges dizisine koy (yas yoksa bos dizi). ' +
    'CIKTI: SADECE gecerli JSON, baska hicbir sey yok. Su formatta: ' +
    '{"needsDates":false,"begin":"YYYY-MM-DD","end":"YYYY-MM-DD","adultCount":2,"childCount":0,"childAges":[]}';

  const userMsg =
    (history ? 'Onceki konusma:\n' + history + '\n\n' : '') +
    'Kullanici mesaji:\n' + message;

  try {
    const res = await callAI({
      tier: 'standard',
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 200,
      temperature: 0,
    });

    let raw = (res.text || '').trim();
    raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw);

    const adultCount = Number(parsed?.adultCount) > 0 ? Number(parsed.adultCount) : 2;
    const childCount = Number(parsed?.childCount) > 0 ? Number(parsed.childCount) : 0;
    const childAges = Array.isArray(parsed?.childAges)
      ? parsed.childAges.map((n: any) => Number(n)).filter((n: number) => !isNaN(n))
      : [];
    const begin = typeof parsed?.begin === 'string' && parsed.begin ? parsed.begin : null;
    const end = typeof parsed?.end === 'string' && parsed.end ? parsed.end : null;
    const needsDates = parsed?.needsDates === true || !begin || !end;

    return { needsDates, begin, end, adultCount, childCount, childAges };
  } catch {
    return { needsDates: true, begin: null, end: null, adultCount: 2, childCount: 0, childAges: [] };
  }
}
