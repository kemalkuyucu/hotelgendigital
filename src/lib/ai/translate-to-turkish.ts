import { callAI } from './anthropic-client';

/**
 * Misafirin yabanci dildeki mesajini personel bildirimi icin Turkce'ye cevirir.
 * Ceviri basarisiz olursa orijinal metni doner (bildirim bozulmasin).
 * language === 'tr' ise caller cagirmamali (gereksiz maliyet).
 */
export async function translateToTurkish(text: string): Promise<string> {
  const clean = (text || '').trim();
  if (!clean) return clean;
  try {
    const res = await callAI({
      tier: 'standard',
      system:
        'Sen bir ceviri motorusun. Verilen metni dogal, akici Turkce ye cevir. ' +
        'SADECE cevrilmis metni yaz; aciklama, tirnak veya on-ek ekleme. ' +
        'Ozel isimleri (kisi, yer, marka, oda adi) cevirme, aynen birak. ' +
        'Metin zaten Turkce ise oldugu gibi geri ver.',
      messages: [{ role: 'user', content: clean }],
      maxTokens: 300,
      temperature: 0,
    });
    const out = (res.text || '').trim();
    return out || clean;
  } catch {
    return clean;
  }
}
