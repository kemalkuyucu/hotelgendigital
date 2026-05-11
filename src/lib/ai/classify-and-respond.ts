import { getAnthropicClient, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from './anthropic-client';
import { buildOrchestratorSystemPrompt, DepartmentInfo } from './system-prompts';
import { getCachedSummary } from '@/lib/knowledge/cache';

export interface ConversationContextMessage {
  direction: 'inbound' | 'outbound';
  text: string;
  created_at: string;
}

export interface ClassifyAndRespondInput {
  hotelId: string;           // knowledge cache invalidation için zorunlu
  hotelName: string;
  departments: DepartmentInfo[];
  guestMessage: string;
  context: ConversationContextMessage[]; // Son N mesaj (eski → yeni sırada)
}

export interface ClassifyAndRespondOutput {
  department: string | null;
  confidence: number;
  reasoning: string;
  response_to_guest: string;
  answered_from_knowledge: boolean; // true → KB'den cevap verildi, forward yapılmamalı
  // Telemetri
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  raw_response: string;
}

export async function classifyAndRespond(
  input: ClassifyAndRespondInput
): Promise<ClassifyAndRespondOutput> {
  const client = getAnthropicClient();
  // Knowledge summary'yi cache'den getir (5dk TTL) ve sisteme inject et
  const knowledgeSummary = await getCachedSummary(input.hotelId);
  const systemPrompt = buildOrchestratorSystemPrompt(input.hotelName, input.departments, knowledgeSummary);

  // Context mesajlarını Anthropic message formatına çevir
  const messages = input.context.map((m) => ({
    role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  // Son misafir mesajını ekle
  messages.push({ role: 'user' as const, content: input.guestMessage });

  const startedAt = Date.now();

  // temperature: 0.3 — önceki: yok (SDK default 1.0)
  // 0.3 → deterministik kalır, ama natural dil varyasyonlarını kabul eder
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  });

  const latency_ms = Date.now() - startedAt;

  // İlk text bloğunu al
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic response içinde text block bulunamadı');
  }

  const rawText = textBlock.text.trim();

  // JSON parse — Claude bazen ```json fence ekler, temizle
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // Yeni JSON şeması: reply_text + intent + confidence + reasoning + answered_from_knowledge
  // Geriye dönük uyum: response_to_guest ve department alanları da destekleniyor
  let parsed: {
    reply_text?: string;
    response_to_guest?: string; // legacy uyum
    intent?: string | null;
    department?: string | null; // legacy uyum
    confidence: number;
    reasoning: string;
    answered_from_knowledge?: boolean;
  };

  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch (err) {
    throw new Error(
      `Anthropic JSON parse hatası: ${err instanceof Error ? err.message : 'unknown'}. Raw: ${rawText.slice(0, 200)}`
    );
  }

  // Yeni format öncelikli, legacy fallback
  const responseToGuest = parsed.reply_text ?? parsed.response_to_guest ?? '';
  let department = parsed.intent ?? parsed.department ?? null;
  let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  // Şikayet intent'i her zaman guest_relation'a gider — confidence düşse bile.
  // Devir notu kuralı: complaint → GR, CC YOK.
  if (department === 'complaint') {
    department = 'guest_relation';
    confidence = Math.max(confidence, 0.85); // GR routing'i için minimum güven
  }

  // Validasyon
  if (typeof responseToGuest !== 'string' || responseToGuest.length === 0) {
    throw new Error('reply_text / response_to_guest eksik veya boş');
  }

  // answered_from_knowledge: eksikse false varsay (güvenli default — forward yapılır)
  const answeredFromKnowledge =
    typeof parsed.answered_from_knowledge === 'boolean'
      ? parsed.answered_from_knowledge
      : false;

  return {
    department,
    confidence,
    reasoning: parsed.reasoning ?? '',
    response_to_guest: responseToGuest,
    answered_from_knowledge: answeredFromKnowledge,
    model: response.model,
    prompt_tokens: response.usage.input_tokens,
    completion_tokens: response.usage.output_tokens,
    latency_ms,
    raw_response: rawText,
  };
}
