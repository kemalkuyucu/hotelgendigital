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
  housekeeping: {
    department: 'housekeeping',
    model: 'claude-haiku-4-5',
    reasoningDepth: 'medium',
    guardrail: 'standard',
  },
  spa: {
    department: 'spa',
    model: 'claude-haiku-4-5',
    reasoningDepth: 'low',
    guardrail: 'loose',
  },
  front_office: {
    department: 'front_office',
    model: 'claude-haiku-4-5',
    reasoningDepth: 'medium',
    guardrail: 'standard',
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
  overLimit?: boolean;
  reservationNotify?: boolean;
}

// Passthrough dispatcher. Bayrak KAPALI veya kayitli beyin yoksa handled=false.
const TR_SAYI_KELIMELERI: Record<string, number> = {
  bir: 1, iki: 2, 'üç': 3, uc: 3, 'dört': 4, dort: 4, 'beş': 5, bes: 5,
  'altı': 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  yirmi: 20, otuz: 30, 'kırk': 40, kirk: 40, elli: 50,
};

function extractMaxItemQuantity(text: string): number | null {
  if (!text) return null;
  const lower = text.toLocaleLowerCase('tr-TR');
  let max: number | null = null;
  const digits = lower.match(/\d+/g);
  if (digits) {
    for (const d of digits) {
      const n = parseInt(d, 10);
      if (!Number.isNaN(n) && (max === null || n > max)) max = n;
    }
  }
  for (const [kelime, deger] of Object.entries(TR_SAYI_KELIMELERI)) {
    const re = new RegExp(`(^|[^a-zçğıöşü])${kelime}([^a-zçğıöşü]|$)`, 'i');
    if (re.test(lower) && (max === null || deger > max)) max = deger;
  }
  return max;
}

async function runHousekeepingBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin housekeeping (kat hizmetleri) departmani asistanisin.${contextBlock}
Gorev: Misafirin temizlik, havlu, carsaf, oda duzeni, ekstra malzeme (sabun, sampuan, tuvalet kagidi vb.) taleplerini nazikce, kisa ve net yanitla.

HAVLU/MALZEME KURALI:
- Standart hak (kisi basi): 1 banyo (buyuk) + 1 yuz (kucuk) + 1 ayak havlusu. Bir turden kisi basi 1 veya 2 adet normaldir.
- Misafir tur veya adet belirtmediyse, once nazikce hangi turden kac adet istedigini sor.
- Net ve makul talebi sicak, kisa, net karsila. Miktar/adet pazarligi YAPMA; miktarin asiri olup olmadigina SEN karar verme, sadece talebi anlayip yanitla.

Bilmediginde: "Kat hizmetleri ekibimiz en kisa surede ilgilenecektir, lutfen resepsiyondan da destek alabilirsiniz."
Kapsam disinda (teknik ariza, yemek, animasyon vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
Her zaman Turkce yaz; kisa ve oz tut.

KAPANIS KURALI:
- Yanitlarinda hicbir emoji kullanma.
- Yaniti kisa ve sicak bir cumleyle bitir.
- "Ihtiyaciniz olursa bildirin", "baska bir sey olursa soyleyin" gibi bos/dolgu/tekrarli kapanis cumlesi EKLEME; misafir zaten talebini iletti. Kapanis dolu ve baglama uygun olsun.`;
  // Deterministik asiri talep kapisi: miktar karari kodda, LLM'de DEGIL.
  const maxQty = extractMaxItemQuantity(input.guestMessage);
  if (maxQty !== null && maxQty >= 3) {
    return {
      handled: true,
      replyText: 'Talebinizi ekibimize ilettim, en kısa sürede değerlendirip size dönüş yapacaklardır.',
      overLimit: true,
    };
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: input.guestMessage }],
  });
  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText, overLimit: false };
}

async function runAnimationBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BİLGİLERİ:\n${ctxParts.join('\n\n')}` : '';
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

async function runSpaBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin spa & wellness departmani asistanisin.${contextBlock}
Gorev: Misafirin spa, masaj, sauna, hamam, buhar odasi, cilt bakimi ve rezervasyon sorularini nazikce, sicak ve kisa yanitla.
- Calisma saatleri, masaj turleri, rezervasyon ve genel spa bilgilerini ver.
- Misafir hizmet turu veya saat belirtmediyse, once nazikce hangi hizmeti ve hangi saati istedigini sor.
Bilmediginde: "Spa ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan da destek alabilirsiniz."
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
  const lowerMsg = input.guestMessage.toLowerCase();
  const reservationNotify = ['rezervasyon', 'randevu', 'rezerve'].some((k) =>
    lowerMsg.includes(k),
  );
  return { handled: true, replyText, reservationNotify };
}

async function runFrontOfficeBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin on buro (resepsiyon) departmani asistanisin.${contextBlock}
Gorev: Misafirin on buro / resepsiyon konularini nazikce, kisa ve net yanitla. Kapsam: oda anahtari/kart, bagaj, transfer/taksi, uyandirma servisi, fatura, genel otel bilgisi, gec cikis ve oda degisikligi yonlendirmesi.
- Misafirin talebi net degilse, once nazikce ne istedigini sor.
- Net ve makul talebi sicak, kisa, net karsila.
Bilmediginde veya panelde bilgi yoksa UYDURMA: "On buro ekibimiz en kisa surede size yardimci olacaktir." de.
Kimlik/oda/cikis dogrulamasi gerektiren islemleri on buroya yonlendir.
Kapsam disinda (teknik ariza, temizlik, yemek, spa, animasyon): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
Her zaman Turkce yaz; kisa ve oz tut, en fazla 4 cumle.

KAPANIS KURALI:
- Yanitlarinda hicbir emoji kullanma.
- "Ihtiyaciniz olursa bildirin" gibi bos/dolgu kapanis cumlesi EKLEME.`;

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
  if (input.department === 'housekeeping') return runHousekeepingBrain(input);
  if (input.department === 'spa') return runSpaBrain(input);
  if (input.department === 'front_office') return runFrontOfficeBrain(input);
  return { handled: false };
}
