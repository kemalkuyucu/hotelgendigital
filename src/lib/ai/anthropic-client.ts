import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AsyncLocalStorage } from 'async_hooks';
import { getCentralSupabase } from '@/lib/supabase-client';

export interface AiUsageContext {
  hotelId: string | null;
  tier?: string;
}
export const aiUsageStore = new AsyncLocalStorage<AiUsageContext>();

async function logAiUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const ctx = aiUsageStore.getStore();
    const supabase = getCentralSupabase();
    await supabase.from('ai_usage_log').insert({
      hotel_id: ctx?.hotelId ?? null,
      provider,
      model,
      tier: ctx?.tier ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
  } catch {
    // log hatasi misafir akisini ASLA bozmaz
  }
}

export type AIProvider = 'anthropic' | 'openai';
export type AITier = 'standard' | 'advanced';

export function getActiveProvider(): AIProvider {
  return process.env.AI_PROVIDER === 'openai' ? 'openai' : 'anthropic';
}

const MODEL_MAP: Record<AIProvider, Record<AITier, string>> = {
  anthropic: {
    standard: 'claude-sonnet-4-6',
    advanced: 'claude-sonnet-4-6',
  },
  openai: {
    standard: 'gpt-5.4-mini',
    advanced: 'gpt-5.4',
  },
};

const OPENAI_DEFAULT_MAX_TOKENS = 2048;

let cachedAnthropic: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env değişkeni tanımlı değil');
  cachedAnthropic = new Anthropic({ apiKey, maxRetries: 2, timeout: 30_000 });
  return cachedAnthropic;
}

let cachedOpenAI: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (cachedOpenAI) return cachedOpenAI;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY env değişkeni tanımlı değil');
  cachedOpenAI = new OpenAI({ apiKey, maxRetries: 2, timeout: 30_000 });
  return cachedOpenAI;
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 1024;

export interface CallAIParams {
  tier: AITier;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface CallAIResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callAI(params: CallAIParams): Promise<CallAIResult> {
  const provider = getActiveProvider();
  const model = MODEL_MAP[provider][params.tier];

  // jsonMode: system'in sonuna gecerli-JSON talimati eklenir (her iki saglayici).
  const system = params.jsonMode
    ? params.system + '\n\nOutput format: valid JSON only. No prose.'
    : params.system;

  if (provider === 'openai') {
    const client = getOpenAIClient();
    const resp = await client.chat.completions.create({
      model,
      max_completion_tokens: params.maxTokens ?? OPENAI_DEFAULT_MAX_TOKENS,
      ...(params.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      messages: [
        { role: 'system', content: system },
        ...params.messages,
      ],
    });
    const usageInput = resp.usage?.prompt_tokens ?? 0;
    const usageOutput = resp.usage?.completion_tokens ?? 0;
    await logAiUsage(provider, resp.model, usageInput, usageOutput);
    return {
      text: (resp.choices[0]?.message?.content ?? '').trim(),
      model: resp.model,
      inputTokens: usageInput,
      outputTokens: usageOutput,
    };
  }

  const client = getAnthropicClient();
  const acceptsSampling = /sonnet-4-6|haiku-4-5/.test(model);
  const resp = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(acceptsSampling ? { temperature: params.temperature ?? 0.3 } : {}),
    system,
    messages: params.messages,
  });
  const textBlock = resp.content.find((b) => b.type === 'text');
  await logAiUsage(provider, resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  return {
    text: textBlock?.type === 'text' ? textBlock.text.trim() : '',
    model: resp.model,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}