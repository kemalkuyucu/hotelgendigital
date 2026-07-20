/**
 * IS 8 — BILGI-SORU KAPISI flag-seviyesi test (local, gitignored).
 *
 * NE TEST EDILIR (gercek moduller import edilir, kopya YOK):
 *   - isInfoQuestion            (src/lib/ai/department-brains.ts)  → GERCEK fonksiyon
 *   - HOUSEKEEPING_ITEM_PATTERNS / HOUSEKEEPING_SERVICE_PATTERNS   → GERCEK diziler
 *   - dispatchToDepartmentBrain (housekeeping)                     → GERCEK beyin,
 *     BILGI sorusunda LLM cagrisi YAPMADAN handled:false donmeli.
 *
 * NE TEST EDILEMEZ:
 *   - hk-gate / bagaj-override'in kendisi classify-and-respond icinde, LLM cagrisinin
 *     ARDINDAN calisir → offline calistirilamaz. Bu yuzden karar GIRDILERI (hkMatch,
 *     isQ) gercek modullerden alinir; dallanma ifadesi (tek satir) burada aynalanir.
 *   - Talep dalinin LLM metni (API anahtari gerektirir) → canli UAT konusu.
 */
import {
  isInfoQuestion,
  isHousekeepingComplaint,
  HOUSEKEEPING_ITEM_PATTERNS,
  HOUSEKEEPING_SERVICE_PATTERNS,
  dispatchToDepartmentBrain,
} from '@/lib/ai/department-brains';
import { normalizeTr } from '@/lib/utils/normalize-tr';

// classify-and-respond.ts:364 ile BIREBIR ayna (orada export DEGIL, local const).
const BAGGAGE_KEYWORDS = ['bagaj', 'valiz', 'bavul', 'baggage', 'luggage'];

type HkBranch = 'NO_HK_GATE' | 'HK_COMPLAINT' | 'HK_INFO' | 'HK_REQUEST';
type BagBranch = 'NO_BAG' | 'BAG_INFO' | 'BAG_FORWARD';

function hkMatches(msg: string): boolean {
  return (
    HOUSEKEEPING_ITEM_PATTERNS.some((p) => p.re.test(msg)) ||
    HOUSEKEEPING_SERVICE_PATTERNS.some((re) => re.test(msg))
  );
}

// classify-and-respond.ts hk-gate 3-dal onceliginin aynasi:
//   (1) SIKAYET  (2) BILGI SORUSU  (3) normal TALEP
function hkBranch(msg: string): HkBranch {
  if (!hkMatches(msg)) return 'NO_HK_GATE';
  if (isHousekeepingComplaint(msg)) return 'HK_COMPLAINT';
  return isInfoQuestion(msg) ? 'HK_INFO' : 'HK_REQUEST';
}

// classify-and-respond.ts bagaj-override dallanmasinin aynasi.
function bagBranch(msg: string): BagBranch {
  const n = normalizeTr(msg);
  if (!BAGGAGE_KEYWORDS.some((k) => n.includes(k))) return 'NO_BAG';
  return isInfoQuestion(msg) ? 'BAG_INFO' : 'BAG_FORWARD';
}

interface Case {
  msg: string;
  q: boolean;          // isInfoQuestion beklentisi
  hk: HkBranch;        // hk-gate dal beklentisi
  bag?: BagBranch;     // sadece bagaj vakalarinda
  note?: string;
}

const CASES: Case[] = [
  // ── A) HOUSEKEEPING BILGI SORUSU → HK_INFO (buton/forward YOK, KB akisi cevaplar)
  { msg: 'havlu ne zaman degisir?', q: true, hk: 'HK_INFO', note: 'CANLI UAT kusuru' },
  { msg: 'havlular ne zaman değişir', q: true, hk: 'HK_INFO' },
  { msg: 'havlu kac gunde bir degistirilir?', q: true, hk: 'HK_INFO' },
  { msg: 'carsaf ne zaman degisir', q: true, hk: 'HK_INFO' },
  { msg: 'çarşaflar kaçta değiştiriliyor?', q: true, hk: 'HK_INFO' },
  { msg: 'nevresim ne zaman degisiyor', q: true, hk: 'HK_INFO' },
  { msg: 'yastik kac adet veriliyor?', q: true, hk: 'HK_INFO' },
  { msg: 'sabun ne kadar surede yenilenir', q: true, hk: 'HK_INFO' },
  { msg: 'sampuan hangi markadir?', q: true, hk: 'HK_INFO' },
  { msg: 'tuvalet kagidi nerede duruyor?', q: true, hk: 'HK_INFO' },
  { msg: 'battaniye nasil isteyebilirim?', q: true, hk: 'HK_INFO' },
  { msg: 'dus jeli var mi?', q: true, hk: 'HK_INFO' },
  { msg: 'ayak havlusu ucretli mi?', q: true, hk: 'HK_INFO' },
  { msg: 'yuz havlusu neden yok?', q: true, hk: 'HK_COMPLAINT', note: 'soru-formatli sikayet: ARTIK sikayet dali (onceden sessiz yutuluyordu)' },
  { msg: 'когда меняют полотенца?', q: true, hk: 'NO_HK_GATE', note: 'RU: item pattern TR-only' },

  // ── B) HOUSEKEEPING TALEP → HK_REQUEST (buton + forward AYNEN kalir) [REGRESYON]
  { msg: '2 banyo havlusu', q: false, hk: 'HK_REQUEST' },
  { msg: 'havlu getirir misiniz?', q: false, hk: 'HK_REQUEST', note: 'kibar talep, soru isareti tuzagi' },
  { msg: 'havlu istiyorum', q: false, hk: 'HK_REQUEST' },
  { msg: 'iki havlu lutfen', q: false, hk: 'HK_REQUEST' },
  { msg: 'havlu', q: false, hk: 'HK_REQUEST' },
  { msg: 'yastik lazim', q: false, hk: 'HK_REQUEST' },
  { msg: 'carsaf degistirir misiniz', q: false, hk: 'HK_REQUEST' },
  { msg: 'odami temizler misiniz', q: false, hk: 'HK_REQUEST', note: 'service pattern' },
  { msg: 'odam temizlensin', q: false, hk: 'HK_REQUEST' },
  { msg: 'temizlik istiyorum', q: false, hk: 'HK_REQUEST' },
  { msg: 'temizlik gonderin', q: false, hk: 'HK_REQUEST' },
  { msg: 'odami toplayabilir misiniz', q: false, hk: 'HK_REQUEST' },
  { msg: '3 sampuan gonderin', q: false, hk: 'HK_REQUEST' },
  { msg: 'tuvalet kagidi bitti', q: false, hk: 'HK_REQUEST' },
  { msg: 'sabun yok odada', q: false, hk: 'HK_COMPLAINT', note: 'DAVRANIS DEGISTI: "yok" sinyali -> sikayet dali' },

  // ── A2) SIKAYET DALI (esya + problem sinyali) — talimat test-gate'i
  { msg: 'havlu neden degismedi?', q: true, hk: 'HK_COMPLAINT', note: 'soru + sikayet -> SIKAYET kazanir' },
  { msg: 'havlum degismedi', q: false, hk: 'HK_COMPLAINT', note: 'soru yok, tek basina sikayet' },
  { msg: 'havlular değiştirilmedi', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'çarşaflar hala kirli', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'yastik kirli', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'banyo havlusu lekeli', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'havlu temiz degil', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'nevresim yenilenmemis', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'sampuan eksik', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'havlu getirilmedi', q: false, hk: 'HK_COMPLAINT' },
  { msg: 'tuvalet kagidi yok', q: false, hk: 'HK_COMPLAINT' },
  // Sikayet-tuzagi: esya VAR ama problem sinyali YOK -> sikayet DEGIL
  // (nevresim degistirin / yastik kac adet veriliyor / tuvalet kagidi bitti
  //  vakalari asagidaki A ve B bolumlerinde zaten var — tekrarlanmadi.)
  { msg: 'havlu ne zaman degistirilir?', q: true, hk: 'HK_INFO', note: 'degistiriLIR != degistirilMEDI' },
  { msg: 'battaniye rica ediyorum', q: false, hk: 'HK_REQUEST' },
  { msg: 'dus jeli gonderebilir misiniz', q: false, hk: 'HK_REQUEST' },
  { msg: 'nevresim degistirin lutfen', q: false, hk: 'HK_REQUEST' },
  { msg: '2 yastik ve 1 battaniye', q: false, hk: 'HK_REQUEST' },

  // ── C) COK DILLI SORU DEDEKTORU (pozitif) — hk pattern TR-only oldugu icin NO_HK_GATE
  { msg: 'when are the towels changed?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'what time is the room cleaned?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'how do i get extra pillows', q: true, hk: 'NO_HK_GATE' },
  { msg: 'where can i find soap', q: true, hk: 'NO_HK_GATE' },
  { msg: 'is there a laundry service?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'do you have extra blankets?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'which floor is the spa on', q: true, hk: 'NO_HK_GATE' },
  { msg: 'why is my room not cleaned', q: true, hk: 'NO_HK_GATE' },
  { msg: 'wann wird das Zimmer gereinigt?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'wo ist das Handtuch?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'wieviel kostet die Reinigung?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'welche Handtücher gibt es?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'quand changez-vous les serviettes?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'combien de serviettes?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'quelle heure est le menage', q: true, hk: 'NO_HK_GATE' },
  { msg: 'где полотенца?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'как заказать уборку?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'куда положить чемодан?', q: true, hk: 'NO_HK_GATE' },
  { msg: 'متى يتم تغيير المناشف؟', q: true, hk: 'NO_HK_GATE' },
  { msg: 'أين المنشفة؟', q: true, hk: 'NO_HK_GATE' },
  { msg: 'هل يوجد صابون؟', q: true, hk: 'NO_HK_GATE' },

  // ── D) YANLIS-POZITIF TUZAKLARI (soru DEGIL → TALEP kalmali)
  { msg: 'klima calismiyor', q: false, hk: 'NO_HK_GATE', note: 'calisMIyor' },
  { msg: 'kimlik numaram 123456', q: false, hk: 'NO_HK_GATE', note: 'KIMlik' },
  { msg: 'muz alabilir miyim', q: false, hk: 'NO_HK_GATE', note: 'MUz / miyim' },
  { msg: 'minibar bos', q: false, hk: 'NO_HK_GATE', note: 'miNIbar' },
  { msg: 'su kacagi var', q: false, hk: 'NO_HK_GATE', note: 'KACagi' },
  { msg: 'odama gelir misiniz', q: false, hk: 'NO_HK_GATE' },
  { msg: 'can you send shampoo', q: false, hk: 'NO_HK_GATE' },
  { msg: 'may i have a towel', q: false, hk: 'NO_HK_GATE' },
  { msg: 'ich brauche ein Handtuch', q: false, hk: 'NO_HK_GATE' },
  { msg: 'нужно полотенце', q: false, hk: 'NO_HK_GATE' },
  { msg: 'أريد منشفة', q: false, hk: 'NO_HK_GATE' },
  { msg: '', q: false, hk: 'NO_HK_GATE' },
  { msg: '   ', q: false, hk: 'NO_HK_GATE' },

  // ── E) BAGAJ KARDES-DAL (DEGISMEMELI) [REGRESYON]
  { msg: 'bagaj nereye birakilir?', q: true, hk: 'NO_HK_GATE', bag: 'BAG_INFO' },
  { msg: 'bavulum nerede?', q: true, hk: 'NO_HK_GATE', bag: 'BAG_INFO' },
  { msg: 'luggage storage where?', q: true, hk: 'NO_HK_GATE', bag: 'BAG_INFO' },
  { msg: 'bagajimi alir misiniz', q: false, hk: 'NO_HK_GATE', bag: 'BAG_FORWARD' },
  { msg: 'valizimi odaya cikarir misiniz', q: false, hk: 'NO_HK_GATE', bag: 'BAG_FORWARD' },
  { msg: 'bagajimi getirin', q: false, hk: 'NO_HK_GATE', bag: 'BAG_FORWARD' },
];

// BILGI sorusunda GERCEK housekeeping beyni LLM'siz handled:false donmeli.
const BRAIN_CASES = [
  'havlu ne zaman degisir?',
  'carsaf kacta degisir',
  'yastik kac adet veriliyor?',
  'dus jeli var mi?',
];

// SIKAYETTE gercek beyin LLM'siz hkComplaint isareti donmeli (replyText BOS).
// ambiguous KRITIK: onay sonrasi TIP sorulup sorulmayacagini o belirler.
const BRAIN_COMPLAINT_CASES: [string, number, boolean][] = [
  ['havlu neden degismedi?', 4, true],   // "havlu" -> TIP sorulacak
  ['havlum degismedi', 4, true],
  ['banyo havlusu lekeli', 1, false],    // tip belli -> dogrudan ADET
  ['çarşaflar hala kirli', 6, false],
  ['tuvalet kagidi yok', 12, false],
];

async function main() {
  let pass = 0;
  const fails: string[] = [];

  for (const c of CASES) {
    const q = isInfoQuestion(c.msg);
    const hk = hkBranch(c.msg);
    const errs: string[] = [];
    if (q !== c.q) errs.push(`isInfoQuestion=${q} (beklenen ${c.q})`);
    if (hk !== c.hk) errs.push(`hkBranch=${hk} (beklenen ${c.hk})`);
    // INVARYANT: sikayet dedektoru <=> SIKAYET dali. isHousekeepingComplaint esya
    // sarti tasidigi icin true olan her mesaj hk-gate'e de girer; ayrisirlarsa
    // dedektor ile kapi PATTERN listeleri kaymis demektir.
    if (isHousekeepingComplaint(c.msg) !== (hk === 'HK_COMPLAINT')) {
      errs.push(`isHousekeepingComplaint=${isHousekeepingComplaint(c.msg)} ama dal=${hk}`);
    }
    if (c.bag) {
      const b = bagBranch(c.msg);
      if (b !== c.bag) errs.push(`bagBranch=${b} (beklenen ${c.bag})`);
    }
    if (errs.length === 0) pass++;
    else fails.push(`FAIL "${c.msg}" → ${errs.join(' | ')}`);
  }

  // GERCEK beyin: BILGI sorusu → handled:false, LLM cagrisi YOK (API anahtari gerekmez).
  for (const msg of BRAIN_CASES) {
    try {
      const r = await dispatchToDepartmentBrain({
        department: 'housekeeping',
        requestText: msg,
        guestMessage: msg,
        hotelName: 'Test Otel',
        hotelContext: null,
        conversationContext: [],
      });
      const ok =
        r.handled === false &&
        !r.replyText &&
        !r.hkItems?.length &&
        r.isInfoOnly !== true;
      if (ok) pass++;
      else fails.push(`FAIL brain "${msg}" → ${JSON.stringify(r)}`);
    } catch (e) {
      fails.push(`FAIL brain "${msg}" → THROW (LLM cagrisi denendi?): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // GERCEK beyin: SIKAYET -> handled:true + hkComplaint, replyText BOS, LLM cagrisi YOK.
  for (const [msg, code, ambiguous] of BRAIN_COMPLAINT_CASES) {
    try {
      const r = await dispatchToDepartmentBrain({
        department: 'housekeeping',
        requestText: msg,
        guestMessage: msg,
        hotelName: 'Test Otel',
        hotelContext: null,
        conversationContext: [],
      });
      const ok =
        r.handled === true &&
        r.hkComplaint?.code === code &&
        r.hkComplaint?.ambiguous === ambiguous &&
        r.replyText === '' &&
        !r.hkItems?.length;
      if (ok) pass++;
      else fails.push(`FAIL brain-complaint "${msg}" (beklenen code=${code} ambiguous=${ambiguous}) → ${JSON.stringify(r)}`);
    } catch (e) {
      fails.push(`FAIL brain-complaint "${msg}" → THROW (LLM cagrisi denendi?): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const total = CASES.length + BRAIN_CASES.length + BRAIN_COMPLAINT_CASES.length;
  for (const f of fails) console.log(f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(fails.length === 0 ? 0 : 1);
}

void main();
