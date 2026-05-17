/**
 * Modül 14.b — Perplexity API client
 */
import type {
  InterestTag,
  PerplexityDiscoveryResult,
  PerplexityApiResponse,
  PerplexityPlace,
} from './types';
import { getCategoryByTag } from './categories';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar';

// Perplexity'den JSON döndürmesini garanti etmek için system prompt
const SYSTEM_PROMPT = `You are a local-area research assistant for a hotel in Turkey. 
You will be given a query about places near a hotel address. 
Return a JSON object with this exact structure:
{
  "places": [
    {
      "name": "...",
      "address": "...",
      "distance": "approximately X km",
      "rating": "4.5/5" or null,
      "description": "...",
      "phone": "+90 ..." or null,
      "hours": "..." or null
    }
  ]
}
Use null for fields you don't know - DO NOT invent data. 
Always include at least name, address, and description.
Output ONLY valid JSON, no markdown code fences, no commentary.`;

/**
 * Perplexity API'sine bir kategori sorgusu gönderir, sonucu yapılandırılmış
 * olarak döner. Cache mantığı BU FONKSİYONUN DIŞINDA, API route'ta yapılır.
 */
export async function queryPerplexity(
  interestTag: InterestTag,
  hotelAddress: string,
): Promise<PerplexityDiscoveryResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY ortam değişkeni tanımlı değil');
  }

  const category = getCategoryByTag(interestTag);
  if (!category) {
    throw new Error(`Geçersiz kategori: ${interestTag}`);
  }

  const userPrompt = category.prompt_template.replace('{address}', hotelAddress);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Perplexity API hatası ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data: PerplexityApiResponse = await response.json();
  const rawContent = data.choices?.[0]?.message?.content ?? '';
  const sources = data.citations ?? [];
  const tokensUsed = data.usage?.total_tokens ?? 0;
  const modelUsed = data.model ?? MODEL;

  // JSON parse — Perplexity ara sıra markdown fence koyabilir
  const places = parsePlaces(rawContent);

  return {
    places,
    raw_response: rawContent,
    sources,
    model_used: modelUsed,
    tokens_used: tokensUsed,
  };
}

/**
 * Perplexity ham cevabını PerplexityPlace[]'e parse eder.
 * Markdown fence'leri temizler, JSON çıkaramazsa boş array döner.
 */
function parsePlaces(rawContent: string): PerplexityPlace[] {
  // Markdown fence temizliği
  let cleaned = rawContent.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.places || !Array.isArray(parsed.places)) {
      return [];
    }
    // Normalize: eksik alanları null'la
    return parsed.places.map((p: Record<string, unknown>): PerplexityPlace => ({
      name: typeof p.name === 'string' ? p.name : 'Unnamed',
      address: typeof p.address === 'string' ? p.address : null,
      distance: typeof p.distance === 'string' ? p.distance : null,
      rating: typeof p.rating === 'string' ? p.rating : null,
      description: typeof p.description === 'string' ? p.description : '',
      phone: typeof p.phone === 'string' ? p.phone : null,
      hours: typeof p.hours === 'string' ? p.hours : null,
    }));
  } catch {
    // Parse başarısızsa boş döner, raw_response yine kaydedilir
    return [];
  }
}
