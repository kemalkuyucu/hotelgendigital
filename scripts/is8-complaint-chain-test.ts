/**
 * IS 8 — SIKAYET ONAYI -> COZUM ZINCIRI birim testi (local, gitignored).
 *
 * GERCEK handleHousekeepingCallback calistirilir; Supabase ve Telegram sahte:
 *   - fake supa: conversations/inhouse_guests_v2/bot_messages zincirlerini karsilar
 *   - global.fetch stub: Telegram cagrilarini YAKALAR (ag'a cikmaz)
 *
 * DOGRULANAN: [Evet, simdi] ARTIK DOGRUDAN FORWARD ETMEZ; normal cozum zincirini
 * baslatir (ambiguous -> TIP, degilse ADET), state KAPANMAZ, damga (v) artar.
 * [Simdi degil, sonra] forward etmez ve state'i kapatir.
 *
 * TEST EDILEMEYEN: gercek Telegram butonlari + gercek forward karti -> canli UAT.
 */
import { handleHousekeepingCallback } from '@/lib/sla/handle-housekeeping-callback';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Store {
  conv: Record<string, unknown>;
  inhouse: { guest_count: number } | null;
}

interface TgCall { method: string; body: Record<string, unknown> }

function makeFakeSupa(store: Store) {
  const from = (table: string) => {
    const ctx: { op: string | null; payload: Record<string, unknown> | null } = { op: null, payload: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: () => Promise.resolve({ data: null, error: null }),
      update: (p: Record<string, unknown>) => { ctx.op = 'update'; ctx.payload = p; return chain; },
      eq: () => chain,
      maybeSingle: async () => {
        if (table === 'conversations') return { data: store.conv, error: null };
        if (table === 'inhouse_guests_v2') return { data: store.inhouse, error: null };
        return { data: null, error: null };
      },
      // chain'i awaitable yapar: `await supa.from(x).update(y).eq(...)`
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        if (ctx.op === 'update' && table === 'conversations' && ctx.payload) {
          Object.assign(store.conv, ctx.payload);
        }
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      },
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

async function runCase(p: {
  name: string;
  state: Record<string, unknown>;
  callbackData: string;
  guestCount: number | null;
  expect: (tg: TgCall[], store: Store, errs: string[]) => void;
}): Promise<string[]> {
  const store: Store = {
    conv: {
      id: 'conv-1',
      telegram_chat_id: '758605940',
      hk_pending: true,
      hk_pending_text: JSON.stringify(p.state),
    },
    inhouse: p.guestCount === null ? null : { guest_count: p.guestCount },
  };
  const tg: TgCall[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    const method = String(url).split('/').pop() ?? '';
    tg.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
    return { ok: true, json: async () => ({ ok: true }) };
  }) as unknown as typeof fetch;

  const errs: string[] = [];
  try {
    await handleHousekeepingCallback({
      supa: makeFakeSupa(store),
      botToken: 'TEST_TOKEN',
      callbackQueryId: 'cbq-1',
      callbackData: p.callbackData,
      callbackChatId: 758605940,
      callbackMessageId: 42,
    });
    p.expect(tg, store, errs);
  } catch (e) {
    errs.push(`THROW: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
  return errs.map((e) => `FAIL [${p.name}] ${e}`);
}

const sent = (tg: TgCall[]) => tg.filter((c) => c.method === 'sendMessage');
const texts = (tg: TgCall[]) => sent(tg).map((c) => String(c.body.text ?? ''));
const buttons = (tg: TgCall[]) => {
  const m = sent(tg).find((c) => c.body.reply_markup);
  const rm = m?.body.reply_markup as { inline_keyboard?: { text: string; callback_data: string }[][] } | undefined;
  return (rm?.inline_keyboard ?? []).flat();
};

async function main() {
  const fails: string[] = [];
  let pass = 0;
  const check = (r: string[]) => { if (r.length === 0) pass++; else fails.push(...r); };

  // 1) AMBIGUOUS sikayet ("havlu neden degismedi?") + [Evet, simdi] -> TIP sorulmali
  check(await runCase({
    name: 'hk:c:1 ambiguous -> TIP sorusu',
    state: { items: [{ c: 4, q: null, a: true }], i: 0, v: 5, cm: true },
    callbackData: 'hk:c:1:conv-1:5',
    guestCount: 3,
    expect: (tg, store, errs) => {
      if (store.conv.hk_pending !== true) errs.push('state KAPANDI (zincir devam etmeliydi)');
      if (!texts(tg).some((t) => t.includes('Hangi havlu'))) errs.push(`TIP sorusu yok: ${JSON.stringify(texts(tg))}`);
      const cds = buttons(tg).map((b) => b.callback_data);
      if (!cds.every((d) => d.startsWith('hk:s:'))) errs.push(`TIP butonu degil: ${JSON.stringify(cds)}`);
      // DAMGA: v artmis ve persist edilmis olmali
      const st = JSON.parse(String(store.conv.hk_pending_text));
      if (st.v !== 6) errs.push(`damga artmadi: v=${st.v} (beklenen 6)`);
      if (st.cm !== true) errs.push('cm bayragi kayboldu (etiket propagasyonu kirilir)');
      if (!cds.every((d) => d.endsWith(':6'))) errs.push(`buton damgasi state ile uyumsuz: ${JSON.stringify(cds)}`);
    },
  }));

  // 2) TIPI BELLI sikayet ("yuz havlusu neden yok?") + [Evet, simdi] -> ADET sorulmali
  check(await runCase({
    name: 'hk:c:1 tip belli -> ADET sorusu (pax-duyarli)',
    state: { items: [{ c: 2, q: null, a: false }], i: 0, v: 1, cm: true },
    callbackData: 'hk:c:1:conv-1:1',
    guestCount: 3,
    expect: (tg, store, errs) => {
      if (store.conv.hk_pending !== true) errs.push('state KAPANDI');
      if (!texts(tg).some((t) => t.includes('Kac adet'))) errs.push(`ADET sorusu yok: ${JSON.stringify(texts(tg))}`);
      const cds = buttons(tg).map((b) => b.callback_data);
      if (!cds.every((d) => d.startsWith('hk:q:'))) errs.push(`ADET butonu degil: ${JSON.stringify(cds)}`);
      // pax=3 -> 1..4 buton (pax+1, esik asimi dahil): AUTO-1 OLMADIGININ kaniti
      if (cds.length !== 4) errs.push(`adet butonu sayisi ${cds.length} (pax=3 -> 4 beklenir)`);
    },
  }));

  // 3) [Simdi degil, sonra] -> forward YOK, state kapanir (REGRESYON)
  check(await runCase({
    name: 'hk:c:0 -> erteleme, forward yok',
    state: { items: [{ c: 4, q: null, a: true }], i: 0, v: 2, cm: true },
    callbackData: 'hk:c:0:conv-1:2',
    guestCount: 2,
    expect: (tg, store, errs) => {
      if (store.conv.hk_pending !== false) errs.push('state kapanmadi');
      if (!texts(tg).some((t) => t.includes('dilediğiniz an'))) errs.push(`erteleme mesaji yok: ${JSON.stringify(texts(tg))}`);
      if (texts(tg).some((t) => t.includes('Hangi havlu') || t.includes('Kac adet'))) errs.push('erteleme dalinda soru soruldu');
      if (buttons(tg).length > 0) errs.push('erteleme dalinda buton gonderildi');
    },
  }));

  // 4) BAYAT DAMGA: eski onay butonu (cift-tik) -> RED, state DEGISMEZ
  check(await runCase({
    name: 'hk:c:1 bayat damga -> RED',
    state: { items: [{ c: 4, q: null, a: true }], i: 0, v: 9, cm: true },
    callbackData: 'hk:c:1:conv-1:5', // ekranda kalan eski buton
    guestCount: 2,
    expect: (tg, store, errs) => {
      const answers = tg.filter((c) => c.method === 'answerCallbackQuery');
      if (!answers.some((a) => String(a.body.text ?? '').includes('güncel değil'))) {
        errs.push(`RED uyarisi yok: ${JSON.stringify(answers.map((a) => a.body.text))}`);
      }
      if (sent(tg).length > 0) errs.push('RED oldugu halde mesaj gonderildi');
      const st = JSON.parse(String(store.conv.hk_pending_text));
      if (st.v !== 9) errs.push(`RED'de state degisti: v=${st.v}`);
    },
  }));

  const total = 4;
  for (const f of fails) console.log(f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(fails.length === 0 ? 0 : 1);
}

void main();
