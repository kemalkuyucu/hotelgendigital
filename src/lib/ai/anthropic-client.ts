import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

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

  if (provider === 'openai') {
    const client = getOpenAIClient();
    const resp = await client.chat.completions.create({
      model,
      max_completion_tokens: params.maxTokens ?? OPENAI_DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: params.system },
        ...params.messages,
      ],
    });
    return {
      text: (resp.choices[0]?.message?.content ?? '').trim(),
      model: resp.model,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
    };
  }

  const client = getAnthropicClient();
  const acceptsSampling = /sonnet-4-6|haiku-4-5/.test(model);
  const resp = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(acceptsSampling ? { temperature: params.temperature ?? 0.3 } : {}),
    system: params.system,
    messages: params.messages,
  });
  const textBlock = resp.content.find((b) => b.type === 'text');
  return {
    text: textBlock?.type === 'text' ? textBlock.text.trim() : '',
    model: resp.model,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}