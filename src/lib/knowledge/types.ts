/**
 * ============================================================================
 * KNOWLEDGE BASE — TypeScript Types
 * ============================================================================
 * DB ile bire bir eşleşir. CHECK constraint → FACT_CATEGORIES sabit listesi.
 * ============================================================================
 */

// hotel_facts.category CHECK constraint ile senkronize
export const FACT_CATEGORIES = [
  'general',
  'pool',
  'restaurant',
  'spa',
  'rooms',
  'beach',
  'wifi',
  'contact',
  'laundry_ironing',
  'other',
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FACT_CATEGORY_LABELS: Record<FactCategory, string> = {
  general: 'Genel',
  pool: 'Havuz',
  restaurant: 'Restoran',
  spa: 'Spa & Fitness',
  rooms: 'Oda',
  beach: 'Plaj',
  wifi: 'Wi-Fi',
  contact: 'İletişim',
  laundry_ironing: 'Çamaşır & Ütü',
  other: 'Diğer',
};

// hotel_facts tablosu — 9 kolon
export interface HotelFact {
  id: string;
  fact_key: string;
  fact_value: string;
  fact_label: string;
  category: FactCategory;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface HotelFactInput {
  fact_key: string;
  fact_value: string;
  fact_label: string;
  category: FactCategory;
  display_order?: number;
}

// knowledge_sections tablosu — 8 kolon
export interface KnowledgeSection {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSectionInput {
  title: string;
  content: string;
  category?: string | null;
  display_order?: number;
}

// Type guard — DB'den gelen unknown veriyi FactCategory'ye doğrula
export function isFactCategory(value: unknown): value is FactCategory {
  return typeof value === 'string' && (FACT_CATEGORIES as readonly string[]).includes(value);
}
