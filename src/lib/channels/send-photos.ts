// Kanaldan bagimsiz fotograf gonderme katmani.
// Beyin sadece "su odanin su fotograflarini goster" der (ortak sozlesme);
// her kanal (telegram/whatsapp/instagram) kendi API'siyle gonderir.

export type PhotoChannel = 'telegram' | 'whatsapp' | 'instagram';

// Beynin urettigi ortak istek (kanaldan bagimsiz).
export type PhotoRequest = {
  roomName: string;      // "Deluxe Corner Nature View"
  imageUrls: string[];   // gonderilecek foto URL'leri (otelin kendi sisteminden)
  caption?: string;      // opsiyonel aciklama (ilk fotoya)
};

export type SendPhotosResult = { ok: true; sent: number } | { ok: false; error: string };

// Telegram: birden cok foto -> sendMediaGroup (albüm). Tek foto -> sendPhoto.
async function sendTelegramPhotos(params: {
  botToken: string;
  chatId: string | number;
  req: PhotoRequest;
}): Promise<SendPhotosResult> {
  const { botToken, chatId, req } = params;
  const urls = (req.imageUrls || []).filter(Boolean).slice(0, 10); // Telegram albüm limiti 10
  if (urls.length === 0) return { ok: false, error: 'foto yok' };

  const caption = req.caption || req.roomName;

  try {
    if (urls.length === 1) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: urls[0], caption }),
      });
      const j: any = await res.json();
      return j?.ok ? { ok: true, sent: 1 } : { ok: false, error: j?.description || 'telegram sendPhoto hata' };
    }

    const media = urls.map((u, i) => ({
      type: 'photo',
      media: u,
      ...(i === 0 ? { caption } : {}),
    }));
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, media }),
    });
    const j: any = await res.json();
    return j?.ok ? { ok: true, sent: urls.length } : { ok: false, error: j?.description || 'telegram sendMediaGroup hata' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'telegram foto gonderim hatasi' };
  }
}

// WhatsApp / Instagram: ileride baglanacak. Simdilik acik "henuz yok" doner (hicbir sey kirilmaz).
async function sendWhatsappPhotos(_p: any): Promise<SendPhotosResult> {
  return { ok: false, error: 'whatsapp foto gonderimi henuz baglanmadi' };
}
async function sendInstagramPhotos(_p: any): Promise<SendPhotosResult> {
  return { ok: false, error: 'instagram foto gonderimi henuz baglanmadi' };
}

// Kanal secici: beyin sadece bunu cagirir; dogru kanala yonlendirir.
export async function sendPhotos(params: {
  channel: PhotoChannel;
  req: PhotoRequest;
  // kanala ozel iletim bilgisi:
  telegram?: { botToken: string; chatId: string | number };
  whatsapp?: Record<string, any>;
  instagram?: Record<string, any>;
}): Promise<SendPhotosResult> {
  const { channel, req } = params;

  if (channel === 'telegram') {
    if (!params.telegram) return { ok: false, error: 'telegram bilgisi eksik' };
    return sendTelegramPhotos({ ...params.telegram, req });
  }
  if (channel === 'whatsapp') {
    return sendWhatsappPhotos({ ...params.whatsapp, req });
  }
  if (channel === 'instagram') {
    return sendInstagramPhotos({ ...params.instagram, req });
  }
  return { ok: false, error: 'bilinmeyen kanal' };
}
