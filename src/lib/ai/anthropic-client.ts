import Anthropic from '@anthropic-ai/sdk';

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env değişkeni tanımlı değil');
  }

  cachedClient = new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: 30_000, // 30s — Vercel Hobby function limiti 10s ama Anthropic SDK kendi içinde timeout yönetir
  });

  return cachedClient;
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 1024;
