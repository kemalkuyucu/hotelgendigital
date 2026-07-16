/**
 * ============================================================================
 * KNOWLEDGE BASE — Summary Builder
 * ============================================================================
 * AI için sistem promptuna inject edilecek özet metin.
 * Faktları kategoriye göre gruplandırır, sections'ı ekler.
 *
 * Token cap: 30000 karakter (~7500-10000 token, Claude context'inde sorun değil)
 * Per-section cap: 600 karakter (fazlası "..." ile kesilir)
 *
 * Section sıralaması: created_at DESC (yeni belgeler önce — daha güncel)
 * ============================================================================
 */

import { listFacts, listSections } from './knowledge-client';
import { FACT_CATEGORY_LABELS } from './types';

const MAX_CHARS = 30000;
const SECTION_MAX_CHARS = 600;

export async function buildKnowledgeSummary(hotelId: string): Promise<string> {
  const [facts, sections] = await Promise.all([
    listFacts(hotelId),
    listSections(hotelId),
  ]);

  // Facts: kategoriye göre gruplandır (kategori serbest TEXT → Map<string>)
  const grouped = new Map<string, typeof facts>();
  for (const fact of facts) {
    const list = grouped.get(fact.category) ?? [];
    list.push(fact);
    grouped.set(fact.category, list);
  }

  // FACT_CATEGORY_LABELS Record<FactCategory,string>; cat serbest TEXT olduğundan
  // string-index icin genisletilmis L uzerinden okunur (fallback yine ham cat — çıktı birebir aynı).
  const L: Record<string, string> = FACT_CATEGORY_LABELS;
  const factsText = Array.from(grouped.entries())
    .map(([cat, list]) => {
      const label = L[cat] ?? cat;
      const rows = list.map((f) => `- ${f.fact_label}: ${f.fact_value}`).join('\n');
      return `[${label}]\n${rows}`;
    })
    .join('\n\n');

  // Sections: her section content'i 600 karakterle sınırla
  const sectionsText = sections
    .map((s) => {
      const content =
        s.content.length <= SECTION_MAX_CHARS
          ? s.content
          : s.content.slice(0, SECTION_MAX_CHARS - 3) + '...';
      return `[${s.title}]\n${content}`;
    })
    .join('\n\n');

  const full = [
    '=== OTEL TEMEL BİLGİLERİ ===',
    factsText || '(henüz bilgi girilmemiş)',
    '',
    '=== DETAYLI BİLGİLER ===',
    sectionsText || '(henüz bölüm girilmemiş)',
    '=== SON ===',
  ].join('\n');

  if (full.length <= MAX_CHARS) return full;
  return full.slice(0, MAX_CHARS - 3) + '...';
}
