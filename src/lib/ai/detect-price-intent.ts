// Misafirin mesaji ODA/FIYAT/MUSAITLIK/REZERVASYON niyeti tasiyor mu?
// Sadece evet/hayir doner. Ucuz model. Yanlis tetiklenmeyi azaltmak icin AI kullanir.
// Not: Bu forward kararini DEGISTIRMEZ; sadece "canli fiyat araci devreye girsin mi" kapisidir.

import { callAI } from './anthropic-client';

export async function detectPriceIntent(params: {
  message: string;
  history?: string;
}): Promise<boolean> {
  const { message, history = '' } = params;

  const system =
    'Bir otel mesajlasma asistanisin. Gorevin: kullanicinin SON mesaji, KONAKLAMA icin ODA FIYATI, ' +
    'MUSAITLIK, oda cesitleri/kategorileri veya REZERVASYON YAPMA niyeti tasiyor mu? ' +
    'Ornek EVET: "odalar kaca", "temmuzda fiyat nedir", "musait oda var mi", "aile odasi ne kadar", ' +
    '"rezervasyon yaptirmak istiyorum", "hangi oda tipleri var". ' +
    'Ornek HAYIR: "odam soguk", "oda servisi nerede", "havlu istiyorum", "kahvalti saati", "wifi sifresi", ' +
    '"spa var mi" (bu fiyat/oda degil, tesis sorusu). ' +
    'Tesis/hizmet/sikayet/genel bilgi sorulari HAYIR. Sadece konaklama oda-fiyat-musaitlik-rezervasyon EVET. ' +
    'CIKTI: yalniz tek kelime, buyuk harf: EVET veya HAYIR. Baska hicbir sey yazma.';

  const userMsg =
    (history ? 'Onceki konusma (baglam icin):\n' + history + '\n\n' : '') +
    'Kullanicinin son mesaji:\n' + message;

  try {
    const res = await callAI({
      tier: 'standard',
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 5,
      temperature: 0,
    });
    const t = (res.text || '').trim().toUpperCase();
    return t.startsWith('EVET');
  } catch {
    // AI hatasi -> kapiyi ACMA (guvenli taraf: eski akis calissin)
    return false;
  }
}
