import { callAI, DEFAULT_MAX_TOKENS, aiUsageStore } from './anthropic-client';
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
// Phase B / B2.2 — Mesaj tipi taksonomisi (B2.1). Forward kararı değil; sadece
// her intent'e messageType + withButtons + createsSlaEvent imzası ekler.
import {
  getMessageType,
  messageTypeTraits,
  CHAT_INTENTS,
  INFO_INTENTS,
  type MessageType,
} from './message-types';
// Alerji güvenlik ağı — Türkçe-toleranslı keyword eşleşmesi için tek paylaşılan normalize.
import { normalizeTr } from '@/lib/utils/normalize-tr';
import { dispatchToDepartmentBrain } from '@/lib/ai/department-brains';

// ── ÇOK DİLLİ ALERJİ KÖK-KELİMELERİ (tek kaynak) ───────────────────────────
// Bu liste iki yerde kullanılır: (1) saglik kapisi alerji istisnasi (satir ~107),
// (2) alerji guvenlik-agi (satir ~289). ASLA yerinde kopyalanmaz — ucuncu kopya
// gecmiste RU alerjisini saglik disclaimer'ina dusurdu (iki liste desenkronize).
// normalizeTr Latin/TR diyakritigini katlar + toLowerCase uygular (Kiril/Yunanca
// da kuculur) ama transliterasyon YAPMAZ → Latin-disi scriptler kendi alfabesiyle.
// Yasamsal guvenlik: yuksek recall onceligi, yanlis-pozitif kabul (guvenli taraf).
export const ALLERGY_KEYWORDS = [
  'alerj',    // TR (alerji)
  'allerg',   // EN/DE/FR/IT: allergy/Allergie/allergie/allergia (cift-L)
  'alerg',    // ES/PT: alergia (tek-L)
  'intoleran',// EN/ES/DE/IT/TR intolerance/intolerancia/Intoleranz...
  'аллерг',   // RU/BG: аллергия (cift-L Kiril)
  'алерг',    // UK: алергія (tek-L Kiril)
  'αλλεργ',   // EL: αλλεργία
  'حساسي',    // AR: حساسية
  '过敏',      // ZH: guomin
  'アレルギ',  // JA
  '알레르기',  // KO
] as const;

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
  verifiedGuestName?: string | null; // Doğrulanmış misafir adı (varsa) → oda no SORMA
  verifiedRoomNumber?: string | null; // Doğrulanmış misafir oda no (varsa)
  verifiedCheckout?: string | null; // Doğrulanmış misafir çıkış tarihi (varsa)
}

export interface ClassifiedIntentItem {
  department: string;
  requestText: string;
  shouldForward: boolean;
  rawDepartment: string;
  // B2.2 — per-intent mesaj tipi imzası (B2.3'e dek TÜKETİLMEZ; davranış-nötr taşıyıcı)
  messageType: MessageType;
  withButtons: boolean;
  createsSlaEvent: boolean;
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
  overLimit?: boolean;
  reservationNotify?: boolean;
  normalizedRequest?: string;
  mapsLink?: string;        // konum cevabına garanti link enjeksiyonu icin
  raw_response: string;
}

async function _classifyAndRespondImpl(
  input: ClassifyAndRespondInput
): Promise<ClassifyAndRespondOutput> {
  // Modül 15.3 — Hotel context ekle (safety pre-classifier icin de gerekli)
  const interestTag = detectInterestTag(input.guestMessage);
  const hotelSupabase = await getHotelClient(input.hotelId);
  const hotelContext = hotelSupabase
    ? await buildHotelContext(hotelSupabase, { perplexityInterestHint: interestTag })
    : null;
  const mapsLink = hotelContext?.locationInfo
    ? (hotelContext.locationInfo.match(/Google Maps:\s*(\S+)/)?.[1] ?? null)
    : null;

  // ── Mikro Adım 5: Safety Pre-Classifier ──────────────────────────────────
  // Department classifier'dan ONCE calis. Eslesme varsa hic JSON parsing yapmadan don.
  const safetyResult = await classifySafety(
    input.guestMessage,
    hotelContext?.safetyRules ?? [],
  );

  // ── ALERJİ ÖNCELİĞİ — health_medical short-circuit istisnası (yaşamsal) ─────
  // Alerji bildirimi genel "health_medical" güvenlik kuralına takılıp sessizce
  // yutulmamalı (sendAllergenNotifications hiç çalışmadan kalıyordu). 835d476'daki
  // AYNI deterministik tarama: ham metinde alerji anahtar kelimesi varsa VE eşleşen
  // kategori health_medical ise → short-circuit'i ATLA; mesaj normal classify →
  // allergy pipeline'ına düşsün. Diğer kategoriler (self_harm vb.) ve alerji-kelimesi
  // İÇERMEYEN tıbbi mesajlar ("başım ağrıyor") AYNEN short-circuit edilmeye devam eder.
  const allergyOverridesHealthMedical =
    safetyResult.matched &&
    safetyResult.category.toLowerCase() === 'health_medical' &&
    ALLERGY_KEYWORDS.some((kw) => normalizeTr(input.guestMessage).includes(kw));

  if (safetyResult.matched && !allergyOverridesHealthMedical) {
    // Safety kural tetiklendi — hafif, odakli bir AI cagrisi yap
    const safetySystemPrompt =
      `=== DIL KURALI — EN ONCELIKLI ===\n` +
      `ADIM 0: Misafirin mesajinin dilini tespit et. Sonra TUM CEVABINI o dilde yaz. Bu kural diger her seyin ustundedir.\n` +
      `Diller ve ornek ton:\n` +
      `- Turkce: "Maalesef bu konuda yardimci olamiyorum."\n` +
      `- English: "I'm sorry, but I can't help with that."\n` +
      `- Deutsch: "Es tut mir leid, dabei kann ich nicht helfen."\n` +
      `- Русский: "К сожалению, я не могу помочь с этим."\n` +
      `- العربية: "آسف، لا أستطيع المساعدة في ذلك."\n` +
      `- Français: "Desole, je ne peux pas vous aider avec cela."\n` +
      `Misafir hangi dilde yazdiysa CEVAP O DILDE olacak. Otel adi disinda asla baska dile gecme.\n\n` +
      `Sen ${input.hotelName} otelinin asistanisin. Asagidaki kurali uygula:\n\n` +
      `${safetyResult.aiInstruction}\n\n` +
      `HATIRLATMA: Cevabini misafirin yazdigi dilde yaz. Yukaridaki kural Turkce yazili olsa bile, cevabin misafirin dilinde olmali.`;

    const safetyStartedAt = Date.now();
    const safetyResponse = await callAI({
      tier: 'advanced',
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: 1.0,
      system: safetySystemPrompt,
      messages: [{ role: 'user', content: input.guestMessage }],
    });
    const safetyLatency = Date.now() - safetyStartedAt;

    const safetyText = safetyResponse.text;

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
      prompt_tokens: safetyResponse.inputTokens,
      completion_tokens: safetyResponse.outputTokens,
      latency_ms: safetyLatency,
      raw_response: safetyText,
    };
  }
  // ── Safety Pre-Classifier SONU ────────────────────────────────────────────

  // Knowledge summary'yi cache'den getir (5dk TTL) ve sisteme inject et
  const knowledgeSummary = await getCachedSummary(input.hotelId);
  const systemPrompt = buildOrchestratorSystemPrompt(input.hotelName, input.departments, knowledgeSummary, input.verifiedGuestName, input.verifiedRoomNumber, input.verifiedCheckout);

  const hotelContextText = hotelContext ? formatContextForPrompt(hotelContext) : '';
  // HOTEL CONTEXT'i system prompt'a göm — TÜM otel verisi (meeting_rooms dahil) burada
  const contextInjection = hotelContextText
    ? (
        `\n\n` +
        hotelContextText +
        `\n\n--- CEVAP KURALLARI (MUTLAK — UYMAK ZORUNLU) ---\n` +
        `KURAL 1 — UYDURMA YASAK: HOTEL CONTEXT disindaki hicbir bilgiyi UYDURMA.\n` +
        `   Havuz saati, salon kapasitesi, ekipman listesi, fiyat, saat — bilgi CONTEXT'te YOKSA:\n` +
        `   Cevap: "Bu bilgi su an sistemimizde yer almiyor. Dogrulamak icin resepsiyonumuzu arayabilirsiniz."\n` +
        `   ASLA tahmin yurut, varsayim yap, "genellikle", "standart olarak", "muhtemelen" deme.\n\n` +
        `KURAL 2 — BILGI VARSA KULLAN: HOTEL CONTEXT'te bilgi VARSA (toplanti salonu, wifi, telefon,\n` +
        `   check-in/out, ekipman, her sey) DOGRUDAN ve NET cevap ver. DOKUNMA GEREKEN SEYLE:\n` +
        `   - "On buromuzca iletecegim" DEME — bilgi varken yonlendirme KESINLIKLE YASAK\n` +
        `   - "Kisa sure icinde donus yapilacaktir" DEME — misafir HEMEN cevap almali\n` +
        `   - "Bilgi veremiyorum" DEME — CONTEXT'te varsa KESIN ver\n\n` +
        `KURAL 3 — TOPLANTI/SALON/EKIPMAN: Toplanti salonu, etkinlik, dugun, konferans, salon\n` +
        `   kapasitesi, projeksiyon, mikrofon sorularinda HOTEL CONTEXT > "TOPLANTI SALONLARI"\n` +
        `   blokunu kullan. Blok varsa DOGRUDAN cevap ver — on buroya GONDERMEZ.\n\n` +
        `KURAL 4 — KNOWLEDGE_QUERY INTENT: Bilgi sorusu (salon, ekipman, wifi, adres, saat, fiyat)\n` +
        `   icin her zaman intent="knowledge_query", shouldForward=false olur.\n` +
        `   Bu sorular ASLA "talep" olarak siniflandirilmaz, on buroya ILETILMEZ.`
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
  const response = await callAI({
    tier: 'standard',
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: 0.3,
    system: finalSystemPrompt,
    messages,
  });

  const latency_ms = Date.now() - startedAt;

  // Mikro Adım 5: Safety artık pre-classifier'da ele aliniyor; burada sadece ham metin al
  const rawText = response.text;
  if (!rawText) {
    throw new Error('AI response içinde text bulunamadı');
  }

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
    // FALLBACK: Model JSON yerine duz metin dondurduyse (uzun fiyat/rezervasyon cevaplarinda olur)
    // patlatma — ham metni misafire cevap yap, HICBIR departmana forward etme.
    console.warn(
      `[classify] JSON parse fallback devrede. Ham metin reply_text yapildi. Hata: ${err instanceof Error ? err.message : 'unknown'}. Raw: ${rawText.slice(0, 120)}`
    );
    parsed = {
      reply_text: rawText,
      intents: [],
      confidence: 0.5,
      reasoning: 'JSON parse fallback - ham metin misafire iletildi, forward yok',
      answered_from_knowledge: true,
    };
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
          // BUG FIX: request_text ASLA asistan cevabından (reply_text/response_to_guest)
          // türetilmez — bot'un kendi selamlaması sahte "talep" olarak forward ediliyordu.
          // Legacy tek-intent formatında LLM-sağlanan talep metni yoktur → boş bırak;
          // boş request_text forward edilmez (buildForwardableItems atlar).
          request_text: '',
        }];

  const classifiedIntents: ClassifiedIntentItem[] = rawIntents.map((item: { department: string; request_text: string }) => {
    const routing = routeIntentToDepartment(item.department);
    return {
      department: routing.department ?? 'front_office',
      // BUG FIX: yalnız LLM'in verdiği per-intent request_text kullanılır; boşsa BOŞ kalır
      // (asistan cevabı `responseToGuest` ASLA request_text'e kopyalanmaz). Boş request_text
      // forward edilmez (buildForwardableItems atlar) → selamlama/doğrulama turu forward olmaz.
      requestText: item.request_text ?? '',
      shouldForward: routing.shouldForward,
      rawDepartment: item.department,
      // B2.2 — her intent kendi mesaj tipini taşır (çoklu-intent: TALEP+BİLDİRİM ayrışır)
      messageType: routing.messageType,
      withButtons: routing.withButtons,
      createsSlaEvent: routing.createsSlaEvent,
    };
  });

  // ── ALERJİ GÜVENLİK AĞI (deterministik, additive) ──────────────────────────
  // Alerji yaşamsal güvenliktir; tek başına LLM etiketine bırakılamaz. Ham metinde
  // (normalizeTr ile TR-toleranslı) alerji anahtar kelimesi varsa VE LLM bu turda
  // allergy etiketlememişse, mevcut allergy intent şekliyle BİREBİR (routeIntentToDepartment
  // ile aynı department/messageType/flag) bir allergy intent EKLENİR. LLM yolu zayıflatılmaz
  // — keyword OR model → allergy. Çoklu-intent korunur (mevcut intent'ler silinmez).
  const normalizedGuestMsg = normalizeTr(input.guestMessage);
  // ALLERGY_KEYWORDS module-level tek kaynaktan gelir (dosya basi).
  const hasAllergyKeyword = ALLERGY_KEYWORDS.some((kw) => normalizedGuestMsg.includes(kw));
  const llmTaggedAllergy = classifiedIntents.some(
    (i) => (i.rawDepartment ?? '').toLowerCase().trim() === 'allergy',
  );
  if (hasAllergyKeyword && !llmTaggedAllergy) {
    const allergyRouting = routeIntentToDepartment('allergy');
    classifiedIntents.push({
      department: allergyRouting.department ?? 'front_office',
      requestText: input.guestMessage,
      shouldForward: allergyRouting.shouldForward,
      rawDepartment: 'allergy',
      messageType: allergyRouting.messageType,
      withButtons: allergyRouting.withButtons,
      createsSlaEvent: allergyRouting.createsSlaEvent,
    });
    console.log(
      `[allergy-safety-net] Keyword override → allergy intent eklendi (LLM kaçırdı). msg="${input.guestMessage.slice(0, 60)}"`,
    );
  }

    // ── BAGAJ / BELLSERVICE ON BURO OVERRIDE (deterministik) ────────────────────
    // Bagaj/valiz/bavul tasima talebi islevsel olarak ON BURO (bellservice) isidir;
    // LLM bunu bazen housekeeping etiketliyor → yanlis departman beynine dusuyordu.
    // Yonlendirme karari LLM'e tek basina birakilmaz (havlu/alerji dersi). Ham metinde
    // bagaj anahtar kelimesi varsa, ilgili intent'in DEPARTMANI front_office'e zorlanir;
    // shouldForward + requestText korunur. Yeni intent EKLENMEZ (cift kart olmasin) —
    // mevcut intent yerinde guncellenir. Allergy intent'lerine DOKUNULMAZ.
    const BAGGAGE_KEYWORDS = ['bagaj', 'valiz', 'bavul', 'baggage', 'luggage'];
    const hasBaggageKeyword = BAGGAGE_KEYWORDS.some((kw) => normalizedGuestMsg.includes(kw));
    if (hasBaggageKeyword) {
      const foRouting = routeIntentToDepartment('front_office');
      let redirected = false;
      for (const it of classifiedIntents) {
        const rd = (it.rawDepartment ?? '').toLowerCase().trim();
        if (rd === 'allergy') continue;
        if (it.department !== 'front_office' || it.createsSlaEvent) {
          it.department = 'front_office';
          it.shouldForward = true;
          it.messageType = 'BILDIRIM';
          it.withButtons = false;
          it.createsSlaEvent = false;
          redirected = true;
        }
      }
      if (redirected) {
        console.log(
          `[baggage-override] Bagaj talebi front_office'e yonlendirildi. msg="${input.guestMessage.slice(0, 60)}"`,
        );
      }
    }

    // ── B1.1 KANCA (bayrak kapali — davranis degismez) ──────────────────────────
    // DEPARTMENT_BRAINS_ENABLED=false oldugu surece dispatchToDepartmentBrain her
    // zaman { handled: false } doner; akis asagidaki return'e devam eder.
    // Bayrak acildiginda buradan per-dept beyin devreye girer.
    const primaryIntent = classifiedIntents[0];
    if (primaryIntent) {
      const brainResult = await dispatchToDepartmentBrain({
        department: primaryIntent.department,
        requestText: primaryIntent.requestText,
        guestMessage: input.guestMessage,
        hotelName: input.hotelName,
        hotelContext: hotelContext as Record<string, unknown> | null,
        conversationContext: (input.context ?? []).map((m) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.text ?? '' })),
      });
      if (brainResult.handled && brainResult.replyText) {
        return {
          classifiedIntents,
          department: primaryIntent.department,
          shouldForward:
            primaryIntent.department === 'spa'
              ? false
              : primaryIntent.department === 'housekeeping' &&
                brainResult.hasQuantity === false &&
                brainResult.overLimit !== true
              ? false
              : primaryIntent.department === 'fb' &&
                brainResult.isInfoOnly === true
              ? false
              : primaryIntent.department === 'animation' &&
                brainResult.isInfoOnly === true
              ? false
              : primaryIntent.shouldForward,
          confidence: 1,
          reasoning: 'department_brain',
          response_to_guest: brainResult.replyText,
          answered_from_knowledge: false,
          mapsLink: mapsLink ?? undefined,
          safetyTriggered: false,
          safetyCategory: null,
          model: 'department-brain',
          prompt_tokens: 0,
          completion_tokens: 0,
          latency_ms: 0,
          overLimit: brainResult.overLimit ?? false,
          reservationNotify: brainResult.reservationNotify ?? false,
          normalizedRequest: brainResult.normalizedRequest,
          raw_response: brainResult.replyText,
        };
      }
    }
    // ── B1.1 KANCA SONU ─────────────────────────────────────────────────────────

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
    prompt_tokens: response.inputTokens,
    completion_tokens: response.outputTokens,
    latency_ms,
    mapsLink: mapsLink ?? undefined,
    raw_response: rawText,
  };
}

export async function classifyAndRespond(
  input: ClassifyAndRespondInput
): Promise<ClassifyAndRespondOutput> {
  return aiUsageStore.run({ hotelId: input.hotelId ?? null }, () =>
    _classifyAndRespondImpl(input)
  );
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
 *
 * B2.2 — Tek doğruluk kaynağı artık `message-types.ts`. Bu set, oradaki
 * SOHBET (`CHAT_INTENTS`) + BİLGİ (`INFO_INTENTS`) kümelerinin birleşimidir
 * (aynı 7 üye: greeting/acknowledgment/chitchat/farewell/affirmation/negation/
 * knowledge_query). Elle tutulan kopya liste kaldırıldı; export korundu.
 */
export const NON_FORWARDING_INTENTS = new Set<string>([
  ...CHAT_INTENTS,
  ...INFO_INTENTS,
]);

export interface RoutingDecision {
  department: string | null;
  shouldForward: boolean;
  routingReason: string;
  // B2.2 — mesaj tipi imzası (B2.1 haritasından türetilir; forward kararını DEĞİŞTİRMEZ)
  messageType: MessageType;
  withButtons: boolean;
  createsSlaEvent: boolean;
}

export function routeIntentToDepartment(intent: string): RoutingDecision {
  const normalized = (intent || '').toLowerCase().trim();

  // B2.2 — mesaj tipi imzası (B2.1 haritası). Departman + forward branch'leri
  // AYNEN korunur; bu yalnızca her karara messageType/withButtons/createsSlaEvent
  // alanlarını EKLER. messageTypeTraits.forwards, aşağıdaki shouldForward ile
  // birebir aynı sonucu verir (her intent için doğrulandı) — davranış değişmez.
  const messageType = getMessageType(normalized);
  const traits = messageTypeTraits(messageType);
  const typeSignature = {
    messageType,
    withButtons: traits.withButtons,
    createsSlaEvent: traits.createsSlaEvent,
  };

  // 1) Sosyal / non-actionable → forward yok
  if (NON_FORWARDING_INTENTS.has(normalized)) {
    return {
      department: null,
      shouldForward: false,
      routingReason: `no_forward_${normalized}`,
      ...typeSignature,
    };
  }

  // 2) Operasyonel → kendi departmanı
  if (OPERATIONAL_INTENTS.has(normalized)) {
    if (normalized === 'room_service') {
      return { department: 'fb', shouldForward: true, routingReason: 'operational_room_service', ...typeSignature };
    }
    return { department: normalized, shouldForward: true, routingReason: 'operational_direct', ...typeSignature };
  }

  // 3) Kişisel → ön büro
  if (PERSONAL_INTENTS.has(normalized)) {
    return { department: 'front_office', shouldForward: true, routingReason: 'personal_to_front_office', ...typeSignature };
  }

  // 4) Salt complaint → GR
  if (COMPLAINT_INTENTS.has(normalized)) {
    return { department: 'guest_relation', shouldForward: true, routingReason: 'complaint_to_gr', ...typeSignature };
  }

  // 5) Fallback — emin değilsek ön büroya
  return { department: 'front_office', shouldForward: true, routingReason: 'fallback', ...typeSignature };
}
