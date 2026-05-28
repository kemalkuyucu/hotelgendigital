import { getAnthropicClient, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from './anthropic-client';
import { buildOrchestratorSystemPrompt, DepartmentInfo } from './system-prompts';
import { getCachedSummary } from '@/lib/knowledge/cache';
import { getHotelClient } from '@/lib/tenant/get-hotel-client';
// Modül 15.3 — Hotel context
import {
  buildHotelContext,
  detectInterestTag,
  formatContextForPrompt,
} from './hotel-context';
// Mikro Adım 5 — Safety pre-classifier
import { classifySafety } from './safety-classifier';

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

export interface ClassifiedIntentItem {
  department: string;
  requestText: string;
  shouldForward: boolean;
  rawDepartment: string;
}

export interface ClassifyAndRespondOutput {
  classifiedIntents: ClassifiedIntentItem[];    // YENİ — çoklu intent desteği
  department: string | null;                    // LEGACY — classifiedIntents[0]'dan türetilir
  shouldForward: boolean;                       // LEGACY — herhangi biri forward → true
  confidence: number;
  reasoning: string;
  response_to_guest: string;
  answered_from_knowledge: boolean; // true → KB'den cevap verildi, forward yapılmamalı
  // Mikro Adım 4: Safety etiket tespiti
  safetyTriggered: boolean;        // true → AI güvenlik kuralı uyguladı, forward iptal
  safetyCategory: string | null;   // tetiklenen kategori adı (örn. 'guest_privacy_kvkk')
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

  // Modül 15.3 — Hotel context ekle (safety pre-classifier icin de gerekli)
  const interestTag = detectInterestTag(input.guestMessage);
  const hotelSupabase = await getHotelClient(input.hotelId);
  const hotelContext = hotelSupabase
    ? await buildHotelContext(hotelSupabase, { perplexityInterestHint: interestTag })
    : null;

  // ── Mikro Adım 5: Safety Pre-Classifier ──────────────────────────────────
  // Department classifier'dan ONCE calis. Eslesme varsa hic JSON parsing yapmadan don.
  const safetyResult = await classifySafety(
    input.guestMessage,
    hotelContext?.safetyRules ?? [],
  );

  if (safetyResult.matched) {
    // Safety kural tetiklendi — hafif, odakli bir AI cagrisi yap
    const safetySystemPrompt =
      `Sen ${input.hotelName} otelinin asistanisin. Asagidaki kurali AYNEN uygula, asla saptirma:\n\n` +
      `${safetyResult.aiInstruction}\n\n` +
      `DIL KURALI: Sadece Turkce alfabesi kullan.`;

    const safetyStartedAt = Date.now();
    const safetyResponse = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: safetySystemPrompt,
      messages: [{ role: 'user', content: input.guestMessage }],
    });
    const safetyLatency = Date.now() - safetyStartedAt;

    const safetyTextBlock = safetyResponse.content.find((b) => b.type === 'text');
    const safetyText = safetyTextBlock?.type === 'text' ? safetyTextBlock.text.trim() : '';

    return {
      classifiedIntents: [],
      department: null,
      shouldForward: false,
      confidence: 1,
      reasoning: `safety_pre_classifier:${safetyResult.category}`,
      response_to_guest: safetyText,
      answered_from_knowledge: false,
      safetyTriggered: true,
      safetyCategory: safetyResult.category,
      model: safetyResponse.model,
      prompt_tokens: safetyResponse.usage.input_tokens,
      completion_tokens: safetyResponse.usage.output_tokens,
      latency_ms: safetyLatency,
      raw_response: safetyText,
    };
  }
  // ── Safety Pre-Classifier SONU ────────────────────────────────────────────

  // Knowledge summary'yi cache'den getir (5dk TTL) ve sisteme inject et
  const knowledgeSummary = await getCachedSummary(input.hotelId);
  const systemPrompt = buildOrchestratorSystemPrompt(input.hotelName, input.departments, knowledgeSummary);

  const hotelContextText = hotelContext ? formatContextForPrompt(hotelContext) : '';
  // HOTEL CONTEXT'i system prompt'a göm — TÜM otel verisi (meeting_rooms dahil) burada
  const contextInjection = hotelContextText
    ? (
        `\n\n` +
        hotelContextText +
        `\n\n--- CEVAP KURALLARI (MUTLAK) ---\n` +
        `1. Yukaridaki HOTEL CONTEXT disindaki bilgileri KESINLIKLE UYDURMA.\n` +
        `2. HOTEL CONTEXT'te bilgi VARSA (toplanti salonu, wifi, telefon, check-in/out, her sey) NET ve KESIN cevap ver.\n` +
        `   \"Resepsiyona danisin\", \"Onburoya sorun\" DEME — bilgi varken yonlendirme YASAK.\n` +
        `3. HOTEL CONTEXT'te bilgi YOKSA: Kibarca bilmedigini soyle ve otel telefon numarasina yonlendir.\n` +
        `4. Toplanti salonu, etkinlik, dugun, konferans, salon kapasitesi sorularinda:\n` +
        `   HOTEL CONTEXT > \"TOPLANTI SALONLARI\" blokunu kullan, UYDURMA.`
      )
    : '';
  const finalSystemPrompt = systemPrompt + contextInjection;

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
    system: finalSystemPrompt,
    messages,
  });

  const latency_ms = Date.now() - startedAt;

  // İlk text bloğunu al
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic response içinde text block bulunamadı');
  }

  // Mikro Adım 5: Safety artık pre-classifier'da ele aliniyor; burada sadece ham metin al
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
    intents?: Array<{ department: string; request_text: string }>; // YENİ çoklu intent
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
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  // Modül 12: intents[] array varsa çoklu routing; yoksa tek intent'e fallback
  const rawIntents =
    Array.isArray(parsed.intents) && parsed.intents.length > 0
      ? parsed.intents
      : [{
          department: parsed.intent ?? parsed.department ?? 'unknown',
          request_text: parsed.reply_text ?? parsed.response_to_guest ?? '',
        }];

  const classifiedIntents: ClassifiedIntentItem[] = rawIntents.map((item: { department: string; request_text: string }) => {
    const routing = routeIntentToDepartment(item.department);
    return {
      department: routing.department ?? 'front_office',
      requestText: item.request_text || responseToGuest,
      shouldForward: routing.shouldForward,
      rawDepartment: item.department,
    };
  });

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
    classifiedIntents,
    department: classifiedIntents[0]?.department ?? null,
    shouldForward: classifiedIntents.some((i) => i.shouldForward),
    confidence,
    reasoning: parsed.reasoning ?? '',
    response_to_guest: responseToGuest,
    answered_from_knowledge: answeredFromKnowledge,
    safetyTriggered: false,   // Normal akis: safety pre-classifier'da eslesme yoktu
    safetyCategory: null,
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
