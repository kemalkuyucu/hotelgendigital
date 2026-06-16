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
    model: 'claude-sonnet-4-6',
    reasoningDepth: 'high',
    guardrail: 'standard',
  },
  technical: {
    department: 'technical',
    model: 'claude-haiku-4-5',
    reasoningDepth: 'medium',
    guardrail: 'standard',
  },
  guest_relation: {
    department: 'guest_relation',
    model: 'claude-sonnet-4-6',
    reasoningDepth: 'high',
    guardrail: 'standard',
  },
  fb: {
    department: 'fb',
    model: 'claude-sonnet-4-6',
    reasoningDepth: 'high',
    guardrail: 'standard',
  },
};

export interface DepartmentBrainInput {
  department: string;
  requestText: string;
  guestMessage: string;
  hotelName: string;
  hotelContext?: Record<string, unknown> | null;
  conversationContext?: { role: string; content: string }[] | null;
}

export interface DepartmentBrainResult {
  handled: boolean;        // false -> orkestratorun kendi yaniti kullanilir
  replyText?: string;
  overLimit?: boolean;
  reservationNotify?: boolean;
  hasQuantity?: boolean;
  normalizedRequest?: string;
}

// Passthrough dispatcher. Bayrak KAPALI veya kayitli beyin yoksa handled=false.
const TR_SAYI_KELIMELERI: Record<string, number> = {
  bir: 1, iki: 2, 'üç': 3, uc: 3, 'dört': 4, dort: 4, 'beş': 5, bes: 5,
  'altı': 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  yirmi: 20, otuz: 30, 'kırk': 40, kirk: 40, elli: 50,
};

const HOUSEKEEPING_ITEM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /banyo\s*havlu/i, label: 'banyo havlusu' },
  { re: /(yuz|yüz)\s*havlu/i, label: 'yuz havlusu' },
  { re: /ayak\s*havlu/i, label: 'ayak havlusu' },
  { re: /havlu/i, label: 'havlu' },
  { re: /(carsaf|çarşaf|nevresim)/i, label: 'carsaf' },
  { re: /yastik|yastık/i, label: 'yastik' },
  { re: /battaniye/i, label: 'battaniye' },
  { re: /(sabun|sampuan|şampuan|dus jeli|duş jeli)/i, label: 'banyo malzemesi' },
  { re: /(tuvalet kagidi|tuvalet kağıdı)/i, label: 'tuvalet kagidi' },
];

function buildHousekeepingSummary(convText: string, qty: number | null): string | null {
  if (qty === null) return null;
  for (const p of HOUSEKEEPING_ITEM_PATTERNS) {
    if (p.re.test(convText)) return `${qty} ${p.label}`;
  }
  return null;
}

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
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Misafir hangi dilde yazdiysa AYNI dilde yanitla; kisa ve oz tut.

DURUM KURALI:
- Kat hizmetleri talebi DOGRUDAN ekibe iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" veya "teslim edilecektir" gibi ifadelerle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.

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

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  // Adet netleştiyse kart metnini deterministik uret (ham son mesaj yerine "2 yuz havlusu").
  // Tum konusma + son mesaj birlesik taranir; tur kelimesi + adet eslestirilir.
  const convForSummary = [
    ...(input.conversationContext ?? []).map((m) => m.content),
    input.guestMessage,
  ].join(' ');
  const normalizedRequest = maxQty !== null
    ? (buildHousekeepingSummary(convForSummary, maxQty) ?? undefined)
    : undefined;
  return { handled: true, replyText, overLimit: false, hasQuantity: maxQty !== null, normalizedRequest };
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

DURUM KURALI:
- Talep DOGRUDAN animasyon ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin animasyon, etkinlik, cocuk kulubu, gece programi ve eglence sorularini nazikce, kisa ve net yanıtla.
Bilmediginde: "Animasyon ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan sorabilirsiniz."
Kapsam disinda (oda, teknik, yemek vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Misafir hangi dilde yazdiysa AYNI dilde yanitla. Maksimum 3 cumle.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
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

DURUM KURALI:
- Talep DOGRUDAN spa ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin spa, masaj, sauna, hamam, buhar odasi, cilt bakimi ve rezervasyon sorularini nazikce, sicak ve kisa yanitla.
- Calisma saatleri, masaj turleri, rezervasyon ve genel spa bilgilerini ver.
- Misafir hizmet turu veya saat belirtmediyse, once nazikce hangi hizmeti ve hangi saati istedigini sor.
Bilmediginde: "Spa ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan da destek alabilirsiniz."
Kapsam disinda (oda, teknik, yemek vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Misafir hangi dilde yazdiysa AYNI dilde yanitla. Maksimum 3 cumle.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
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
  const system = `Sen ${input.hotelName} otelinin on buro asistanisin. Sicak, profesyonel ve cozum odakli bir insan gibi konusursun. Misafirin talebiyle bizzat sen ilgilenirsin.${contextBlock}

Calisma ilkelerin:
- Misafiri asla baska bir yere (resepsiyon, telefon, mail) yonlendirmezsin; talebi sen ele alirsin.
- Operasyonel talepler (bagaj, transfer, uyandirma, oda ile ilgili eylemler) ekibe arka planda OTOMATIK iletilir. Bu senin gorevin degil, sistem hallediyor. Misafire ekibin en kisa surede ilgilenecegini sicakca bildir.
- Misafir talebini iletti; onay isteme, "iletmemi ister misiniz" gibi soru sorma. Is yola cikmistir.
- Misafir zaten dogrulanmis; oda numarasi ve kimligi sistemde mevcut. ASLA isim, soyisim, oda numarasi, telefon veya kimlik bilgisi isteme; bu bilgiler sende var.
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan talebi ele alan cumleyle basla.
- "Sahipleniyorum" gibi yapay/resmi kaliplar KULLANMA. Gercek bir on buro gorevlisi gibi dogal konus: ornek ton -> "Tabii ki, bagajinizi odaniza birakmalari icin hemen on buro ekibine ilettim, en kisa surede gelip alacaklar."
- Bilgi sorularini (hizmet, saat vb.) otel bilgilerinden yanitla. Bilgi yoksa uydurma; "On buro ekibimiz en kisa surede yardimci olacaktir." de.
- Kapsam disi konular (teknik ariza, temizlik, yemek, spa, animasyon) icin misafiri ilgili departmana yonlendir.

KAPANIS KURALI:
- Hicbir emoji kullanma.
- Yaniti kisa, sicak ve guven verici bir cumleyle bitir.
- "Ihtiyaciniz olursa bildirin" gibi bos/dolgu kapanis cumlesi EKLEME.
Misafir hangi dilde yazdiysa AYNI dilde yanitla; kisa ve oz tut.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{ role: 'user' as const, content: userContent }],
    });
  } catch {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{ role: 'user' as const, content: input.guestMessage }],
    });
  }

  const block = response.content.find((b) => b.type === 'text');
  let replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText };
}

async function runTechnicalBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin teknik servis departmani asistanisin. Sicak, profesyonel ve cozum odakli bir insan gibi konusursun. Misafirin bildirdigi ariza veya sorunla bizzat sen ilgilenirsin.${contextBlock}

DURUM KURALI:
- Ariza/talep DOGRUDAN teknik ekibe iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" veya "giderilecektir" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin odasindaki veya oteldeki teknik sorunlari (klima, isitma, sicak su, elektrik, aydinlatma, televizyon, internet/wifi, tesisat ve su kacagi, kapi/kilit, mobilya arizasi vb.) anlayip nazikce, kisa ve guven verici sekilde yanitla.

Calisma ilkelerin:
- Misafiri baska bir yere yonlendirme. Arizayi anladigini sicak, sade, gunluk bir dille belirt.
- Ariza talebi teknik ekibe arka planda OTOMATIK iletilir; bu senin gorevin degil, sistem hallediyor. Misafire ekibin en kisa surede ilgilenecegini sicakca bildir.
- Misafir sorunu bildirdiyse is yola cikmistir; onay isteme, "iletmemi ister misiniz" gibi soru sorma.
- Bilgi sorularini otel bilgilerinden yanitla. Bilgi yoksa uydurma; "Teknik ekibimiz en kisa surede ilgilenecektir." de.
- Kapsam disi konular (temizlik ve havlu, yemek, spa, animasyon) icin misafiri ilgili departmana yonlendir.
- Misafir zaten dogrulanmis; oda numarasi ve kimligi sistemde mevcut. ASLA oda numarasi, telefon numarasi veya kimlik bilgisi isteme; bu bilgiler sende var.
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan sorunu sahiplenen cumleyle basla.
- ASLA cozum, talimat veya tavsiye verme. "Suyu kapatin", "muslugu kapatin", "kapiyi acik tutun", "akisin siddeti nasil" gibi yonlendirme YAPMA. Senin isin sadece anlamak ve ilettigini soylemek; mudahaleyi teknik ekip yapar.
- "Sahipleniyorum", "ziyaret edecek" gibi yapay/resmi kaliplar KULLANMA. Gercek bir resepsiyon gorevlisi gibi dogal konus: ornek ton -> "Anladim, lavabonuz akiyor. Hemen teknik ekibe ilettim, en kisa surede odaniza gelip bakacaklar."

KAPANIS KURALI:
- Hicbir emoji kullanma.
- Yaniti kisa, sicak ve guven verici bir cumleyle bitir.
- "Ihtiyaciniz olursa bildirin" gibi bos/dolgu kapanis cumlesi EKLEME; misafir zaten sorunu iletti.
Misafir hangi dilde yazdiysa AYNI dilde yanitla; kisa ve oz tut.`;
  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText };
}

async function runGuestRelationBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin misafir iliskileri departmani asistanisin. Empatik, sakin, nazik ve diplomatik bir insan gibi konusursun. Misafirin sikayeti, memnuniyetsizligi veya ozel istegiyle bizzat sen ilgilenirsin.${contextBlock}

DURUM KURALI:
- Konu/talep DOGRUDAN misafir iliskileri ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel konuyu/talebi karsila.
Gorev: Misafirin sikayet/memnuniyetsizlik, ozur gerektiren durum, ozel istek (kutlama, yildonumu, balayi, surpriz) veya genel memnuniyet konularini anlayip nazikce, kisa ve guven verici sekilde yanitla.

Calisma ilkelerin:
- ONCE EMPATI: misafirin duygusunu tani ve sahiplen (ornek: yasadiginiz bu durum icin cok uzgunum). Once duyguyu karsila, sonra cozume gec.
- Misafiri baska bir yere (resepsiyon, telefon) yonlendirme; konuyu misafir iliskileri ekibi olarak sen sahiplenirsin.
- Talep ekibe arka planda OTOMATIK iletilir; onay isteme, "iletmemi ister misiniz" gibi soru sorma. Ekibin en kisa surede ilgilenecegini sicakca bildir.
- Bilgi sorularini otel bilgilerinden yanitla. Bilgi yoksa uydurma; "Ekibimiz en kisa surede sizinle ilgilenecektir." de.

KESIN YASAKLAR (cok onemli):
- Telafi, tazminat, iade, indirim, ucretsiz hizmet, oda yukseltme, hediye gibi HICBIR maddi soz verme veya ima etme. Bunun yerine "Ekibimiz durumu degerlendirecek" de; asla taahhut etme.
- Sure veya sonuc garantisi verme (ornek: kesin hallolur, X dakikada). "Ilettim, en kisa surede ilgilenecekler" de.
- Otel veya personel adina sorumluluk doguracak itirafta bulunma; suclama yapma. Sadece duyguyu tani ve konuyu ekibe ilettigini soyle.

KAPANIS:
- Hicbir emoji kullanma. Yaniti kisa (en fazla 3-4 cumle), sicak ve guven verici tut.
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
- DIL: Misafir hangi dilde yazdiysa AYNI dilde yanitla.`;
  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText };
}

async function runFbBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const client = new Anthropic();
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `Sen ${input.hotelName} otelinin F&B (yiyecek-icecek / restoran) departmani asistanisin.${contextBlock}

DURUM KURALI:
- Talep DOGRUDAN F&B ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin restoran, menu, kahvalti/aksam yemegi saatleri, yemek secenekleri ile ilgili sorularini sicak, kisa ve net yanitla.

YUKSEK RISK - ALERJEN/ICERIK (cok onemli):
- Glutensiz mi, findik/fistik var mi, laktoz var mi gibi ALERJEN/ICERIK sorularinda ASLA kesin "vardir/yoktur/g' guvenli" deme.
- Boyle sorularda: "Bu konuda mutfak ekibimiz kesin bilgi verecektir, alerjinizi bizimle paylasirsaniz ilgili ekibi haberdar ederiz" gibi yonlendir. Alerji kaydini/bildirimini SEN yapma; sistem ayri yapiyor.

BILGI KURALI:
- Sadece OTEL BILGILERI icinde acikca yazani soyle. Saat/fiyat/menu icerigi orada yoksa UYDURMA.
- Bilgi yoksa: "Bu konuda restoran/resepsiyon ekibimiz kesin bilgi verecektir."

KAPSAM:
- Teknik ariza, temizlik, animasyon vb. kapsam disi: "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."

- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
DIL: Misafir hangi dilde yazdiysa AYNI dilde yanitla.

KAPANIS:
- Hicbir emoji kullanma.
- Kisa, sicak, baglama uygun bitir. Bos/dolgu/tekrarli kapanis cumlesi EKLEME.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const block = response.content.find((b) => b.type === 'text');
  const replyText = block && block.type === 'text' ? block.text.trim() : '';
  return { handled: true, replyText, overLimit: false };
}

// ── BEYINCIK (Asama 2) — departman refleks/guardrail katmani ──────────────────
// Merkezi mekanizma, dagitik icerik: tek calistirici, her departman kendi
// refleksini config.guardrail sikiliginda calistirir. null = gec (beyne devam),
// non-null = refleks kesti. Safety'nin "forward oncesi kapi" deseninin
// departman-bazli karsiligi. ISKELET: simdilik tum departmanlar null (davranis DEGISMEZ).
async function runDepartmentBeyincik(
  input: DepartmentBrainInput,
  config: DepartmentBrainConfig,
): Promise<DepartmentBrainResult | null> {
  void input;
  void config;
  return null;
}

export async function dispatchToDepartmentBrain(
  input: DepartmentBrainInput,
): Promise<DepartmentBrainResult> {
  if (!DEPARTMENT_BRAINS_ENABLED) return { handled: false };
  const config = DEPARTMENT_BRAIN_REGISTRY[input.department];
  if (!config) return { handled: false };
  const reflex = await runDepartmentBeyincik(input, config);
  if (reflex) return reflex;
  if (input.department === 'animation') return runAnimationBrain(input);
  if (input.department === 'housekeeping') return runHousekeepingBrain(input);
  if (input.department === 'spa') return runSpaBrain(input);
  if (input.department === 'front_office') return runFrontOfficeBrain(input);
  if (input.department === 'technical') return runTechnicalBrain(input);
  if (input.department === 'guest_relation') return runGuestRelationBrain(input);
  if (input.department === 'fb') return runFbBrain(input);
  return { handled: false };
}
