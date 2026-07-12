import { callAI } from './anthropic-client';

/**
 * Asistanin cevabini misafirin mesajinin diline zorlar.
 * Beyin prompt'lari Turkce yazili oldugu icin model yabanci misafire de Turkce
 * yanit verebiliyor; bu kapi cevabi misafirin diline cevirir.
 * Ceviri basarisiz olursa cevabi AYNEN doner (misafir akisi bozulmasin).
 * Cevap zaten misafirin dilindeyse model metni degistirmeden geri verir.
 */
export async function enforceReplyLanguage(
  guestMessage: string,
  replyText: string,
): Promise<string> {
  const clean = (replyText || '').trim();
  if (!clean) return replyText;
  const guest = (guestMessage || '').trim();
  if (!guest) return replyText;
  try {
    const res = await callAI({
      tier: 'standard',
      system:
        'Sana bir misafir mesaji ve bir asistan cevabi verilecek. Gorevin: asistanin ' +
        'cevabini, MISAFIRIN mesajinin diline cevir. Cevap zaten misafirin dilindeyse ' +
        'HICBIR SEY degistirme, aynen geri ver. Sadece cevabi yaz; aciklama, tirnak, ' +
        'on-ek ekleme. Ozel isimleri (kisi, yer, marka, oda adi, Wi-Fi, sifre) cevirme.',
      messages: [
        { role: 'user', content: `MİSAFİR MESAJI: ${guest}\n\nASİSTAN CEVABI: ${clean}` },
      ],
      maxTokens: 300,
      temperature: 0,
    });
    const out = (res.text || '').trim();
    return out || replyText;
  } catch {
    return replyText;
  }
}
