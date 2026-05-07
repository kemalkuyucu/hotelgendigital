# MODÜL 5 — Yönetici Raporlama Bot + AI Orchestrator İskeleti

**Proje:** HotelGen v2
**Hotel:** Demo Hotel (slug: `demo-hotel`)
**Önceki tag:** `v1.0-module4`
**Bu modül tag:** `v1.0-module5`
**Stack:** Next.js 16 (App Router) + TypeScript strict + TailwindCSS 4 + Supabase + Vercel
**AI Provider:** Anthropic Claude (model: `claude-sonnet-4-6`)

---

## 0. BAĞLAM ÖZETİ (Modül 1-4 sonrası mevcut durum)

- Central Supabase (`hotelgen-central`) ve Demo Hotel Supabase (`hotelgen-demo-hotel`) ayrı projeler.
- `bridge_credentials` AES-256-GCM şifreli, `decrypt-credentials.ts` helper var, `getHotelClient(slug)` 5 dakika cache.
- Demo Hotel'in 7 departmanı `departments` tablosunda (`code`, `display_name`, `telegram_chat_id` dolu — Modül 4 follow-up'ında seed edildi).
- Central `hotels` tablosunda `telegram_manager_chat_id = 758605940` (Özgür Özen).
- Demo Hotel'de `guests`, `conversations`, `bot_messages` tabloları var (Modül 4).
- `@DemoHotelAnaBot_bot` çalışıyor, `/start` ve düz mesaj **echo** ile cevap veriyor — bu modülde echo yerine AI cevap gelecek.
- Webhook: `https://hotelgen-v2.vercel.app/api/webhooks/telegram/demo-hotel`, signature secret doğrulama aktif.
- `TELEGRAM_WEBHOOK_SECRET` env'de var, hem misafir hem yönetici bot için aynı secret kullanılacak.
- `ANTHROPIC_API_KEY` Vercel'de Production'da var.
- Modül 3'te `/api/cron/health-check` endpoint'i yazıldı ama Vercel cron schedule kurulmadı — bu modülde aktif edilecek.

**Çalışan kullanıcı (Kemal) tarzı:**
- Kısa, net, mikro adım. Tek seferde tek iş.
- Antigravity (sen) talimatları **kopyala-yapıştır** kod blokları halinde almalı.
- Migration "başarılı" görünse bile her zaman `information_schema.tables`/`columns` ile **doğrulanmalı**.
- TypeScript strict — `any` kullanma, `unknown` + type guard tercih et.

---

## 1. MODÜL 5 HEDEFLERİ

### 1.1 Kapsam dahil
1. **Misafir bot AI yanıtı:** `/api/webhooks/telegram/[hotelSlug]/route.ts` içindeki echo logic'i kaldır, yerine Claude API çağrısı koy. Claude tek çağrıda hem **departman sınıflandırması** hem **misafire cevap metni** üretsin (structured JSON output).
2. **AI Intent kaydı:** Her sınıflandırma sonucu yeni `ai_intents` tablosuna kaydedilsin (departman, confidence, reasoning, latency, token kullanımı).
3. **Yönetici raporlama bot'u:** İkinci Telegram bot için yeni webhook endpoint (`/api/webhooks/telegram-manager/[hotelSlug]/route.ts`). Sadece Central'da kayıtlı `telegram_manager_chat_id` ile konuşsun, başka chat'lerden gelen mesajları reject etsin. Komutlar: `/start`, `/help`, `/rapor`, `/durum`, `/aktif_konusmalar`, `/son_mesajlar`.
4. **Vercel cron aktivasyonu:** `vercel.json`'a cron schedule ekle, `/api/cron/health-check` her 15 dakikada bir tetiklensin.

### 1.2 Kapsam DIŞI (Modül 6+)
- Departman gruplarına otomatik mesaj iletimi (sınıflandırma kaydı yapılacak ama gruba mesaj atılmayacak).
- WhatsApp / Instagram (ManyChat).
- Sesli mesaj transcription (Whisper).
- Memory katmanları summary ve facts (sadece `messages` katmanı — son N mesaj — kullanılacak).
- Embedding tabanlı semantic search.

---

## 2. ÖN HAZIRLIK (Kemal manuel yapacak — Antigravity dokunma)

Bu adımları Kemal Telegram + Vercel UI'dan yapacak. Sen kodu yazmaya **bunlar bittikten sonra** başla. Kemal sana "ön hazırlık tamam" dediğinde devam et.

### 2.1 Yönetici bot token revoke + yeni token
Kemal `@BotFather`'da `/revoke` → `@Hotelyoneticiraporalma_bot` seçip yeni token alacak.

### 2.2 Vercel'e 2 yeni env değişkeni ekle (Production + Preview)
- `TELEGRAM_MANAGER_BOT_TOKEN_DEMO` = (yeni token)
- `TELEGRAM_MANAGER_BOT_USERNAME_DEMO` = `Hotelyoneticiraporalma_bot`

> Sensitive **işaretleme** (Modül 4'te yaşanan Vercel takıntısı: Sensitive değişkenler Edit ekranında değer göstermez, yanlışlıkla silinebilir).

### 2.3 Yönetici bot webhook'u kur
Kemal şu URL'yi tarayıcıdan çağıracak (token ve secret yerlerine kendi değerlerini koyarak):

```
https://api.telegram.org/bot<MANAGER_TOKEN>/setWebhook?url=https://hotelgen-v2.vercel.app/api/webhooks/telegram-manager/demo-hotel&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Beklenen: `{"ok":true,"result":true,"description":"Webhook was set"}`

### 2.4 Yönetici bot'u Özgür'ün özel chat'inde başlatma
Özgür `@Hotelyoneticiraporalma_bot`'a `/start` yazacak. (Bot Modül 5 deploy edilmeden önce çalışmaz, bu yüzden bu adım deploy sonrası test aşamasında yapılacak — ama `chat_id 758605940` zaten Central'da seed.)

---

## 3. SCHEMA DEĞİŞİKLİKLERİ (Demo Hotel Supabase)

### 3.1 Yeni migration dosyası

**Dosya:** `supabase/migrations/hotel/10_module5_ai_intents.sql`

```sql
-- Modül 5 — AI Intent kayıtları
-- Misafir mesajı geldiğinde Claude classification sonucu burada saklanır

CREATE TABLE IF NOT EXISTS ai_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  bot_message_id UUID REFERENCES bot_messages(id) ON DELETE SET NULL,

  -- Sınıflandırma sonucu
  classified_department TEXT,                -- departments.code ile eşleşir, NULL = sınıflandırılamadı
  confidence NUMERIC(3,2),                   -- 0.00 - 1.00
  reasoning TEXT,                            -- Claude'un departman seçim gerekçesi (kısa)
  ai_response TEXT,                          -- Claude'un misafire ürettiği cevap

  -- Telemetri
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  error TEXT,                                -- AI çağrısı başarısızsa hata mesajı

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_intents_conversation ON ai_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_intents_department ON ai_intents(classified_department);
CREATE INDEX IF NOT EXISTS idx_ai_intents_created_at ON ai_intents(created_at DESC);

-- RLS
ALTER TABLE ai_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON ai_intents
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE ai_intents IS 'Modül 5 — Claude tarafından üretilen departman sınıflandırması ve cevap kayıtları';
```

### 3.2 Doğrulama sorgusu (migration çalıştıktan sonra)

```sql
-- Tablo oluştu mu?
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'ai_intents'
) AS ai_intents_exists;

-- Kolonlar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_intents'
ORDER BY ordinal_position;
```

> **ÖNEMLİ:** Migration "başarılı" mesajına güvenme. Yukarıdaki SELECT'leri çalıştır ve sonuçları Kemal'e ekran görüntüsü olarak doğrulat. Modül 4'te tablo oluşmama sorunu yaşandı.

---

## 4. MİMARİ VE AKIŞ

### 4.1 Misafir mesaj akışı (yeni)

```
Misafir Telegram mesajı
   │
   ▼
POST /api/webhooks/telegram/demo-hotel
   │
   ├─► Signature secret doğrula (X-Telegram-Bot-Api-Secret-Token header)
   ├─► Hotel resolve (slug → tenant client) — getHotelClient('demo-hotel')
   ├─► Guest upsert (telegram_user_id'ye göre)
   ├─► Conversation upsert (channel='telegram', telegram_chat_id'ye göre)
   ├─► bot_messages.insert (direction='inbound', text=mesaj)
   │
   ├─► Son N=10 mesajı conversations + bot_messages'tan çek (context)
   ├─► classifyAndRespond(messageText, context, hotelDepartments)  ←── YENİ
   │     └─► Anthropic API call
   │           └─► JSON response: { department, confidence, reasoning, response_to_guest }
   │
   ├─► ai_intents.insert (classification + ai_response + telemetry)
   ├─► bot_messages.insert (direction='outbound', text=ai_response)
   ├─► Telegram sendMessage (misafire cevap gönder)
   │
   └─► (Modül 6+: departman grubuna iletim — şu an YOK)
```

### 4.2 Yönetici mesaj akışı (yeni)

```
Yönetici (Özgür) Telegram mesajı
   │
   ▼
POST /api/webhooks/telegram-manager/demo-hotel
   │
   ├─► Signature secret doğrula
   ├─► Hotel resolve (slug → central'dan hotel + telegram_manager_chat_id)
   ├─► chat_id kontrolü: gelen chat.id === hotel.telegram_manager_chat_id ?
   │     └─► Eşit DEĞİLSE: 200 OK dön (Telegram'a sessizce yut), DB'ye logla
   │
   ├─► Komut parse (mesaj '/' ile başlıyorsa)
   │     ├─► /start, /help     → bilgi mesajı
   │     ├─► /rapor             → bugünkü özet (mesaj sayısı, intent dağılımı)
   │     ├─► /durum             → sistem sağlığı (son health-check, bridge durumu)
   │     ├─► /aktif_konusmalar  → son 24 saatte aktif konuşmalar listesi
   │     └─► /son_mesajlar [N]  → son N misafir mesajı (default 10)
   │
   ├─► Düz mesaj (komut değilse) → "Komut listesi için /help" cevabı
   │
   └─► Telegram managerBot.sendMessage (yöneticiye cevap)
```

---

## 5. DOSYA LİSTESİ

### 5.1 Yeni dosyalar

| Path | Amaç |
|---|---|
| `supabase/migrations/hotel/10_module5_ai_intents.sql` | ai_intents tablosu |
| `src/lib/ai/anthropic-client.ts` | Anthropic SDK singleton + retry config |
| `src/lib/ai/classify-and-respond.ts` | Claude orchestrator çağrısı (classify + response in one call) |
| `src/lib/ai/system-prompts.ts` | System prompt template'leri |
| `src/lib/telegram/manager-bot-client.ts` | Yönetici bot için sendMessage helper |
| `src/lib/telegram/commands/handle-rapor.ts` | /rapor komut handler'ı |
| `src/lib/telegram/commands/handle-durum.ts` | /durum komut handler'ı |
| `src/lib/telegram/commands/handle-aktif-konusmalar.ts` | /aktif_konusmalar handler |
| `src/lib/telegram/commands/handle-son-mesajlar.ts` | /son_mesajlar handler |
| `src/lib/telegram/commands/handle-help.ts` | /start ve /help handler |
| `src/app/api/webhooks/telegram-manager/[hotelSlug]/route.ts` | Yönetici bot webhook endpoint |

### 5.2 Güncellenecek mevcut dosyalar

| Path | Değişiklik |
|---|---|
| `src/app/api/webhooks/telegram/[hotelSlug]/route.ts` | Echo logic'i kaldır, AI orchestrator'ı çağır, ai_intents'a kayıt düş |
| `vercel.json` | `crons` array'ine health-check schedule ekle |
| `package.json` | `@anthropic-ai/sdk` dependency ekle (yoksa) |
| `src/lib/types/database-hotel.ts` (varsa) | `ai_intents` tablo tipini ekle |

---

## 6. DETAYLI IMPLEMENTATION REFERANSI

### 6.1 `src/lib/ai/anthropic-client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env değişkeni tanımlı değil');
  }

  cachedClient = new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: 30_000, // 30s — Vercel Hobby function limiti 10s ama Anthropic SDK kendi içinde timeout yönetir
  });

  return cachedClient;
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 1024;
```

### 6.2 `src/lib/ai/system-prompts.ts`

```typescript
export interface DepartmentInfo {
  code: string;
  display_name: string;
}

export function buildOrchestratorSystemPrompt(
  hotelName: string,
  departments: DepartmentInfo[]
): string {
  const departmentList = departments
    .map((d) => `- ${d.code}: ${d.display_name}`)
    .join('\n');

  return `Sen ${hotelName} otelinin AI asistanısın. Görevin:

1. Misafirin mesajını oku ve hangi departmana ait olduğunu sınıflandır.
2. Misafire kibar, profesyonel, kısa bir cevap üret (Türkçe, max 3 cümle).

Mevcut departmanlar:
${departmentList}

KURALLAR:
- Departman kodu YALNIZCA yukarıdaki listeden olabilir.
- Sınıflandıramazsan department=null döndür.
- Misafire her zaman cevap üret, hatta sınıflandıramasan bile genel bir cevap ver.
- Kişisel veri (oda numarası, telefon) isteme.
- Sağlık tavsiyesi, hukuki tavsiye verme.

ÇIKTI FORMATI: Sadece geçerli JSON, başka hiçbir şey yazma. Şema:
{
  "department": "front_office" | "housekeeping" | "technical" | "fb" | "guest_relation" | "spa" | "animation" | null,
  "confidence": 0.0-1.0 arası sayı,
  "reasoning": "kısa Türkçe gerekçe (max 1 cümle)",
  "response_to_guest": "misafire gidecek Türkçe cevap (max 3 cümle)"
}`;
}
```

### 6.3 `src/lib/ai/classify-and-respond.ts`

```typescript
import { getAnthropicClient, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from './anthropic-client';
import { buildOrchestratorSystemPrompt, DepartmentInfo } from './system-prompts';

export interface ConversationContextMessage {
  direction: 'inbound' | 'outbound';
  text: string;
  created_at: string;
}

export interface ClassifyAndRespondInput {
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
  const systemPrompt = buildOrchestratorSystemPrompt(input.hotelName, input.departments);

  // Context mesajlarını Anthropic message formatına çevir
  const messages = input.context.map((m) => ({
    role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  // Son misafir mesajını ekle
  messages.push({ role: 'user' as const, content: input.guestMessage });

  const startedAt = Date.now();

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
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

  let parsed: {
    department: string | null;
    confidence: number;
    reasoning: string;
    response_to_guest: string;
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Anthropic JSON parse hatası: ${err instanceof Error ? err.message : 'unknown'}. Raw: ${rawText.slice(0, 200)}`);
  }

  // Validasyon
  if (typeof parsed.response_to_guest !== 'string' || parsed.response_to_guest.length === 0) {
    throw new Error('response_to_guest eksik veya boş');
  }

  return {
    department: parsed.department ?? null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    reasoning: parsed.reasoning ?? '',
    response_to_guest: parsed.response_to_guest,
    model: response.model,
    prompt_tokens: response.usage.input_tokens,
    completion_tokens: response.usage.output_tokens,
    latency_ms,
    raw_response: rawText,
  };
}
```

### 6.4 Misafir webhook güncellemesi

**Dosya:** `src/app/api/webhooks/telegram/[hotelSlug]/route.ts`

Mevcut echo logic'ini şu akışla değiştir (pseudo-code, gerçek kodda mevcut yapıya entegre et):

```typescript
// ... existing imports + signature validation + guest/conversation upsert

// Inbound mesajı kaydet
const inboundMsg = await hotelClient
  .from('bot_messages')
  .insert({ conversation_id, direction: 'inbound', text: messageText })
  .select()
  .single();

// Son 10 mesajı context olarak çek (eski → yeni sırada)
const { data: contextRows } = await hotelClient
  .from('bot_messages')
  .select('direction, text, created_at')
  .eq('conversation_id', conversation_id)
  .order('created_at', { ascending: false })
  .limit(10);
const context = (contextRows ?? []).reverse(); // eski → yeni

// Departmanları çek (cache edilmeli — basit: her çağrıda — production'da Redis/in-memory cache)
const { data: departments } = await hotelClient
  .from('departments')
  .select('code, display_name')
  .eq('is_enabled', true);

let aiResult: Awaited<ReturnType<typeof classifyAndRespond>> | null = null;
let aiError: string | null = null;

try {
  aiResult = await classifyAndRespond({
    hotelName: hotel.name, // Central hotel.name
    departments: departments ?? [],
    guestMessage: messageText,
    context: context.slice(0, -1), // son mesaj kendisi, context'e dahil etme
  });
} catch (err) {
  aiError = err instanceof Error ? err.message : 'unknown AI error';
}

// AI fallback cevap (AI patladıysa)
const responseText = aiResult?.response_to_guest
  ?? 'Mesajınız alındı, en kısa sürede ilgili departmandan dönüş yapılacaktır.';

// ai_intents kaydı
await hotelClient.from('ai_intents').insert({
  conversation_id,
  bot_message_id: inboundMsg.data?.id ?? null,
  classified_department: aiResult?.department ?? null,
  confidence: aiResult?.confidence ?? null,
  reasoning: aiResult?.reasoning ?? null,
  ai_response: responseText,
  model: aiResult?.model ?? 'claude-sonnet-4-6',
  prompt_tokens: aiResult?.prompt_tokens ?? null,
  completion_tokens: aiResult?.completion_tokens ?? null,
  latency_ms: aiResult?.latency_ms ?? null,
  error: aiError,
});

// Outbound mesajı kaydet
await hotelClient.from('bot_messages').insert({
  conversation_id,
  direction: 'outbound',
  text: responseText,
});

// Telegram'a cevap gönder
await sendTelegramMessage({
  botToken: process.env.TELEGRAM_BOT_TOKEN_DEMO!,
  chatId: telegramChatId,
  text: responseText,
});

return NextResponse.json({ ok: true });
```

### 6.5 `src/lib/telegram/manager-bot-client.ts`

```typescript
export interface SendManagerMessageInput {
  chatId: number;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export async function sendManagerMessage(input: SendManagerMessageInput): Promise<void> {
  const token = process.env.TELEGRAM_MANAGER_BOT_TOKEN_DEMO;
  if (!token) {
    throw new Error('TELEGRAM_MANAGER_BOT_TOKEN_DEMO env değişkeni yok');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode ?? 'Markdown',
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}
```

### 6.6 Yönetici webhook endpoint

**Dosya:** `src/app/api/webhooks/telegram-manager/[hotelSlug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCentralClient } from '@/lib/supabase/central-client';
import { getHotelClient } from '@/lib/supabase/hotel-client';
import { sendManagerMessage } from '@/lib/telegram/manager-bot-client';
import { handleHelp } from '@/lib/telegram/commands/handle-help';
import { handleRapor } from '@/lib/telegram/commands/handle-rapor';
import { handleDurum } from '@/lib/telegram/commands/handle-durum';
import { handleAktifKonusmalar } from '@/lib/telegram/commands/handle-aktif-konusmalar';
import { handleSonMesajlar } from '@/lib/telegram/commands/handle-son-mesajlar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ hotelSlug: string }> }
) {
  // Next.js 16 — params is async
  const { hotelSlug } = await context.params;

  // 1) Signature secret doğrula
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'invalid secret' }, { status: 401 });
  }

  // 2) Body parse
  const update = await req.json();
  const message = update.message;
  if (!message) {
    return NextResponse.json({ ok: true }); // Telegram update tipi mesaj değil
  }

  const incomingChatId: number = message.chat.id;
  const text: string = message.text ?? '';

  // 3) Hotel'i Central'dan resolve et
  const central = getCentralClient();
  const { data: hotel } = await central
    .from('hotels')
    .select('id, name, slug, telegram_manager_chat_id')
    .eq('slug', hotelSlug)
    .single();

  if (!hotel) {
    return NextResponse.json({ ok: false, error: 'hotel not found' }, { status: 404 });
  }

  // 4) chat_id kontrolü — yetkisiz mesajları sessizce yut
  if (Number(hotel.telegram_manager_chat_id) !== incomingChatId) {
    // 200 OK dön — ama gönderene cevap verme
    console.warn(`[manager-webhook] unauthorized chat_id: ${incomingChatId} for hotel ${hotelSlug}`);
    return NextResponse.json({ ok: true });
  }

  // 5) Hotel client'ı al (departments, mesaj sayıları vb. için)
  const hotelClient = await getHotelClient(hotelSlug);

  // 6) Komut parse + dispatch
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith('/');
  let response: string;

  if (!isCommand) {
    response = '⚠️ Sadece komutları işliyorum. Komut listesi için /help yazın.';
  } else {
    const [rawCmd, ...args] = trimmed.split(/\s+/);
    const cmd = rawCmd.toLowerCase().split('@')[0]; // /rapor@bot → /rapor

    switch (cmd) {
      case '/start':
      case '/help':
        response = await handleHelp(hotel.name);
        break;
      case '/rapor':
        response = await handleRapor(hotelClient);
        break;
      case '/durum':
        response = await handleDurum(hotelClient, hotel.id, central);
        break;
      case '/aktif_konusmalar':
        response = await handleAktifKonusmalar(hotelClient);
        break;
      case '/son_mesajlar': {
        const n = parseInt(args[0] ?? '10', 10);
        response = await handleSonMesajlar(hotelClient, isNaN(n) ? 10 : Math.min(n, 50));
        break;
      }
      default:
        response = `❓ Bilinmeyen komut: \`${cmd}\`\nKomut listesi için /help yazın.`;
    }
  }

  // 7) Cevap gönder
  await sendManagerMessage({ chatId: incomingChatId, text: response });

  return NextResponse.json({ ok: true });
}
```

### 6.7 Komut handler'ları

**`src/lib/telegram/commands/handle-help.ts`**

```typescript
export async function handleHelp(hotelName: string): Promise<string> {
  return `🏨 *${hotelName} — Yönetici Paneli*

Komutlar:
\`/rapor\` — Bugünkü mesaj/intent özeti
\`/durum\` — Sistem sağlığı
\`/aktif_konusmalar\` — Son 24 saatte aktif misafirler
\`/son_mesajlar [N]\` — Son N misafir mesajı (default 10)
\`/help\` — Bu mesaj

ℹ️ Bu bot yalnızca senin chat ID'nle (${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}) konuşur.`;
}
```

**`src/lib/telegram/commands/handle-rapor.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export async function handleRapor(hotelClient: SupabaseClient): Promise<string> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isoStart = todayStart.toISOString();

  const { count: inboundCount } = await hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .gte('created_at', isoStart);

  const { count: outboundCount } = await hotelClient
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', isoStart);

  const { data: intentDist } = await hotelClient
    .from('ai_intents')
    .select('classified_department')
    .gte('created_at', isoStart);

  const distMap = new Map<string, number>();
  for (const row of intentDist ?? []) {
    const key = row.classified_department ?? '(sınıflandırılamadı)';
    distMap.set(key, (distMap.get(key) ?? 0) + 1);
  }

  const distLines =
    distMap.size === 0
      ? '_(bugün intent yok)_'
      : Array.from(distMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  • ${k}: ${v}`)
          .join('\n');

  return `📊 *Bugünkü Rapor*

📥 Gelen mesaj: *${inboundCount ?? 0}*
📤 Giden mesaj: *${outboundCount ?? 0}*

🏷 Intent dağılımı:
${distLines}`;
}
```

**`src/lib/telegram/commands/handle-durum.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export async function handleDurum(
  hotelClient: SupabaseClient,
  hotelId: string,
  centralClient: SupabaseClient
): Promise<string> {
  // En son 5 health-check kaydı
  const { data: healthRows } = await centralClient
    .from('system_health')
    .select('check_type, status, latency_ms, checked_at')
    .eq('hotel_id', hotelId)
    .order('checked_at', { ascending: false })
    .limit(5);

  if (!healthRows || healthRows.length === 0) {
    return '⚠️ *Durum:* Hiç health-check kaydı yok.';
  }

  const lines = healthRows.map((r) => {
    const icon = r.status === 'healthy' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌';
    return `${icon} ${r.check_type}: ${r.status} (${r.latency_ms ?? '-'}ms) — ${new Date(r.checked_at).toLocaleString('tr-TR')}`;
  });

  return `🩺 *Sistem Durumu* (son 5 kontrol)\n\n${lines.join('\n')}`;
}
```

**`src/lib/telegram/commands/handle-aktif-konusmalar.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export async function handleAktifKonusmalar(hotelClient: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await hotelClient
    .from('conversations')
    .select('id, last_message_at, guest:guests(first_name, last_name, telegram_username)')
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) {
    return '💬 *Aktif Konuşmalar:* Son 24 saatte aktif konuşma yok.';
  }

  const lines = rows.map((r, i) => {
    const guest = r.guest as { first_name?: string; last_name?: string; telegram_username?: string } | null;
    const name = guest
      ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || guest.telegram_username || 'isimsiz'
      : 'isimsiz';
    const time = new Date(r.last_message_at as string).toLocaleString('tr-TR');
    return `${i + 1}. *${name}* — ${time}`;
  });

  return `💬 *Aktif Konuşmalar* (son 24 saat)\n\n${lines.join('\n')}`;
}
```

**`src/lib/telegram/commands/handle-son-mesajlar.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export async function handleSonMesajlar(
  hotelClient: SupabaseClient,
  n: number
): Promise<string> {
  const { data: rows } = await hotelClient
    .from('bot_messages')
    .select('text, direction, created_at, conversation:conversations(guest:guests(first_name))')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(n);

  if (!rows || rows.length === 0) {
    return '📨 *Son Mesajlar:* Hiç misafir mesajı yok.';
  }

  const lines = rows.map((r, i) => {
    const conv = r.conversation as { guest?: { first_name?: string } } | null;
    const name = conv?.guest?.first_name ?? 'isimsiz';
    const time = new Date(r.created_at as string).toLocaleString('tr-TR');
    const preview = (r.text ?? '').slice(0, 80);
    return `${i + 1}. *${name}* (${time}):\n   _${preview}_`;
  });

  return `📨 *Son ${n} Misafir Mesajı*\n\n${lines.join('\n\n')}`;
}
```

---

## 7. VERCEL CRON KONFİGÜRASYONU

**Dosya:** `vercel.json` (varsa güncelle, yoksa oluştur)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/health-check",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

> **NOT:** Vercel Hobby plan'da cron sayısı sınırlıdır (2 cron, sadece günde 1 kere). Eğer "*/15 * * * *" plan tarafından reddedilirse `0 9 * * *` (her gün saat 09:00 UTC) yap. Kemal'e Vercel deploy log'unda cron schedule'ın kabul edilip edilmediğini doğrulatmak şart.
>
> Hobby limitleri için doğrulama: deploy sonrası Vercel Dashboard → proje → **Settings → Cron Jobs** sekmesinde schedule görünmeli.

---

## 8. TEST ADIMLARI

### 8.1 Yerel build (TypeScript strict)

```bash
npm install @anthropic-ai/sdk@latest
npm run build
```

Build başarısız olursa **commit etme** — TypeScript hatalarını çöz.

### 8.2 Migration çalıştır (Supabase Dashboard SQL Editor)

`supabase/migrations/hotel/10_module5_ai_intents.sql` içeriğini Demo Hotel SQL Editor'a yapıştır → Run. Sonra doğrulama sorgularını çalıştır (bölüm 3.2).

### 8.3 Production deploy

```bash
git add .
git commit -m "feat(module5): AI orchestrator + manager reporting bot"
git push origin main
```

Vercel otomatik deploy edecek. Deployment "Ready" olmasını bekle.

### 8.4 Misafir bot testi

Kemal `@DemoHotelAnaBot_bot`'a şunları yazsın (sırayla):

1. `Merhaba` → AI'dan kibar bir karşılama cevabı gelmeli, `ai_intents`'a kayıt düşmeli (department=null veya guest_relation, confidence < 0.5 olabilir).
2. `Odamdaki klima çalışmıyor` → cevap gelmeli, `classified_department='technical'`, confidence > 0.7.
3. `Kahvaltı saat kaçta?` → cevap gelmeli, `classified_department='fb'`.
4. `Spa için randevu almak istiyorum` → `classified_department='spa'`.

Doğrulama: Demo Hotel SQL Editor'da `SELECT * FROM ai_intents ORDER BY created_at DESC LIMIT 10;`

### 8.5 Yönetici bot testi

Özgür `@Hotelyoneticiraporalma_bot`'a şunları yazsın:

1. `/start` → karşılama + komut listesi.
2. `/rapor` → bugünkü inbound/outbound sayısı + intent dağılımı.
3. `/durum` → son 5 health-check kaydı (cron en az 1 kere çalışmış olmalı, yoksa "kayıt yok" döner).
4. `/aktif_konusmalar` → 8.4'te konuşma yapan misafirler listede olmalı.
5. `/son_mesajlar 5` → son 5 misafir mesajı.

### 8.6 Yetkisiz chat testi (security)

Başka bir Telegram hesabı `@Hotelyoneticiraporalma_bot`'a `/rapor` yazsın → bot **hiçbir cevap vermemeli** (sessizce yutulmalı). Vercel function log'unda `unauthorized chat_id` warning görünmeli.

### 8.7 Cron testi

Deploy'dan sonra Vercel Dashboard → **Cron Jobs** sekmesinde `/api/cron/health-check` listede görünmeli. İlk çalışmayı bekle (max 15 dk veya schedule ne ise), sonra Demo Hotel `system_health` tablosunda yeni kayıt görünmeli.

---

## 9. BUILD / COMMIT / TAG

```bash
# Tüm değişiklikler tamamlandıktan ve testler geçtikten SONRA:
git add .
git commit -m "feat(module5): AI orchestrator + manager bot + cron activation"
git push origin main

# Deploy "Ready" olduktan sonra:
git tag v1.0-module5
git push origin v1.0-module5
```

---

## 10. RİSKLER ve NOTLAR

### 10.1 Vercel Hobby function timeout (10 saniye)
Anthropic API çağrısı genellikle 1-3 saniye sürer ama uzun context veya yavaş model durumunda 10 saniyeyi geçebilir. Eğer prod'da timeout görülürse:
- Context'i 5 mesaja düşür
- Veya Vercel Pro plan'a geçilmesi önerilebilir

### 10.2 Anthropic JSON parse hatası
Claude bazen `\`\`\`json` fence ekler veya başına/sonuna açıklama yazar. Code'da temizleme adımı var ama yine de parse hatası olabilir — bu durumda `aiError` set edilip fallback cevap gönderilir, sistem patlamaz.

### 10.3 Modül 4 bilinen sorunu: Migration "başarılı" görünür ama tablo yoktur
Her migration sonrası `information_schema.tables` ile **doğrula**. Antigravity bu adımı asla atlamamalı.

### 10.4 Webhook secret tek
Hem misafir hem yönetici bot aynı `TELEGRAM_WEBHOOK_SECRET` kullanıyor. Bu kabul edilebilir çünkü secret rastgele bir token ve sızması durumunda her iki bot da etkilenir. İleride ayrılmak istenirse `TELEGRAM_MANAGER_WEBHOOK_SECRET` env'i eklenebilir.

### 10.5 Conversation context — performans
Her misafir mesajında son 10 `bot_messages` çekiliyor. Demo Hotel için sorun değil ama prod ölçekte index gerekli — `idx_bot_messages_conversation_created` zaten var (Modül 4).

### 10.6 Tag çakışması
`v1.0-module5` tag'ini push etmeden önce `git tag -l v1.0-module5` ile yokluğunu doğrula. Varsa önce sil: `git tag -d v1.0-module5 && git push origin :refs/tags/v1.0-module5`.

### 10.7 Mutfak (Demo_MUTFAK) durumu
Şimdilik Mutfak grubu **kullanılmıyor**. fb departmanı tüm yiyecek-içecek mesajlarını alıyor ve şu an gruba iletim olmadığı için sorun yok. Modül 6+'da departman gruplarına iletim eklendiğinde Mutfak için ayrı bir alt-routing kararı verilecek.

---

## SON KONTROL LİSTESİ (Antigravity için)

Bu paketi tamamladığını söylemeden önce şunları DOĞRULA:

- [ ] `npm run build` hatasız çalışıyor (TypeScript strict)
- [ ] `ai_intents` tablosu Supabase'de gerçekten oluştu (information_schema check)
- [ ] Vercel deploy "Ready" durumda
- [ ] Misafir bot AI cevabı dönüyor (en az 2 farklı departman testi)
- [ ] `ai_intents`'a kayıtlar düşüyor
- [ ] Yönetici bot `/help`, `/rapor`, `/durum` komutları cevap veriyor
- [ ] Yetkisiz chat'ten gelen mesaj sessizce yutuluyor
- [ ] `vercel.json` cron config kabul edildi (Dashboard'da görünüyor)
- [ ] `git tag v1.0-module5` push edildi

Hepsi tikse → Modül 5 TAMAMLANDI ✅
