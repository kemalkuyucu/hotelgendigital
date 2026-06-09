import Anthropic from '@anthropic-ai/sdk';
// B1.1 — Departman beyni iskeleti (davranis-notr).
// Bayrak KAPALI iken dispatcher hep handled=false doner; monolit orkestrator
// aynen calisir. Departman beyinleri tek tek eklenecek (7.4 kalibrasyonu).

// Bool tiplenir ki literal-narrowing "unreachable" uyarisi cikmasin.
export const DEPARTMENT_BRAINS_ENABLED: boolean = true;

// 7.4 — Her departman beyninin yetenek profili.
export interface DepartmentBrainConfig {
  department: string;
  model: string;                               // model gucu
  reasoningDepth: 'low' | 'medium' | 'high';   // akil yurutme derinligi
  guardrail: 'loose' | 'standard' | 'strict';  // beyincik sikiligi
}

// Kalibrasyon tablosu — su an BOS. Departman beyinleri buraya eklenecek.
export const DEPARTMENT_BRAIN_REGISTRY: Record<string, DepartmentBrainConfig> = {
  animation: {
    department: 'animation',
    model: 'claude-haiku-4-5',
    reasoningDepth: 'low',
    guardrail: 'loose',
  },
};

export interface DepartmentBrainInput {
  department: string;
  requestText: string;
  guestMessage: string;
  hotelName: string;
  hotelContext?: Record<string, unknown> | null;
}

export interface DepartmentBrainResult {
  handled: boolean;        // false -> orkestratorun kendi yaniti kullanilir
  replyText?: string;
}

// Passthrough dispatcher. Bayrak KAPALI veya kayitli beyin yoksa handled=false.
async function runAnimationBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const contextBlock = input.hotelContext
    ? `\n\nOTEL BİLGİLERİ:\n${JSON.stringify(input.hotelContext, null, 2)}`
    : '';
  const system = `Sen ${input.hotelName} otelinin animasyon departmani asistanisin.${contextBlock}
Gorev: Misafirin animasyon, etkinlik, cocuk kulubu, gece programi ve eglence sorularini nazikce, kisa ve net yanıtla.
Bilmediginde: "Animasyon ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan sorabilirsiniz."
Kapsam disinda (oda, teknik, yemek vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
Her zaman Turkce yaz. Maksimum 3 cumle.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: input.guestMessage }],
  });

  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText };
}

export async function dispatchToDepartmentBrain(
  input: DepartmentBrainInput,
): Promise<DepartmentBrainResult> {
  if (!DEPARTMENT_BRAINS_ENABLED) return { handled: false };
  const config = DEPARTMENT_BRAIN_REGISTRY[input.department];
  if (!config) return { handled: false };
  if (input.department === 'animation') return runAnimationBrain(input);
  return { handled: false };
}
