/**
 * ============================================================================
 * KNOWLEDGE BASE — Summary Builder
 * ============================================================================
 * AI için sistem promptuna inject edilecek özet metin.
 * Faktları kategoriye göre gruplandırır, sections'ı ekler.
 * Token cap: 2000 karakter (yaklaşık 600-700 token)
 * ============================================================================
 */

import { listFacts, listSections } from './knowledge-client';
import { FACT_CATEGORY_LABELS } from './types';
import type { FactCategory } from './types';

export async function buildKnowledgeSummary(hotelId: string): Promise<string> {
  const [facts, sections] = await Promise.all([
    listFacts(hotelId),
    listSections(hotelId),
  ]);

  // Facts: kategoriye göre gruplandır
  const grouped = new Map<FactCategory, typeof facts>();
  for (const fact of facts) {
    const list = grouped.get(fact.category) ?? [];
    list.push(fact);
    grouped.set(fact.category, list);
  }

  const factsText = Array.from(grouped.entries())
    .map(([cat, list]) => {
      const label = FACT_CATEGORY_LABELS[cat] ?? cat;
      const rows = list.map((f) => `- ${f.fact_label}: ${f.fact_value}`).join('\n');
      return `[${label}]\n${rows}`;
    })
    .join('\n\n');

  // Sections: başlık + içerik
  const sectionsText = sections
    .map((s) => `[${s.title}]\n${s.content}`)
    .join('\n\n');

  const full = [
    '=== OTEL BİLGİLERİ ===',
    factsText || '(henüz bilgi girilmemiş)',
    '',
    '=== EKSTRA BİLGİLER ===',
    sectionsText || '(henüz bölüm girilmemiş)',
    '=== SON ===',
  ].join('\n');

  // Token cap: 2000 karakter
  if (full.length <= 2000) return full;
  return full.slice(0, 1997) + '...';
}
