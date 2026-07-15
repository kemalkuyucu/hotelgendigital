import { callAI } from './anthropic-client';
import { enforceReplyLanguage } from './enforce-reply-language';
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

// Housekeeping coklu esya. Brain mesajdaki her esyayi (kod + per-item adet +
// belirsizlik) cikarir; route.ts/callback state kurup butonla tip/adet sorar,
// forward YAPILMAZ. code=belirlenmis esya kodu; qty=adet (null -> sorulacak);
// ambiguous=tip belirsiz (havlu); typeCodes=belirsizse secilecek tipler.
export interface HkItem { code: number; qty: number | null; ambiguous: boolean; typeCodes?: number[] }

export interface DepartmentBrainResult {
  handled: boolean;        // false -> orkestratorun kendi yaniti kullanilir
  replyText?: string;
  overLimit?: boolean;
  reservationNotify?: boolean;
  hasQuantity?: boolean;
  requiresQuantity?: boolean;
  normalizedRequest?: string;
  isInfoOnly?: boolean;
  hkItems?: HkItem[];
}

// ── DIL KURALI — tum beyinlerde ortak ────────────────────────────────────────
// Orkestratordeki (system-prompts.ts) DIL KURALI blogunun beyin surumu. Beyin
// prompt'lari Turkce yazili oldugu icin model yabanci misafire de Turkce
// yanit veriyordu; olcut tek basina misafirin dilidir.
export const LANGUAGE_RULE = `=== EN ÖNCELİKLİ KURAL — DİL ===

ADIM 0: Misafirin ORİJİNAL mesajı hangi dildeyse SADECE o dilde yanıtla. Bu kural diğer her şeyin üstündedir.
Bu prompt Türkçe yazılmış olsa bile bu seni ETKİLEMEZ; ölçüt yalnızca misafirin dilidir. Otel bilgileri de Türkçe yazılıdır — onları misafirin diline ÇEVİREREK aktar.

Diller ve örnek ton:
- Türkçe: "Havuzumuz 09:00'da açılır."
- English: "Our pool opens at 09:00."
- Deutsch: "Unser Pool öffnet um 09:00 Uhr."
- Русский: "Наш бассейн открывается в 09:00."
- العربية: "يفتح مسبحنا في الساعة 09:00."
- Français: "Notre piscine ouvre à 09:00."
- Español: "Nuestra piscina abre a las 09:00."

EK KURALLAR:
- Özel isimleri ÇEVİRME: otel adı, şehir adı, kişi adı, Wi-Fi ağ adı, şifre aynen kalır.
- Misafir dilleri karıştırırsa daha çok kullandığı dile göre yanıtla.
- Misafir çok kısa veya tek kelime yazdıysa Türkçe varsay.
- Türkçe yanıt verirken TAM Türkçe karakter kullan (ç ğ ı ö ş ü / Ç Ğ İ Ö Ş Ü). ASCII karşılıklarını KULLANMA: "gorseller" değil "görseller", "kisi" değil "kişi", "Agustos" değil "Ağustos".`;

// Beyin prompt'unun basina giren dil blogu. Misafirin HAM mesaji system prompt
// govdesine de yazilir — dil karari yalnizca user turn'e birakilmaz.
function languageBlock(guestMessage: string): string {
  return `${LANGUAGE_RULE}\n\nMİSAFİRİN ORİJİNAL MESAJI: "${guestMessage}"\n\n`;
}

// Passthrough dispatcher. Bayrak KAPALI veya kayitli beyin yoksa handled=false.
const TR_SAYI_KELIMELERI: Record<string, number> = {
  bir: 1, iki: 2, 'üç': 3, uc: 3, 'dört': 4, dort: 4, 'beş': 5, bes: 5,
  'altı': 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  yirmi: 20, otuz: 30, 'kırk': 40, kirk: 40, elli: 50,
};

export type HousekeepingItem = { re: RegExp; label: string; code: number; ambiguous: boolean; typeCodes?: number[] };
export const HOUSEKEEPING_ITEM_PATTERNS: HousekeepingItem[] = [
  { re: /banyo\s*havlu/i, label: 'banyo havlusu', code: 1, ambiguous: false },
  { re: /(yuz|yüz)\s*havlu/i, label: 'yuz havlusu', code: 2, ambiguous: false },
  { re: /ayak\s*havlu/i, label: 'ayak havlusu', code: 3, ambiguous: false },
  { re: /havlu/i, label: 'havlu', code: 4, ambiguous: true, typeCodes: [1, 2, 3] },
  { re: /(nevresim|yorgan)/i, label: 'nevresim', code: 5, ambiguous: false },
  { re: /(carsaf|çarşaf)/i, label: 'carsaf', code: 6, ambiguous: false },
  { re: /yastik|yastık/i, label: 'yastik', code: 7, ambiguous: false },
  { re: /battaniye/i, label: 'battaniye', code: 8, ambiguous: false },
  { re: /sabun/i, label: 'sabun', code: 9, ambiguous: false },
  { re: /(sampuan|şampuan)/i, label: 'sampuan', code: 10, ambiguous: false },
  { re: /(dus jeli|duş jeli)/i, label: 'dus jeli', code: 11, ambiguous: false },
  { re: /(tuvalet kagidi|tuvalet kağıdı)/i, label: 'tuvalet kagidi', code: 12, ambiguous: false },
];

// hk-gate SERVICE fiilleri: esya ICERMEYEN kat-hizmetleri talepleri (temizlik/toplama).
// KRITIK: SADECE hk-gate'te kullanilir; requiresQuantity / matchHousekeepingLabel'a
// ASLA girmez (yoksa "kac adet temizlik?" der).
export const HOUSEKEEPING_SERVICE_PATTERNS: RegExp[] = [
  /oda(m|mi|nin)?\s*temizl/i,
  /temizlik\s*(istiyorum|talep|gonder)/i,
  /odam(i)?\s*(toplay|duzelt)/i,
  /çarşaf\s*degis/i,
  /carsaf\s*degis/i,
];

// Tek bir metinde HOUSEKEEPING_ITEM_PATTERNS icinden ILK eslesen PATTERN'i doner (liste sirasi).
function matchHousekeepingItem(text: string): HousekeepingItem | null {
  for (const p of HOUSEKEEPING_ITEM_PATTERNS) {
    if (p.re.test(text)) return p;
  }
  return null;
}

// Etiket kestirmesi (buildHousekeepingSummary / requiresQuantity icin).
function matchHousekeepingLabel(text: string): string | null {
  return matchHousekeepingItem(text)?.label ?? null;
}

// Kod -> etiket (housekeeping callback'te kart metni icin).
export function labelForHousekeepingCode(code: number): string | null {
  return HOUSEKEEPING_ITEM_PATTERNS.find((p) => p.code === code)?.label ?? null;
}

// Kart ozeti SADECE guncel misafir mesajindan uretilir. Gecmis TARANMAZ: butonlar
// geldigi icin coklu-turlu metin akisi ("havlu" -> "kac adet?" -> "2 tane") artik
// yok; gecmis fallback'i yalnizca stale eslesme (nevresim/temizlik bug'i) uretiyordu.
function buildHousekeepingSummary(currentMessage: string, qty: number | null): string | null {
  if (qty === null) return null;
  const label = matchHousekeepingLabel(currentMessage);
  return label ? `${qty} ${label}` : null;
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

// Bir esyanin start'indan ONCEKI son 20 karakterdeki EN SON sayiyi cikarir (per-item adet).
// once /\d+/g son eslesme; yoksa TR_SAYI_KELIMELERI kelime siniri regexi ile son eslesme.
// extractMaxItemQuantity DEGIL (o global max doner) — coklu esyada her esyanin kendi adedi.
function extractQtyBefore(text: string, start: number): number | null {
  const window = String(text ?? '').slice(Math.max(0, start - 20), start);
  const lower = window.toLocaleLowerCase('tr-TR');
  const digitMatches = lower.match(/\d+/g);
  if (digitMatches && digitMatches.length > 0) {
    const n = parseInt(digitMatches[digitMatches.length - 1], 10);
    if (!Number.isNaN(n)) return n;
  }
  let last: number | null = null;
  let lastPos = -1;
  for (const [kelime, deger] of Object.entries(TR_SAYI_KELIMELERI)) {
    const re = new RegExp(`(^|[^a-zçğıöşü])${kelime}([^a-zçğıöşü]|$)`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      if (m.index > lastPos) {
        lastPos = m.index;
        last = deger;
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return last;
}

// Bir metindeki TUM housekeeping esyalarini per-item adetle cikarir (coklu esya).
// - Her pattern icin global regex ile TUM occurrence'lari topla (start/end ile).
// - ORTUSME ELEME: daha UZUN bir bulusla kesisen KISA bulus atilir (banyo havlusu -> code 1,
//   code 4 elenir).
// - start'a gore sirala; AYNI code birden fazla kalirsa ILKINI tut.
// - Her bulus icin start oncesi 20 karakterden per-item adet (extractQtyBefore).
export function matchHousekeepingItems(text: string): HkItem[] {
  const src = String(text ?? '');
  type Found = { code: number; ambiguous: boolean; typeCodes?: number[]; start: number; end: number };
  const found: Found[] = [];
  for (const p of HOUSEKEEPING_ITEM_PATTERNS) {
    const re = new RegExp(p.re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      found.push({
        code: p.code,
        ambiguous: p.ambiguous,
        typeCodes: p.typeCodes,
        start: m.index,
        end: m.index + m[0].length,
      });
      if (m.index === re.lastIndex) re.lastIndex++; // sifir-uzunluk korumasi
    }
  }
  // ORTUSME ELEME: a, kendisinden daha UZUN bir b ile kesisiyorsa (kisa) a atilir.
  const kept = found.filter((a) =>
    !found.some((b) => {
      if (b === a) return false;
      const overlap = a.start < b.end && b.start < a.end;
      if (!overlap) return false;
      return b.end - b.start > a.end - a.start;
    }),
  );
  kept.sort((x, y) => x.start - y.start);
  const seen = new Set<number>();
  const uniq = kept.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
  return uniq.map((f) => ({
    code: f.code,
    ambiguous: f.ambiguous,
    typeCodes: f.typeCodes,
    qty: extractQtyBefore(src, f.start),
  }));
}

async function runHousekeepingBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin housekeeping (kat hizmetleri) departmani asistanisin.${contextBlock}
Gorev: Misafirin temizlik, havlu, carsaf, oda duzeni, ekstra malzeme (sabun, sampuan, tuvalet kagidi vb.) taleplerini nazikce, kisa ve net yanitla.

HAVLU/MALZEME KURALI:
- Standart hak: kisi basi 1 adet.
- Net ve makul talebi sicak, kisa, net karsila. Miktar/adet pazarligi YAPMA; miktarin asiri olup olmadigina SEN karar verme, sadece talebi anlayip yanitla.

TALEP CEVABI KURALI:
- Bilgi tabanindaki ek detaylari (standart donanim, adet politikasi, ucret vb.) SADECE misafir acikca sordugunda ver; talep cevabina kendiliginden EKLEME.
- Ornek dogru talep cevabi: "Havlu talebiniz alindi, kat hizmetleri ekibimiz en kisa surede odaniza getirecektir."

Bilmediginde: "Kat hizmetleri ekibimiz en kisa surede ilgilenecektir, lutfen resepsiyondan da destek alabilirsiniz."
Kapsam disinda (teknik ariza, yemek, animasyon vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Kisa ve oz tut.

DURUM KURALI:
- Kat hizmetleri talebi DOGRUDAN ekibe iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" veya "teslim edilecektir" gibi ifadelerle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.

KAPANIS KURALI:
- Yanitlarinda hicbir emoji kullanma.
- Yaniti kisa ve sicak bir cumleyle bitir.
- "Ihtiyaciniz olursa bildirin", "baska bir sey olursa soyleyin" gibi bos/dolgu/tekrarli kapanis cumlesi EKLEME; misafir zaten talebini iletti. Kapanis dolu ve baglama uygun olsun.`;
  // overLimit karari kart katmaninda: qty > pax (kisi basi 1), housekeeping-forward.ts.
  const maxQty = extractMaxItemQuantity(input.guestMessage);

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await callAI({
    tier: 'standard',
    maxTokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const replyText = response.text;
  // Kart ozeti + esya kararlari SADECE guncel mesajdan. Gecmis TARANMAZ (butonlar
  // geldigi icin coklu-turlu metin akisi yok; gecmis fallback'i stale esya uretiyordu).
  const normalizedRequest = maxQty !== null
    ? (buildHousekeepingSummary(input.guestMessage, maxQty) ?? undefined)
    : undefined;
  // Adet kapisi yalnizca SAYILABILIR esyalar icin gecerli olsun — sadece guncel mesaj.
  const requiresQuantity = matchHousekeepingItem(input.guestMessage) !== null;
  // DETERMINISTIK COKLU-ESYA KAPISI: mesajdaki TUM esyalari cikar. En az bir esya
  // varsa LLM cevabi KULLANILMAZ; route.ts state kurup butonla tip/adet sorar.
  // Forward zaten kesiliyor (requiresQuantity=true + hasQuantity=false -> shouldForward=false).
  const hkItems = matchHousekeepingItems(input.guestMessage);
  if (hkItems.length > 0) {
    return {
      handled: true,
      replyText: '',
      overLimit: false,
      hasQuantity: false,
      requiresQuantity: true,
      normalizedRequest: undefined,
      hkItems,
    };
  }
  return { handled: true, replyText, overLimit: false, hasQuantity: maxQty !== null, requiresQuantity, normalizedRequest };
}

async function runAnimationBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BİLGİLERİ:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin animasyon departmani asistanisin.${contextBlock}

DURUM KURALI:
- Talep DOGRUDAN animasyon ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin animasyon, etkinlik, cocuk kulubu, gece programi ve eglence sorularini nazikce, kisa ve net yanıtla.
Bilmediginde: "Animasyon ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan sorabilirsiniz."
Kapsam disinda (oda, teknik, yemek vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Maksimum 3 cumle.

CIKTI BICIMI: Yanitini SADECE su JSON olarak ver, baska metin/markdown YOK:
{"reply": "misafire gidecek cevap", "infoOnly": true veya false}
infoOnly=true: saf bilgi/sohbet (etkinlik saati, program sorusu, ne var ne yok). Animasyon bolumu tamamen bilgi-sohbettir; neredeyse her zaman infoOnly=true.
infoOnly=false: SADECE misafir somut bir aksiyon/ozel istek/sikayet iletiyorsa (orn. 'su etkinlige beni yazdir', 'cocugum icin yer ayirt'). Animasyonda suphede true yaz (bilgi kabul et), cunku bu bolum bilgi agirliklidir.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await callAI({
    tier: 'standard',
    maxTokens: 400,
    system,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
  });

  const raw = response.text;
  // FB beyniyle ayni kalip: brain JSON dondurur { reply, infoOnly }.
  // infoOnly=true => saf bilgi/sohbet (kart dusmez). Parse basarisizsa duz metin + infoOnly=false (guvenli taraf).
  let replyText = raw;
  let isInfoOnly = false;
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === 'string') {
      replyText = parsed.reply.trim();
      isInfoOnly = parsed.infoOnly === true;
    }
  } catch {
    replyText = raw;
    isInfoOnly = false;
  }
  return { handled: true, replyText, overLimit: false, isInfoOnly };
}

async function runSpaBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin spa & wellness departmani asistanisin.${contextBlock}

DURUM KURALI:
- Talep DOGRUDAN spa ekibine iletilir. Talebi ASLA "resepsiyon onayi bekleniyor", "onaylandiginda haber verecegim" gibi durum ifadeleriyle nitelendirme. Konusma gecmisindeki dogrulama/onay/resepsiyon mesajlarini ORNEK ALMA, tekrarlama; sadece guncel talebi karsila.
Gorev: Misafirin spa, masaj, sauna, hamam, buhar odasi, cilt bakimi taleplerini nazikce ve kisa karsila.
- Genel spa bilgisi (hizmet turleri, calisma saatleri) verebilirsin.
- REZERVASYON/RANDEVU KURALI (KESIN): Saat veya rezervasyon ONAYI VEREMEZSIN. "Yarin 15:00 uygundur", "ayarladim", "rezerve ettim", "olur", "musait" gibi ifadeler YASAK. Misafir bir saat/randevu istese bile ASLA onaylama. Bunun yerine sicak ve nazik bir mesaj kur ve su uc seyi mutlaka soyle: (1) talebi/tercih edilen saati spa yetkilisine ilettigini, (2) o saatte rezervasyonlar dolu olabilecegi icin en saglikli yolun birebir gorusme oldugunu, yetkilinin en kisa surede telefonla veya yuz yuze iletisime gececegini, (3) kibar bir kapanis (ornegin keyifli/iyi tatiller dilegi ve otel adi). Tum randevular yalnizca spa ekibiyle birebir netlesir.
Bilmediginde: "Spa ekibimiz size en dogru bilgiyi verecektir, lutfen resepsiyondan da destek alabilirsiniz."
Kapsam disinda (oda, teknik, yemek vb.): "Bu konuda size yardimci olamam, ilgili departmana yonlendirilmenizi onerim."
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.
Maksimum 3 cumle.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await callAI({
    tier: 'standard',
    maxTokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  const replyText = response.text;
  const lowerMsg = input.guestMessage.toLowerCase();
  const reservationNotify = ['rezervasyon', 'randevu', 'rezerve'].some((k) =>
    lowerMsg.includes(k),
  );
  return { handled: true, replyText, reservationNotify };
}

async function runFrontOfficeBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts, ctx.locationInfo].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin on buro asistanisin. Sicak, profesyonel ve cozum odakli bir insan gibi konusursun. Misafirin talebiyle bizzat sen ilgilenirsin.${contextBlock}

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
Kisa ve oz tut.`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  let replyText: string;
  try {
    const response = await callAI({
      tier: 'advanced',
      maxTokens: 300,
      system,
      messages: [{ role: 'user' as const, content: userContent }],
    });
    replyText = response.text;
  } catch {
    const response = await callAI({
      tier: 'advanced',
      maxTokens: 300,
      system,
      messages: [{ role: 'user' as const, content: input.guestMessage }],
    });
    replyText = response.text;
  }
  return { handled: true, replyText };
}

async function runTechnicalBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin teknik servis departmani asistanisin. Sicak, profesyonel ve cozum odakli bir insan gibi konusursun. Misafirin bildirdigi ariza veya sorunla bizzat sen ilgilenirsin.${contextBlock}

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
- "Sahipleniyorum", "ziyaret edecek" gibi yapay/resmi kaliplar KULLANMA. Gercek bir resepsiyon gorevlisi gibi dogal konus.
- Örnek yanıt yapısı (misafirin DİLİNDE üret, bu Türkçe örneği kopyalama):
  arızayı anladığını belirt + teknik ekibe iletildiğini söyle + kısa güvence.

KAPANIS KURALI:
- Hicbir emoji kullanma.
- Yaniti kisa, sicak ve guven verici bir cumleyle bitir.
- "Ihtiyaciniz olursa bildirin" gibi bos/dolgu kapanis cumlesi EKLEME; misafir zaten sorunu iletti.
Kisa ve oz tut.`;
  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  // Dil kilidi user turn'un EN BASINDA + misafirin mesajinin hemen USTUNDE:
  // system prompt Turkce oldugu icin model yabanci mesaja da Turkce yanit veriyordu.
  const langLock = `[YANIT DİLİ KURALI: Aşağıdaki misafir mesajı hangi dildeyse yanıtın SADECE o dilde olacak. İngilizce mesaja İngilizce, Almanca'ya Almanca, Türkçe'ye Türkçe. Bu system prompt Türkçe olsa bile seni bağlamaz.]\n\n`;
  const userContent = recent
    ? `${langLock}Önceki konuşma:\n${recent}\n\nMisafirin son mesajı: ${input.guestMessage}`
    : `${langLock}Misafirin son mesajı: ${input.guestMessage}`;
  const response = await callAI({
    tier: 'standard',
    maxTokens: 300,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const replyText = response.text;
  return { handled: true, replyText };
}

async function runGuestRelationBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin misafir iliskileri departmani asistanisin. Empatik, sakin, nazik ve diplomatik bir insan gibi konusursun. Misafirin sikayeti, memnuniyetsizligi veya ozel istegiyle bizzat sen ilgilenirsin.${contextBlock}

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
- Konusma zaten suruyor; cevaba "Merhaba", "Hos geldiniz" gibi selamlama EKLEME. Dogrudan konuya gir.`;
  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await callAI({
    tier: 'advanced',
    maxTokens: 400,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const replyText = response.text;
  return { handled: true, replyText };
}

async function runFbBrain(input: DepartmentBrainInput): Promise<DepartmentBrainResult> {
  const ctx = input.hotelContext as Record<string, string> | null;
  const ctxParts = ctx
    ? [ctx.hotelInfo, ctx.generalRules, ctx.knowledgeFacts].filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    : [];
  const contextBlock =
    ctxParts.length > 0 ? `\n\nOTEL BILGILERI:\n${ctxParts.join('\n\n')}` : '';
  const system = `${languageBlock(input.guestMessage)}Sen ${input.hotelName} otelinin F&B (yiyecek-icecek / restoran) departmani asistanisin.${contextBlock}

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

KAPANIS:
- Hicbir emoji kullanma.
- Kisa, sicak, baglama uygun bitir. Bos/dolgu/tekrarli kapanis cumlesi EKLEME.

CIKTI BICIMI (COK ONEMLI):
- Yanitini SADECE su JSON formatinda ver, baska hicbir metin/markdown ekleme:
  {"reply": "<misafire gidecek mesaj>", "infoOnly": <true|false>}
- infoOnly=true: misafir SADECE bilgi/sohbet sordu (yemek-icecek saatleri, menu, restoran konumu, genel soru). Aksiyon/talep/siparis YOK.
- infoOnly=false: misafir bir AKSIYON/TALEP/SIPARIS iletti (oda servisi siparisi, ozel istek, "su gonderin/getirin", rezervasyon talebi vb.) VEYA alerjen/icerik endisesi bildirdi.
- Suphede kalirsan infoOnly=false ver (guvenli taraf).`;

  const recent = (input.conversationContext ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Asistan' : 'Misafir'}: ${m.content.trim()}`)
    .join('\n');
  const userContent = recent
    ? `Onceki konusma:\n${recent}\n\nMisafirin son mesaji: ${input.guestMessage}`
    : input.guestMessage;
  const response = await callAI({
    tier: 'advanced',
    maxTokens: 400,
    system,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
  });
  const raw = response.text;
  // Brain JSON dondurur: { reply, infoOnly }. infoOnly=true => saf bilgi/sohbet (kart dusmez).
  let replyText = raw;
  let isInfoOnly = false;
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === 'string') {
      replyText = parsed.reply.trim();
      isInfoOnly = parsed.infoOnly === true;
    }
  } catch {
    // JSON degilse: duz metni reply kabul et, infoOnly=false (guvenli taraf: forward eder)
    replyText = raw;
    isInfoOnly = false;
  }
  return { handled: true, replyText, overLimit: false, isInfoOnly };
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

async function runBrainByDepartment(
  input: DepartmentBrainInput,
): Promise<DepartmentBrainResult> {
  if (input.department === 'animation') return runAnimationBrain(input);
  if (input.department === 'housekeeping') return runHousekeepingBrain(input);
  if (input.department === 'spa') return runSpaBrain(input);
  if (input.department === 'front_office') return runFrontOfficeBrain(input);
  if (input.department === 'technical') return runTechnicalBrain(input);
  if (input.department === 'guest_relation') return runGuestRelationBrain(input);
  if (input.department === 'fb') return runFbBrain(input);
  return { handled: false };
}

export async function dispatchToDepartmentBrain(
  input: DepartmentBrainInput,
): Promise<DepartmentBrainResult> {
  if (!DEPARTMENT_BRAINS_ENABLED) return { handled: false };
  const config = DEPARTMENT_BRAIN_REGISTRY[input.department];
  if (!config) return { handled: false };
  const reflex = await runDepartmentBeyincik(input, config);
  const result = reflex ?? (await runBrainByDepartment(input));

  // DIL KAPISI — 7 beyin de buradan doner. Beyin prompt'lari Turkce yazili oldugu
  // icin model yabanci misafire Turkce yanit verebiliyor; cevabi misafirin diline
  // zorla. Hata halinde metin AYNEN korunur (enforceReplyLanguage try/catch'li).
  if (result.handled && result.replyText && result.replyText.trim()) {
    result.replyText = await enforceReplyLanguage(input.guestMessage, result.replyText);
  }
  return result;
}
