// Misafir belirli bir oda hakkinda DETAY/OZELLIK/FOTOGRAF/KAPASITE mi soruyor?
// Ornek: "Villa ozellikleri", "Deluxe Corner kac m2", "aile odasi fotograflari",
//        "ailecek sigar miyiz", "bu odanin gorselleri var mi".
// Fiyat sorusundan FARKLI: fiyat = ne kadar; bu = oda nasil/ozellikleri/gorseli.
// Doner: detay sorusu mu (bool) + hangi oda (kod veya null).
// Uydurma yok: emin degilse roomCode null birakir.

import { callAI } from './anthropic-client';

export type RoomDetailIntent = {
  isDetailQuery: boolean;
  roomCode: string | null; // orn "DDBM", "VILA" - odalardan biri; belirsizse null
};

export async function detectRoomDetailIntent(params: {
  message: string;
  history?: string;
  // mevcut odalar: kod + ad listesi (canli cekilenden) - AI dogru eslesme yapsin
  rooms?: Array<{ code: string; name: string }>;
}): Promise<RoomDetailIntent> {
  const { message, history = '', rooms = [] } = params;

  const roomList = rooms.length > 0
    ? rooms.map((r) => `${r.code} = ${r.name}`).join('\n')
    : '(oda listesi henuz yok - sadece detay sorusu olup olmadigini belirle, roomCode null birak)';

  const system =
    'Bir otel asistanisin. Kullanicinin SON mesaji, belirli bir ODA hakkinda DETAY sorusu mu? ' +
    'Detay = oda ozellikleri, metrekare/buyukluk, yatak sayisi, kapasite ("kac kisi", "ailecek sigar miyiz"), ' +
    'olanaklar, veya FOTOGRAF/GORSEL istegi. ' +
    'Bu, FIYAT sorusundan farklidir (fiyat = "ne kadar", "kac para"). Fiyat sorusuysa isDetailQuery=false. ' +
    'Mevcut odalar (kod = ad):\n' + roomList + '\n' +
    'Kullanicinin bahsettigi odayi bu listeden esle ve KODUNU ver. ' +
    'Oda adi tam gecmese de anlamdan esle (orn "aile odasi" -> FAMN veya JFM gibi; "villa" -> VILA; "kral dairesi/suit" -> KING). ' +
    'Birden fazla odaya uyuyorsa veya hangi oda belirsizse roomCode=null. Oda belirtmeden genel detay sorusuysa roomCode=null. ' +
    'CIKTI: yalniz gecerli JSON, baska hicbir sey: {"isDetailQuery":true,"roomCode":"VILA"} veya {"isDetailQuery":false,"roomCode":null}';

  const userMsg =
    (history ? 'Onceki konusma:\n' + history + '\n\n' : '') +
    'Kullanicinin son mesaji:\n' + message;

  try {
    const res = await callAI({
      tier: 'standard',
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 40,
      temperature: 0,
      jsonMode: true,
    });
    let raw = (res.text || '').trim();
    raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw);
    const isDetailQuery = parsed?.isDetailQuery === true;
    let roomCode: string | null =
      typeof parsed?.roomCode === 'string' && parsed.roomCode ? parsed.roomCode : null;
    // roomCode gercekten listede var mi? yoksa null'a cek (uydurma engeli)
    if (roomCode && !rooms.some((r) => r.code === roomCode)) {
      roomCode = null;
    }
    return { isDetailQuery, roomCode };
  } catch {
    return { isDetailQuery: false, roomCode: null };
  }
}
