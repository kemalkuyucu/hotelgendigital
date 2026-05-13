# Modül 11.2 — Çoklu Departman Intent

## Özet

Misafir tek mesajda 2+ farklı departmanı ilgilendiren talep yazdığında
sistem şu an yalnızca 1 departmana forward ediyor.

**Hedef:** Her ayrı talep → ayrı `sla_events` kaydı → ayrı butonlu Telegram mesajı.
Misafir tek özet cevap alır.

---

## Değişecek Dosyalar

| # | Dosya | Değişim Tipi | Satır Aralığı |
|---|---|---|---|
| 1 | `src/lib/ai/system-prompts.ts` | MODIFY | L347–L386 (JSON şeması + örnek) |
| 2 | `src/lib/ai/classify-and-respond.ts` | MODIFY | L19–L131 (interface + parse + return) |
| 3 | `src/app/api/webhooks/telegram/[hotelSlug]/route.ts` | MODIFY | L1031–L1260 (ai_intents insert + forward loop) |
| 4 | **Migration SQL** | NEW | `supabase/migrations/` altında yeni dosya |

---

## Değişiklik 1 — `system-prompts.ts`

### Etkilenen satırlar: L347–L386

**Mevcut JSON Şeması** (tek intent):
```json
{
  "reply_text": "<mesaj>",
  "intent": "<tek_dept_kodu>",
  "confidence": 0.95,
  "reasoning": "<gerekçe>",
  "answered_from_knowledge": false
}
```

**Yeni JSON Şeması** (intents array):
```json
{
  "reply_text": "<misafire gönderilecek tek özet mesaj>",
  "intents": [
    { "department": "technical",    "request_text": "klimam çalışmıyor" },
    { "department": "housekeeping", "request_text": "yastığım eksik" }
  ],
  "confidence": 0.95,
  "reasoning": "<kısa Türkçe gerekçe>",
  "answered_from_knowledge": false
}
```

### Yeni Claude Prompt — L347–L386 bölgesinin TAM yerine geçecek metin:

```
=== ÇIKTI FORMATI — MUTLAK KURAL ===

Cevabını DAİMA aşağıdaki JSON formatında ver. Başka hiçbir şey yazma.
Önüne arkasına metin EKLEME. Markdown fence (```json) EKLEME. Sadece geçerli JSON döndür.

YASAK örnek (asla böyle cevap verme):
Wi-Fi ağ adımız DemoHotelGuest, şifresi misafir2026'dır.

DOĞRU örnek — TEK INTENT:
{"reply_text":"Klima sorununuzu teknik ekibimize ilettim, en kısa sürede odanıza gelecekler.","intents":[{"department":"technical","request_text":"klimam çalışmıyor"}],"confidence":0.97,"reasoning":"Tek operasyonel talep: klima arızası","answered_from_knowledge":false}

DOĞRU örnek — ÇOKLU INTENT:
{"reply_text":"✅ Talepleriniz iletildi:\n• klima → Teknik Servis\n• yastık → Housekeeping","intents":[{"department":"technical","request_text":"klimam çalışmıyor"},{"department":"housekeeping","request_text":"yastığım eksik"}],"confidence":0.95,"reasoning":"İki ayrı operasyonel talep tespit edildi","answered_from_knowledge":false}

JSON ŞEMASI:
{
  "reply_text": "<misafire gönderilecek mesaj — düz metin, Markdown YOK, misafirin dilinde>",
  "intents": [
    {
      "department": "<spa|fb|technical|housekeeping|guest_relation|front_office|animation|allergy|room_service|complaint|billing|lost_and_found|unknown>",
      "request_text": "<bu departmanla ilgili talebin özeti — misafirin kendi ifadesinden>"
    }
  ],
  "confidence": <0.0-1.0>,
  "reasoning": "<kısa Türkçe gerekçe, max 1 cümle>",
  "answered_from_knowledge": <true|false>
}

ÇOKLU INTENT KURALLARI:
1. Misafirin mesajında KESİN olarak 2+ FARKLI departmanı ilgilendiren talep varsa,
   her biri için ayrı bir intents[] öğesi döndür.
2. Şüphe durumunda (tek talep mı çoklu mu?) TEK intent döndür.
3. intents[] her zaman en az 1 öğe içerir. Hiçbir zaman boş array döndürme.
4. request_text alanı orijinal talebi kısaca özetler — departman grubuna iletilecek metin.
5. Çoklu intent'te reply_text özet listesi olur (misafirin dilinde):
   TR: "✅ Talepleriniz iletildi:\n• klima → Teknik Servis\n• yastık → Housekeeping"
   EN: "✅ Your requests have been forwarded:\n• AC issue → Technical\n• pillow → Housekeeping"
6. answered_from_knowledge: intents[] içinde HERHANGI bir operasyonel talep varsa false.

answered_from_knowledge KURALI:
- true: Cevabı OTEL BİLGİLERİ bölümünden ürettin (KB sorusu, bilgi sorusu)
- false: Operasyonel/kişisel talep tespit ettin

TEKRAR: SADECE JSON DÖNDÜR. Başka HİÇBİR ŞEY yazma.
```

### Eklenmesi Gereken Çoklu Intent Örnekleri (ÖRNEKLER bölümüne L179–L231 arasına):

```
Örnek 10 — ÇOKLU INTENT (Türkçe):
Misafir: "klimam çalışmıyor ve yastığım eksik"
reply_text: "✅ Talepleriniz iletildi:\n• klima → Teknik Servis\n• yastık → Housekeeping"
intents: [
  {"department":"technical","request_text":"klimam çalışmıyor"},
  {"department":"housekeeping","request_text":"yastık eksik"}
]
confidence: 0.95, answered_from_knowledge: false

Örnek 11 — ÇOKLU INTENT (İngilizce):
Guest: "my AC is broken and I need extra towels"
reply_text: "✅ Your requests have been forwarded:\n• AC issue → Technical Service\n• extra towels → Housekeeping"
intents: [
  {"department":"technical","request_text":"AC is broken"},
  {"department":"housekeeping","request_text":"need extra towels"}
]
confidence: 0.96, answered_from_knowledge: false
```

---

## Değişiklik 2 — `classify-and-respond.ts`

### Etkilenen satırlar: L19–L131

#### A) Yeni Export Interface (L19–L32 yerine):

```typescript
// YENİ: her intent item için ayrı yapı
export interface ClassifiedIntentItem {
  department: string;      // routeIntentToDepartment sonrası resolve edilmiş dept kodu
  requestText: string;     // Bu departmana iletilecek özet talep metni
  shouldForward: boolean;  // Bu item forward edilmeli mi?
  rawDepartment: string;   // Claude'un döndürdüğü ham dept kodu (logging için)
}

export interface ClassifyAndRespondOutput {
  // Çoklu intent — ana yapı
  classifiedIntents: ClassifiedIntentItem[];

  // Geriye dönük uyum (tek intent senaryosu için — classifiedIntents[0]'dan türetilir)
  department: string | null;
  shouldForward: boolean;

  confidence: number;
  reasoning: string;
  response_to_guest: string;         // reply_text'ten gelir
  answered_from_knowledge: boolean;

  // Telemetri
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  raw_response: string;
}
```

#### B) Yeni Parse Bloğu (L78–L130 yerine):

```typescript
// Yeni JSON şeması parse
let parsed: {
  reply_text?: string;
  response_to_guest?: string;   // legacy uyum
  intents?: Array<{ department: string; request_text: string }>;
  intent?: string | null;       // legacy uyum (tek intent)
  department?: string | null;   // legacy uyum
  confidence: number;
  reasoning: string;
  answered_from_knowledge?: boolean;
};

try {
  parsed = JSON.parse(cleaned) as typeof parsed;
} catch (err) {
  throw new Error(`Anthropic JSON parse hatası: ...`);
}

const responseToGuest = parsed.reply_text ?? parsed.response_to_guest ?? '';

// intents[] öncelikli; legacy fallback: tek elemanlı array
const rawIntents: Array<{ department: string; request_text: string }> =
  (parsed.intents && parsed.intents.length > 0)
    ? parsed.intents
    : [{
        department: parsed.intent ?? parsed.department ?? 'unknown',
        request_text: responseToGuest,
      }];

// Her item için routeIntentToDepartment
const classifiedIntents: ClassifiedIntentItem[] = rawIntents.map((item) => {
  const routing = routeIntentToDepartment(item.department);
  return {
    department: routing.department ?? 'front_office',
    requestText: item.request_text || responseToGuest,
    shouldForward: routing.shouldForward,
    rawDepartment: item.department,
  };
});

const firstIntent = classifiedIntents[0];
const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
const answeredFromKnowledge =
  typeof parsed.answered_from_knowledge === 'boolean'
    ? parsed.answered_from_knowledge
    : false;

return {
  classifiedIntents,
  department: firstIntent?.department ?? null,
  shouldForward: classifiedIntents.some((i) => i.shouldForward),
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
```

---

## Değişiklik 3 — `route.ts`

### Etkilenen satırlar: L1031–L1260

#### A) `ai_intents` INSERT (L1032–L1056 yerine):

```typescript
// Tüm intent'leri bağlamak için tek bir group ID üret
const guestMessageGroupId = crypto.randomUUID();

// Her classified intent için ayrı ai_intents kaydı
const intentInserts = (aiResult?.classifiedIntents ?? []).length > 0
  ? (aiResult!.classifiedIntents).map((item) => ({
      conversation_id: conversationId,
      bot_message_id: inboundMsgId ?? null,
      classified_department: item.department,
      confidence: aiResult?.confidence ?? null,
      reasoning: aiResult?.reasoning ?? null,
      ai_response: finalResponseText,
      model: aiResult?.model ?? 'claude-sonnet-4-6',
      prompt_tokens: aiResult?.prompt_tokens ?? null,
      completion_tokens: aiResult?.completion_tokens ?? null,
      latency_ms: aiResult?.latency_ms ?? null,
      error: aiError,
      guest_message_id: guestMessageGroupId,  // ← YENİ
    }))
  : [{
      conversation_id: conversationId,
      bot_message_id: inboundMsgId ?? null,
      classified_department: finalIntent ?? null,
      confidence: aiResult?.confidence ?? null,
      reasoning: aiResult?.reasoning ?? null,
      ai_response: finalResponseText,
      model: aiResult?.model ?? 'claude-sonnet-4-6',
      prompt_tokens: aiResult?.prompt_tokens ?? null,
      completion_tokens: aiResult?.completion_tokens ?? null,
      latency_ms: aiResult?.latency_ms ?? null,
      error: aiError,
      guest_message_id: guestMessageGroupId,
    }];

await supa.from('ai_intents').insert(intentInserts);
// Not: artık .select('id').single() KULLANILMIYOR — aiIntentId kaldırılır
// forwardToDepartment'a aiIntentId=null geçilir (zaten opsiyonel)
```

#### B) Forward Loop (L1069–L1244 yerine — pseudo-kod):

```typescript
if (!skipForward) {

  // Forward edilecek item listesi oluştur
  const forwardableIntents = buildForwardableIntents(
    aiResult?.classifiedIntents,   // çoklu intent
    finalIntent,                   // legacy fallback
    departments,
    forwardGuestMessage,
  );

  const guestFullNameForSla = persistentVerifiedGuest
    ? `${persistentVerifiedGuest.first_name ?? ''} ${persistentVerifiedGuest.last_name ?? ''}`.trim().toUpperCase()
    : guestName.toUpperCase();

  const trDateStr = formatTurkishDate();

  // Her departman için ayrı döngü
  for (const fwdItem of forwardableIntents) {
    try {
      // 1) SLA dakikasını çek
      const { data: deptSla } = await supa
        .from('departments')
        .select('sla_minutes')
        .eq('code', fwdItem.dept)
        .maybeSingle();
      const slaMinutes = (deptSla?.sla_minutes as number | null) ?? 1;

      // 2) sla_events INSERT
      const nowSla = new Date();
      const slaDeadline = new Date(nowSla.getTime() + slaMinutes * 60 * 1000);

      const { data: slaEvent, error: slaErr } = await supa
        .from('sla_events')
        .insert({
          conversation_id: conversationId,
          inhouse_guest_id: persistentVerifiedGuest?.id ?? null,
          department_code: fwdItem.dept,
          department_chat_id: String(fwdItem.chatId),
          request_text: fwdItem.requestText,   // ← item'a özgü metin
          room_number: persistentVerifiedGuest?.room_number ?? null,
          guest_full_name: guestFullNameForSla,
          forwarded_at: nowSla.toISOString(),
          sla_deadline: slaDeadline.toISOString(),
        })
        .select('id')
        .single();

      if (slaErr || !slaEvent) {
        console.error('[sla-forward] INSERT FAILED', fwdItem.dept, slaErr?.message);
        // Fallback: butonsuz mesaj gönder ve bir sonraki departmana geç
        await tg.sendMessage({
          chat_id: fwdItem.chatId,
          text: formatSlaGroupMessagePlain(guestFullNameForSla, persistentVerifiedGuest?.room_number ?? null, fwdItem.requestText, trDateStr),
          parse_mode: 'HTML',
        });
        continue;
      }

      // 3) SLA butonlu grup mesajı
      const groupMsgHtml = formatSlaGroupMessageHtml(
        guestFullNameForSla,
        persistentVerifiedGuest?.room_number ?? null,
        fwdItem.requestText,  // ← item'a özgü (tüm mesaj değil)
        trDateStr,
      );

      const { messageId: slaMsgId, ok: slaOk } = await sendForwardWithSlaButtons({
        botToken,
        chatId: String(fwdItem.chatId),
        html: groupMsgHtml,
        slaEventId: slaEvent.id as string,
      });

      if (slaOk && slaMsgId) {
        await supa
          .from('sla_events')
          .update({ department_message_id: slaMsgId })
          .eq('id', slaEvent.id as string);
        console.log(`[sla] dept=${fwdItem.dept} msgId=${slaMsgId} ✓`);
      }

      // 4) Staff DM (forwardToDepartment skipGroupMessage=true)
      await forwardToDepartment({
        hotelSupa: supa,
        tg,
        aiIntentId: null,
        classifiedDepartment: fwdItem.dept,
        targetDept: fwdItem.dept,
        targetChatId: -1,        // grup mesajı zaten SLA tarafından gönderildi
        wasRerouted: fwdItem.wasRerouted,
        isOffHours: fwdItem.wasRerouted,
        guestName,
        guestMessage: fwdItem.requestText,  // ← item'a özgü
        aiResponse: finalResponseText,
        confidence: aiResult?.confidence ?? 0,
        verifiedGuest: persistentVerifiedGuest
          ? { first_name: persistentVerifiedGuest.first_name, last_name: persistentVerifiedGuest.last_name, room_number: persistentVerifiedGuest.room_number }
          : null,
        guestTelegramId: String(userId),
        skipGroupMessage: true,
      });

    } catch (fwdErr) {
      // Tek bir dept hatası diğer dept'leri durdurmaz
      console.error('[telegram] forward error for dept', fwdItem.dept, fwdErr);
    }
  }

  // conversations güncelle (son forward)
  const lastDept = forwardableIntents[forwardableIntents.length - 1]?.dept ?? null;
  if (lastDept) {
    await supa
      .from('conversations')
      .update({ last_intent: lastDept, last_forwarded_at: new Date().toISOString() })
      .eq('id', conversationId);
  }
}
```

#### C) Yeni Yardımcı Fonksiyon: `buildForwardableIntents`

```typescript
// route.ts içine eklenecek yardımcı fonksiyon (handleMessage dışında)
function buildForwardableIntents(
  classifiedIntents: ClassifiedIntentItem[] | undefined,
  fallbackIntent: string | null,
  departments: DeptRouteInfo[],
  fallbackMessage: string,
): Array<{ dept: string; chatId: number; requestText: string; wasRerouted: boolean }> {
  const items: Array<{ dept: string; chatId: number; requestText: string; wasRerouted: boolean }> = [];

  const intentsToProcess = (classifiedIntents && classifiedIntents.length > 0)
    ? classifiedIntents
    : [{ department: fallbackIntent ?? 'front_office', requestText: fallbackMessage, shouldForward: true, rawDepartment: fallbackIntent ?? 'front_office' }];

  for (const item of intentsToProcess) {
    if (!item.shouldForward) continue;
    const resolved = resolveTargetDepartment(item.department, departments);
    if (!resolved) {
      console.warn(`[forward] dept=${item.department} için chat_id yok — atlandı`);
      continue;
    }
    items.push({
      dept: resolved.targetDept,
      chatId: resolved.targetChatId,
      requestText: item.requestText || fallbackMessage,
      wasRerouted: resolved.wasRerouted,
    });
  }

  return items;
}
```

---

## Misafir Cevap Template'leri (Claude prompt'a eklenir)

### Türkçe
```
✅ Talepleriniz iletildi:
• klima → Teknik Servis
• yastık → Housekeeping
```

### İngilizce
```
✅ Your requests have been forwarded:
• AC issue → Technical Service
• extra pillow → Housekeeping
```

### Almanca
```
✅ Ihre Anfragen wurden weitergeleitet:
• Klimaanlage → Technischer Service
• Kissen → Housekeeping
```

---

## Değişiklik 4 — ai_intents Migration SQL

### Yeni Kolon: `guest_message_id`

**Amaç**: Aynı misafir mesajından çıkan birden fazla `ai_intents` satırını birbirine bağlar.

```sql
-- Migration: Modül 11.2 — ai_intents çoklu intent group ID
-- Dosya: supabase/migrations/<timestamp>_add_guest_message_id_to_ai_intents.sql

ALTER TABLE ai_intents
  ADD COLUMN IF NOT EXISTS guest_message_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_ai_intents_guest_message_id
  ON ai_intents (guest_message_id)
  WHERE guest_message_id IS NOT NULL;

COMMENT ON COLUMN ai_intents.guest_message_id IS
  'Aynı misafir mesajından üretilen intent satırlarını birbirine bağlayan grup ID (Modül 11.2)';
```

**Mevcut kayıtlar**: `guest_message_id = NULL` — migration geriye dönük uyumlu.

---

## Verification (Doğrulama) Entegrasyonu — Seçenek A

```
Misafir: "klimam çalışmıyor ve yastığım eksik"
  │
  ▼
Claude → intents: [{technical,"klimam"},{housekeeping,"yastık"}]
  │
  ├─ persistentVerifiedGuest VAR? → EVET: Tüm intents direkt for döngüsüne
  │
  └─ HAYIR: requiresVerification(ilk intent) → mevcut doğrulama akışı
       ├─ Başarılı → skipForward=false → for döngüsü tüm intents'i işler
       └─ Başarısız → skipForward=true → hiçbir dept'e forward yok
```

> [!NOTE]
> `requiresVerification()` çağrısı yalnızca `aiRawIntent` (ilk intent) ile yapılır.
> route.ts L973 satırında değişiklik GEREKMİYOR — mevcut logic korunur.
> Verification başarılıysa `skipForward=false` → for döngüsü tüm `classifiedIntents[]`'i işler.

---

## Yan Etkiler & Risk Analizi

| Risk | Açıklama | Önlem |
|---|---|---|
| Claude bazen array yerine tek intent döner | Prompt değişiminden sonra test edilmeli | Legacy fallback: tek item array oluşturulur |
| `ai_intents` JOIN bozulur | Tek satır → N satır | `guest_message_id` ile gruplama; mevcut JOIN'ler `guest_message_id IS NULL` uyumlu |
| forwardToDepartment DM duplicate | Her dept için çağrılır | skipGroupMessage=true, DM zaten dept bazlı ayrı |
| SLA escalation çoklu event | Her event bağımsız escalate olur | check-runner.ts değişiklik GEREKMİYOR |
| handle-callback.ts | Her sla_event kendi dept_message_id'sini biliyor | Değişiklik YOK — zaten doğru tasarlanmış |
| `aiIntentId` referansları | ai_intents artık çoklu — tek ID yok | forwardToDepartment'a `aiIntentId=null` geçilir |

---

## Uygulama Sırası

1. **Migration SQL** → Supabase Dashboard SQL Editor'de çalıştır
2. **`system-prompts.ts`** → JSON şemasını, kuralları ve örnekleri güncelle
3. **`classify-and-respond.ts`** → Interface + parse + return değiştir
4. **`route.ts`** → `ai_intents` insert + `buildForwardableIntents` + for döngüsü
5. **Test** → "klimam çalışmıyor ve yastığım eksik" ile uçtan uca doğrula
6. **Commit + Tag** → `v1.0-module11.2.0`

---

## Doğrulama Testi

```
Test Mesajı: "klimam çalışmıyor ve yastığım eksik"
(Verified misafir — oda DB'de kayıtlı)

Beklenen Sonuçlar:
✅ Claude intents[]: [{technical,"klimam"},{housekeeping,"yastık"}]
✅ ai_intents: 2 ayrı satır, aynı guest_message_id
✅ sla_events: 2 ayrı kayıt (technical + housekeeping)
✅ Telegram teknik grubu: butonlu mesaj "klimam çalışmıyor"
✅ Telegram housekeeping grubu: butonlu mesaj "yastık eksik"
✅ Misafir: "✅ Talepleriniz iletildi:\n• klima → Teknik Servis\n• yastık → Housekeeping"
✅ SLA: Her event bağımsız countdown (handle-callback.ts değişmedi)
✅ Butona basıldığında: doğru sla_event güncellenir, resepsiyona ayrı bilgi gider
```
