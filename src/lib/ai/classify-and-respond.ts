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
  shouldForward: boolean;          // false → sosyal intent, bot sadece cevap verir
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
  const rawIntent = parsed.intent ?? parsed.department ?? null;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  // Modül 10.2: Hiyerarşik routing — AI'nın intent'ini departmana çevir.
  // Modül 10.6: NON_FORWARDING_INTENTS → shouldForward=false
  const routing = rawIntent
    ? routeIntentToDepartment(rawIntent)
    : { department: null, shouldForward: false, routingReason: 'no_intent' };

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
    department: routing.department,
    shouldForward: routing.shouldForward,
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

// ── Modül 10.2 + 10.6: Intent → Departman hiyerarşik routing ──────────────────

/**
 * Intent → Departman mapping (hiyerarşik).
 *
 * Kural:
 *   1. Sosyal / non-actionable intent → shouldForward=false (Modül 10.6)
 *   2. Operasyonel intent her zaman kendi departmanına gider (GR'a değil).
 *   3. Kişisel intent (billing, allergy, lost_and_found) front_office'e gider.
 *   4. Salt complaint (operasyonel olmayan deneyim şikayeti) GR'a gider.
 *   5. Tanınmayan intent → front_office (fallback).
 */

const OPERATIONAL_INTENTS = new Set([
  'technical',
  'housekeeping',
  'fb',
  'spa',
  'animation',
  'room_service',
]);

const PERSONAL_INTENTS = new Set([
  'allergy',
  'billing',
  'lost_and_found',
]);

const COMPLAINT_INTENTS = new Set(['complaint']);

/**
 * Modül 10.6 — Sosyal / non-actionable intent'ler.
 * Bu intent'lerde SADECE bot cevap verilir, hiçbir departmana forward EDİLMEZ.
 * Doğrulama akışı da tetiklenmez.
 */
export const NON_FORWARDING_INTENTS = new Set([
  'greeting',         // merhaba, selam, hello, hi
  'acknowledgment',   // teşekkürler, sağol, thanks
  'chitchat',         // nasılsın, hava nasıl
  'farewell',         // görüşürüz, iyi geceler, bye
  'affirmation',      // evet, tamam, olur, yes
  'negation',         // hayır, gerek yok, no
  'knowledge_query',  // KB sorusu (cevap KB'den, forward yok)
]);

export interface RoutingDecision {
  department: string | null;
  shouldForward: boolean;
  routingReason: string;
}

export function routeIntentToDepartment(intent: string): RoutingDecision {
  const normalized = (intent || '').toLowerCase().trim();

  // 1) Sosyal / non-actionable → forward yok
  if (NON_FORWARDING_INTENTS.has(normalized)) {
    return {
      department: null,
      shouldForward: false,
      routingReason: `no_forward_${normalized}`,
    };
  }

  // 2) Operasyonel → kendi departmanı
  if (OPERATIONAL_INTENTS.has(normalized)) {
    if (normalized === 'room_service') {
      return { department: 'fb', shouldForward: true, routingReason: 'operational_room_service' };
    }
    return { department: normalized, shouldForward: true, routingReason: 'operational_direct' };
  }

  // 3) Kişisel → ön büro
  if (PERSONAL_INTENTS.has(normalized)) {
    return { department: 'front_office', shouldForward: true, routingReason: 'personal_to_front_office' };
  }

  // 4) Salt complaint → GR
  if (COMPLAINT_INTENTS.has(normalized)) {
    return { department: 'guest_relation', shouldForward: true, routingReason: 'complaint_to_gr' };
  }

  // 5) Fallback — emin değilsek ön büroya
  return { department: 'front_office', shouldForward: true, routingReason: 'fallback' };
}
