/**
 * social-intent-override.ts — Modül 10.7
 *
 * AI bazen "teşekkür ederim" gibi sosyal mesajları yanlış intent'le
 * (complaint, fb, vs.) sınıflandırıyor. Bu helper, kısa mesajlardaki
 * sosyal keyword'leri yakalayarak intent'i override eder.
 *
 * Kural:
 *   - Mesaj operasyonel keyword içeriyorsa → AI intent'ine dokunma
 *   - Mesaj 10 kelimeden kısa + sosyal keyword içeriyor → override
 *   - Aksi halde AI intent kullanılır
 */

const SOCIAL_KEYWORDS: Record<string, string[]> = {
  greeting: [
    'merhaba', 'merhabalar', 'selam', 'selamlar', 'günaydın',
    'iyi günler', 'iyi akşamlar',
    'hello', 'hi', 'hey', 'good morning', 'good evening',
    'hallo', 'guten tag', 'guten morgen', 'guten abend',
    'привет', 'здравствуйте',
    'مرحبا', 'السلام عليكم',
  ],
  acknowledgment: [
    'teşekkür', 'teşekkürler', 'teşekkür ederim', 'çok teşekkür',
    'sağol', 'sağ ol', 'sağolun', 'sağ olun', 'mersi',
    'thank you', 'thanks', 'thank',
    'danke', 'vielen dank',
    'спасибо',
    'شكرا',
  ],
  farewell: [
    'hoşçakal', 'hoşça kal', 'görüşürüz', 'bay bay', 'allaha ısmarladık',
    'iyi geceler',
    'bye', 'goodbye', 'see you', 'good night',
    'tschüss', 'auf wiedersehen', 'gute nacht',
    'до свидания', 'спокойной ночи',
    'مع السلامة', 'تصبح على خير',
  ],
  affirmation: [
    'evet', 'tabii', 'tabi', 'olur', 'oldu', 'tamam', 'anladım', 'peki',
    'yes', 'sure', 'ok', 'okay', 'alright', 'fine',
    'ja', 'klar',
    'да', 'хорошо',
    'نعم', 'حسنا',
  ],
  negation: [
    'hayır', 'yok', 'gerek yok', 'istemiyorum', 'olmaz', 'şimdilik yok',
    'no', 'not now', 'no need', 'nothing',
    'nein', 'nicht',
    'нет',
    'لا',
  ],
};

/**
 * Operasyonel keyword'ler: mesajda bunlardan biri varsa override YAPMA.
 * Sosyal görünen ama operasyonel içerik taşıyan mesajları korur.
 */
const OPERATIONAL_KEYWORDS = [
  // Technical
  'klima', 'klimam', 'kombi', 'ısıtma', 'soğutma', 'tv', 'televizyon',
  'lamba', 'priz', 'elektrik', 'su yok', 'sıcak su', 'soğuk su',
  'tuvalet', 'lavabo', 'duş', 'banyo',
  'çalışmıyor', 'bozuk', 'kırık', 'arıza',
  // Housekeeping
  'havlu', 'bornoz', 'çarşaf', 'yastık', 'battaniye', 'yorgan',
  'temizlik', 'temiz', 'kirli', 'eksik', 'fazladan',
  // F&B
  'kahvaltı', 'yemek', 'restoran', 'menü', 'içecek', 'bira', 'şarap',
  'minibar', 'kahve', 'çay', 'oda servisi',
  // Spa/Animation
  'spa', 'masaj', 'hamam', 'sauna', 'animasyon', 'şov',
  // Personal
  'alerji', 'fatura', 'ücret', 'minibar ücreti', 'kayıp',
  // Complaint markers
  'şikayet', 'iade', 'memnun değil', 'memnun değilim', 'berbat',
  // EN equivalents (sık görülenler)
  'broken', 'not working', 'missing', 'dirty', 'cold', 'hot',
  'towel', 'pillow', 'blanket', 'wifi', 'breakfast', 'restaurant',
];

export interface SocialOverrideResult {
  finalIntent: string;
  overridden: boolean;
  reason?: string;
}

/**
 * AI intent'ini sosyal keyword'lere göre override eder.
 *
 * @param text - Misafirin ham mesaj metni
 * @param aiIntent - AI'ın sınıflandırdığı intent
 * @returns finalIntent (nihai intent), overridden (override yapıldı mı?), reason (debug için)
 */
export function overrideSocialIntent(
  text: string,
  aiIntent: string,
): SocialOverrideResult {
  if (!text) return { finalIntent: aiIntent, overridden: false };

  const lower = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  // 1) Operasyonel keyword varsa override YAPMA — AI intent kalır
  for (const kw of OPERATIONAL_KEYWORDS) {
    if (lower.includes(kw)) {
      return { finalIntent: aiIntent, overridden: false };
    }
  }

  // 2) Çok uzun mesaj (>10 kelime) → override YAPMA (AI'a güven)
  if (wordCount > 10) {
    return { finalIntent: aiIntent, overridden: false };
  }

  // 3) Sosyal keyword kontrolü (önce çok-kelimeli phrase'ler dene)
  for (const [socialIntent, keywords] of Object.entries(SOCIAL_KEYWORDS)) {
    // Uzun phrase'ler önce kontrol edilsin (daha spesifik eşleşme)
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      // Tam kelime veya başlangıç eşleşmesi (unicode flag 'u' ile)
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'iu');
      if (regex.test(lower)) {
        if (socialIntent !== aiIntent) {
          return {
            finalIntent: socialIntent,
            overridden: true,
            reason: `keyword_match:${kw}→${socialIntent}`,
          };
        }
        // AI zaten doğru sınıflandırmış
        return { finalIntent: socialIntent, overridden: false };
      }
    }
  }

  // Eşleşme yok → AI intent kalır
  return { finalIntent: aiIntent, overridden: false };
}
