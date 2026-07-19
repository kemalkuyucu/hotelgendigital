/**
 * Modül 14.b — Perplexity sorgu kategorileri
 */
import type { InterestTag } from './types';

export type CategoryConfig = {
  tag: InterestTag;
  label_tr: string;
  label_en: string;
  icon: string;
  /** Kategori modu: 'perplexity'=otomatik yakin liste, 'kb_only'=sadece KB, 'disabled'=kapali */
  mode: 'perplexity' | 'kb_only' | 'disabled';
  /** Perplexity prompt template'i. {address} placeholder'ı otel adresiyle değiştirilir. */
  prompt_template: string;
};

export const PERPLEXITY_CATEGORIES: CategoryConfig[] = [
  {
    tag: 'restaurant',
    label_tr: 'Restoranlar',
    label_en: 'Restaurants',
    icon: '🍽️',
    mode: 'kb_only',
    prompt_template:
      'List 10 highly-rated restaurants near "{address}". For each: name, full address, approximate distance from the hotel, Google rating (if known), short description (1 sentence about cuisine and atmosphere), phone number (if known), opening hours (if known). Focus on places within 5 km. Prefer recently active and popular restaurants.',
  },
  {
    tag: 'pharmacy',
    label_tr: 'Eczaneler',
    label_en: 'Pharmacies',
    icon: '💊',
    mode: 'perplexity',
    prompt_template:
      'List 10 pharmacies near "{address}", including any 24-hour or on-duty (nöbetçi eczane) pharmacies. For each: name, full address, distance from the hotel, phone, opening hours (mark clearly if 24h or on-duty). Focus on places within 3 km.',
  },
  {
    tag: 'museum',
    label_tr: 'Müzeler ve Tarihi Yerler',
    label_en: 'Museums & Historical Sites',
    icon: '🏛️',
    mode: 'perplexity',
    prompt_template:
      'List 10 museums, historical landmarks, or cultural sites near "{address}". For each: name, full address, distance from the hotel, short description (1-2 sentences about what visitors can see), entry fee (if known), opening hours. Focus on places within 15 km.',
  },
  {
    tag: 'transport',
    label_tr: 'Ulaşım',
    label_en: 'Transportation',
    icon: '🚌',
    mode: 'disabled',
    prompt_template:
      'List 10 public transport options near "{address}": nearest bus stops, dolmuş stops, metro/tram stations, taxi stands, airport shuttle pickup points. For each: name/identifier, full address, distance from the hotel, what routes or destinations it serves, approximate frequency.',
  },
  {
    tag: 'atm',
    label_tr: 'ATM ve Bankalar',
    label_en: 'ATMs & Banks',
    icon: '🏧',
    mode: 'perplexity',
    prompt_template:
      'List 10 ATMs and bank branches near "{address}". For each: bank name, full address, distance from the hotel, ATM availability (24h or branch-hours), exchange office availability. Focus on places within 2 km.',
  },
  {
    tag: 'shopping',
    label_tr: 'Alışveriş',
    label_en: 'Shopping',
    icon: '🛍️',
    mode: 'perplexity',
    prompt_template:
      'List 10 shopping locations near "{address}": shopping malls (AVM), local bazaars, supermarkets, souvenir shops. For each: name, full address, distance from the hotel, short description (what kind of shops/products), opening hours.',
  },
  {
    tag: 'hospital',
    label_tr: 'Hastane ve Klinikler',
    label_en: 'Hospitals & Clinics',
    icon: '🏥',
    mode: 'perplexity',
    prompt_template:
      'List 5 hospitals and 5 private clinics near "{address}". For each: name, full address, distance from the hotel, type (state hospital, private hospital, clinic, polyclinic), specialty if known, phone, emergency service availability (24h).',
  },
  {
    tag: 'beach',
    label_tr: 'Plajlar',
    label_en: 'Beaches',
    icon: '⛱️',
    mode: 'kb_only',
    prompt_template:
      'List 10 beaches and seaside points near "{address}". For each: name, full address or location, distance from the hotel, short description (sandy/pebble, public/private, blue flag, amenities like loungers/showers), how to get there.',
  },
  {
    tag: 'attraction',
    label_tr: 'Turistik Yerler ve Aktiviteler',
    label_en: 'Tourist Attractions & Activities',
    icon: '🎢',
    mode: 'perplexity',
    prompt_template:
      'List 10 tourist attractions, theme parks, water parks, aquariums, or unique activity centers near "{address}". For each: name, full address, distance from the hotel, type of attraction, short description (what visitors can do), entry fee (if known), opening hours.',
  },
  {
    tag: 'nightlife',
    label_tr: 'Gece Hayatı',
    label_en: 'Nightlife',
    icon: '🌃',
    mode: 'perplexity',
    prompt_template:
      'List 10 bars, lounges, nightclubs, or evening entertainment venues near "{address}". For each: name, full address, distance from the hotel, type (bar/club/lounge/live music), short description (vibe and crowd), opening hours.',
  },
];

export function getCategoryByTag(tag: string): CategoryConfig | null {
  return PERPLEXITY_CATEGORIES.find((c) => c.tag === tag) ?? null;
}
