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
    'MUSAITLIK veya REZERVASYON YAPMA niyeti tasiyor mu? ' +
    'Ornek EVET: "odalar kaca", "temmuzda fiyat nedir", "musait oda var mi", "aile odasi ne kadar", ' +
    '"rezervasyon yaptirmak istiyorum", "fiyat listesi", "bos oda var mi". ' +
    'COK ONEMLI: Belli bir odanin OZELLIK / DETAY / M2 / FOTOGRAF / GORSEL veya "nasil bir oda" ' +
    'sorulari FIYAT DEGILDIR -> HAYIR de. Bunlar ayri bir oda-detay kapisina gider, sen ACMA. ' +
    'Ornek HAYIR (oda-detay, fiyat degil): "deluxe corner odasi nasil", "villa fotografi var mi", ' +
    '"aile odasi kac m2", "suite nasil bir oda", "odanin ozellikleri neler", "oda gorselleri var mi". ' +
    'Ornek HAYIR (tesis/hizmet): "odam soguk", "oda servisi nerede", "havlu istiyorum", "kahvalti saati", ' +
    '"wifi sifresi", "spa var mi". ' +
    'Ayirt edici kural: "ne kadar / kac para / fiyat / musait / rezervasyon" -> EVET. ' +
    '"nasil / ozellik / detay / m2 / foto / gorsel" -> HAYIR. ' +
    'CIKTI: yalniz tek kelime, buyuk harf: EVET veya HAYIR. Baska hicbir sey yazma.';

  const userMsg =
    (history ? 'Onceki konusma (baglam icin):\n' + history + '\n\n' : '') +
    'Kullanicinin son mesaji:\n' + message;

  try {
    const res = await callAI({
      tier: 'standard',
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 16,
      temperature: 0,
    });
    const t = (res.text || '').trim().toUpperCase();
    return t.startsWith('EVET');
  } catch {
    // AI hatasi -> kapiyi ACMA (guvenli taraf: eski akis calissin)
    return false;
  }
}
