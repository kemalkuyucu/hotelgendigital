/**
 * ============================================================================
 * MODÜL 9 — AI Summarizer
 * ============================================================================
 * Parse edilmiş ham metni Anthropic Claude'a göndererek KB-ready section'lara
 * dönüştürür. Büyük metinler 8000 token (~32000 karakter) ile kırpılır.
 * ============================================================================
 */

import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/ai/anthropic-client';

export interface KbSection {
  title: string;
  content: string;
}

const MAX_CHARS = 32_000; // ~8000 token

const SYSTEM_PROMPT = `Sen bir otel bilgi yönetimi asistanısın.
Sana bir otel belgesinden çıkarılmış ham metin verilecek.
Bu metni misafirlere faydalı olabilecek ayrı knowledge section'larına böl.

KURALLAR:
- Her section'ın bir başlığı (title) ve içeriği (content) olmalı
- Section başlıkları Türkçe ve açıklayıcı olmalı
- İçerikler misafirin sorabileceği bilgileri net ve eksiksiz içermeli
- Gereksiz tekrar veya boş section üretme
- Minimum 1, maksimum 10 section döndür
- Yanıtın YALNIZCA JSON array olsun, başka hiçbir şey ekleme
- Format: [{"title": "...", "content": "..."}]`;

export async function summarizeForKnowledgeBase(
  rawText: string,
  documentType: string,
  departmentKey: string
): Promise<KbSection[]> {
  const client = getAnthropicClient();

  // Büyük metinleri kırp
  const truncated = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Metin çok uzun olduğu için kesildi]'
    : rawText;

  const userContent = `Belge Tipi: ${documentType}
Departman: ${departmentKey}

HAM METİN:
${truncated}`;

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const rawContent = response.content[0];
  if (rawContent.type !== 'text') {
    throw new Error('AI beklenmeyen yanıt tipi döndü.');
  }

  const jsonText = rawContent.text.trim();

  // JSON array'i parse et — kod bloğu içinde olabilir
  const cleaned = jsonText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  let sections: KbSection[];
  try {
    sections = JSON.parse(cleaned) as KbSection[];
  } catch {
    throw new Error(`AI yanıtı JSON parse edilemedi: ${jsonText.slice(0, 200)}`);
  }

  if (!Array.isArray(sections)) {
    throw new Error('AI bir JSON array döndürmedi.');
  }

  // Temizle + filtrele
  return sections
    .filter(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.title === 'string' &&
        typeof s.content === 'string' &&
        s.title.trim() &&
        s.content.trim()
    )
    .map((s) => ({
      title: s.title.trim(),
      content: s.content.trim(),
    }));
}
