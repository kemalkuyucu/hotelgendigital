/**
 * LEAD CAPTURE — etkinlik/organizasyon talebinde ad-soyad + telefon toplama testi
 * (local, is8 korpusu).
 *
 * GERCEK modulleri import eder (kopya fonksiyon YASAK): karar mantiginin TAMAMI
 * `@/lib/lead/lead-capture` icinde saf oldugu icin burada AYNA YOK — canli kodun
 * ta kendisi kosulur. Ag/LLM cagrisi YOK.
 *
 * KAPSAM: baslangic turu (inhouse -> telefon / non-guest -> isim), isim turu
 * (mesajin TAMAMI isimdir), telefon turu (paylasilan extractPhone; yoksa 1 nazik
 * tekrar, sonra kapanis), metadata state round-trip ve personel kartlari.
 * DOGRULANAMAZ (canli UAT): Telegram editMessageText, gercek kart gorunumu.
 */
import {
  startLeadCapture,
  advanceLead,
  readLeadCapture,
  withLeadCapture,
  clearLeadCapture,
  buildLeadInterimCard,
  buildLeadFinalCard,
  LEAD_ASK_NAME_TR,
  LEAD_ASK_PHONE_TR,
  LEAD_RETRY_PHONE_TR,
  LEAD_CLOSE_TR,
  LEAD_THANKS_TR,
  LEAD_METADATA_KEY,
  type LeadCaptureState,
} from '@/lib/lead/lead-capture';
import { extractPhone } from '@/lib/utils/phone';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

const TOPIC = 'dugun organizasyonu icin kimle gorusebilirim';

// (1) BASLANGIC — etkinlik talebi geldiginde hangi soru sorulur?
const inhouse = startLeadCapture({
  topic: TOPIC, guestName: 'AHMET YILMAZ', room: '102', notifyChatId: -100123, notifyMsgId: 55,
});
check('1a inhouse -> telefon turu', inhouse.state.step, 'phone');
check('1b inhouse sorusu', inhouse.question, LEAD_ASK_PHONE_TR);
check('1c inhouse isim tasindi', inhouse.state.name, 'AHMET YILMAZ');
check('1d ara-kart msgId tasindi', inhouse.state.notifyMsgId, 55);
check('1e topic tasindi', inhouse.state.topic, TOPIC);

const guestless = startLeadCapture({
  topic: TOPIC, guestName: null, room: null, notifyChatId: -100123, notifyMsgId: 56,
});
check('1f non-guest -> isim turu', guestless.state.step, 'name');
check('1g non-guest sorusu', guestless.question, LEAD_ASK_NAME_TR);
check('1h non-guest isim BOS', guestless.state.name, undefined);
// Telegram profil adi ad-soyad SAYILMAZ: cagiran taraf null gecer (route.ts inhouse sarti)
check('1i bosluklu isim isim sayilmaz', startLeadCapture({
  topic: TOPIC, guestName: '   ', room: null, notifyChatId: 1, notifyMsgId: null,
}).state.step, 'name');

// (2) ISIM TURU — mesajin TAMAMI isimdir (deterministik, LLM'e sorulmaz)
const nameTurn = advanceLead(guestless.state, 'Ahmet Yılmaz');
check('2a isim -> telefon sorusu', nameTurn.action, 'ask_phone');
check('2b isim mesajin TAMAMI', nameTurn.action === 'ask_phone' ? nameTurn.state.name : null, 'Ahmet Yılmaz');
check('2c step ilerledi', nameTurn.action === 'ask_phone' ? nameTurn.state.step : null, 'phone');
check('2d cok kelimeli isim kirpilir', advanceLead(guestless.state, '  Ayşe Naz Demir  ').action === 'ask_phone'
  ? (advanceLead(guestless.state, '  Ayşe Naz Demir  ') as { state: LeadCaptureState }).state.name
  : null, 'Ayşe Naz Demir');
check('2e telefon sorusu isimle kisisellesir',
  nameTurn.action === 'ask_phone' ? nameTurn.reply.includes('Ahmet Yılmaz') : false, true);
check('2f bos mesaj -> akis kapanir', advanceLead(guestless.state, '   ').action, 'close');

// (3) TELEFON TURU
const phoneState = nameTurn.action === 'ask_phone' ? nameTurn.state : guestless.state;
const done = advanceLead(phoneState, '0532 123 45 67');
check('3a telefon -> tamamla', done.action, 'complete');
check('3b telefon aynen tasinir', done.action === 'complete' ? done.phone : null, '0532 123 45 67');
check('3c isim state ten gelir', done.action === 'complete' ? done.name : null, 'Ahmet Yılmaz');
check('3d tamamlama cevabi', done.action === 'complete' ? done.reply : null, LEAD_THANKS_TR);

const retry = advanceLead(phoneState, 'vermek istemiyorum');
check('3e telefon yok -> nazik tekrar', retry.action, 'retry');
check('3f tekrar bayragi', retry.action === 'retry' ? retry.state.phoneRetried : null, true);
check('3g tekrar metni', retry.action === 'retry' ? retry.reply : null, LEAD_RETRY_PHONE_TR);

const retried = retry.action === 'retry' ? retry.state : phoneState;
check('3h ikinci kez yok -> kapan', advanceLead(retried, 'yok dedim').action, 'close');
check('3i kapanis metni', (advanceLead(retried, 'yok dedim') as { reply: string }).reply, LEAD_CLOSE_TR);
check('3j tekrardan sonra telefon gelirse tamamlanir', advanceLead(retried, '+90 532 000 00 00').action, 'complete');

// (4) PAYLASILAN TELEFON DEDEKTORU (tek kaynak — ikinci kopya YASAK)
check('4a uluslararasi format', extractPhone('numaram +90 532 123 45 67'), '+90 532 123 45 67');
check('4b bitisik format', extractPhone('05321234567'), '05321234567');
check('4c metinde telefon yok', extractPhone('merhaba nasilsiniz'), null);
check('4d oda no telefon DEGIL', extractPhone('102'), null);
check('4e isim telefon DEGIL', extractPhone('Ahmet Yılmaz'), null);

// (5) STATE — conversations.metadata jsonb (MIGRATION YOK)
const meta0 = { baska_anahtar: 'korunmali' };
const meta1 = withLeadCapture(meta0, inhouse.state);
check('5a state geri okunur', readLeadCapture(meta1)?.step, 'phone');
check('5b yabanci anahtar korunur (yazarken)', meta1.baska_anahtar, 'korunmali');
check('5c anahtar adi', Object.prototype.hasOwnProperty.call(meta1, LEAD_METADATA_KEY), true);
const meta2 = clearLeadCapture(meta1);
check('5d temizlenince state YOK', readLeadCapture(meta2), null);
check('5e yabanci anahtar korunur (temizlerken)', meta2.baska_anahtar, 'korunmali');
check('5f bozuk step -> state YOK', readLeadCapture({ [LEAD_METADATA_KEY]: { step: 'x', topic: 't' } }), null);
check('5g topic yoksa -> state YOK', readLeadCapture({ [LEAD_METADATA_KEY]: { step: 'name' } }), null);
check('5h metadata null -> state YOK', readLeadCapture(null), null);

// (6) PERSONEL KARTLARI
const interim = buildLeadInterimCard({ room: '102', guestName: 'AHMET YILMAZ', message: TOPIC });
check('6a ara-kart guncelleme vaadi', interim.includes('güncellenecektir'), true);
check('6b ara-kart SLA yok ibaresi', interim.includes('SLA yok'), true);
const finalCard = buildLeadFinalCard({ name: 'Ahmet Yılmaz', phone: '0532 123 45 67', topic: TOPIC, room: '102' });
check('6c final kart ad-soyad', finalCard.includes('Ahmet Yılmaz'), true);
check('6d final kart telefon', finalCard.includes('0532 123 45 67'), true);
check('6e final kart konu', finalCard.includes(TOPIC), true);
check('6f final kart oda (inhouse)', finalCard.includes('Oda: 102'), true);
check('6g final kart SLA yok ibaresi', finalCard.includes('(SLA yok)'), true);
check('6h non-guest kartinda oda satiri YOK',
  buildLeadFinalCard({ name: 'Ali Veli', phone: '05320000000', topic: TOPIC, room: null }).includes('Oda:'), false);
check('6i HTML escape (enjeksiyon)',
  buildLeadFinalCard({ name: '<b>Ali', phone: '05320000000', topic: TOPIC, room: null }).includes('&lt;b&gt;Ali'), true);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
