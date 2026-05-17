/**
 * Mikro Adım 5 — Safety Pre-Classifier
 *
 * Mesaj geldigi anda (department classifier'dan ONCE) calisir.
 * Ucuz + hizli model (claude-haiku) ile sadece "none" veya kategori slug'u doner.
 * Eslesme varsa classify-and-respond ana fonksiyon department classifier'a hic gitmez.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SafetyRule } from './hotel-context';

export type SafetyClassifyResult =
  | { matched: false }
  | { matched: true; category: string; aiInstruction: string };

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Verilen mesaji safety rules listesine karsi siniflandirir.
 * - safetyRules bos ise AI cagrisi yapilmaz, direkt { matched: false } doner.
 * - Hata durumunda { matched: false } doner ve console.warn ile loglar (graceful).
 */
export async function classifySafety(
  guestMessage: string,
  safetyRules: SafetyRule[],
): Promise<SafetyClassifyResult> {
  // Kural yoksa hic AI cagrisi yapma
  if (safetyRules.length === 0) {
    return { matched: false };
  }

  const categoriesList = safetyRules
    .map((r) => `- ${r.category}: ${r.title} (${r.ai_instruction.slice(0, 80)})`)
    .join('\n');

  const systemPrompt =
    `Sen bir mesaj siniflandiricisin. Kullanicinin mesajini asagidaki kategorilerden BIRINE` +
    ` eslesiyorsa o kategorinin slug'unu don, hicbirine girmiyorsa SADECE 'none' yaz.` +
    ` Aciklama yapma, sadece tek kelime don.\n\nKATEGORILER:\n${categoriesList}`;

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 50,
      system: systemPrompt,
      messages: [{ role: 'user', content: guestMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.warn('[safety-classifier] Yanit icinde text block yok, matched=false');
      return { matched: false };
    }

    const raw = textBlock.text.trim().toLowerCase().replace(/['"`.]/g, '');

    if (raw === 'none' || raw === '') {
      return { matched: false };
    }

    // Dogrulanmis kategori — rules listesinde var mi?
    const matchedRule = safetyRules.find((r) => r.category.toLowerCase() === raw);
    if (!matchedRule) {
      // AI tanimli bir slug donemedi (hata yapti) — graceful
      console.warn(`[safety-classifier] Bilinmeyen kategori slug: "${raw}", matched=false`);
      return { matched: false };
    }

    return {
      matched: true,
      category: matchedRule.category,
      aiInstruction: matchedRule.ai_instruction,
    };
  } catch (err) {
    console.warn('[safety-classifier] Hata olustu, matched=false:', err instanceof Error ? err.message : err);
    return { matched: false };
  }
}
