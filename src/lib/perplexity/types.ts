/**
 * Modül 14.b — Perplexity API tipleri
 */

export type InterestTag =
  | 'restaurant'
  | 'pharmacy'
  | 'museum'
  | 'transport'
  | 'atm'
  | 'shopping'
  | 'hospital'
  | 'beach'
  | 'attraction'
  | 'nightlife';

export type PerplexityPlace = {
  name: string;
  address: string | null;
  distance: string | null;
  rating: string | null;
  description: string;
  phone: string | null;
  hours: string | null;
};

export type PerplexityDiscoveryResult = {
  places: PerplexityPlace[];
  raw_response: string;
  sources: string[];
  model_used: string;
  tokens_used: number;
};

export type PerplexityApiResponse = {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};
