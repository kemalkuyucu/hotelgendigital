/**
 * LEAD CAPTURE — etkinlik/organizasyon talebinde ad-soyad + telefon toplama testi
 * (local, is8 korpusu).
 *
 * GERCEK modulleri import eder (kopya fonksiyon YASAK): karar mantiginin TAMAMI
 * `@/lib/lead/lead-capture` icinde saf oldugu icin burada AYNA YOK — canli kodun
 * ta kendisi kosulur. Ag/LLM cagrisi YOK.
 *
 * KAPSAM (IS 18 — TEK AKIS):
 *  - baslangic: kart YOK (misafir turu ne olursa olsun), tek acilista uc bilgi istenir
 *  - esnek doldurma: isim-only -> telefon sor / telefon-only -> isim sor / ikisi -> TAMAM
 *  - vazgecme sozcugu -> kart YOK, iletim VAAT EDILMEZ
 *  - decideLeadNotify: yalniz 'complete' fazinda kart
 *  - metadata state round-trip + IS 18 ONCESI state ile geriye uyum
 *  - cok dillilik (5 dil), dilin state'te tasinmasi, personel kartinin TR kalmasi
 * DOGRULANAMAZ (canli UAT): gercek Telegram karti, misafirin ekranda gordugu metin.
 */
import {
  startLeadCapture,
  advanceLead,
  readLeadCapture,
  withLeadCapture,
  clearLeadCapture,
  buildLeadFinalCard,
  decideLeadNotify,
  isLeadAbandon,
  LEAD_METADATA_KEY,
  type LeadCaptureState,
} from '@/lib/lead/lead-capture';
import { guestText } from '@/lib/i18n/guest-text';
import { extractPhone } from '@/lib/utils/phone';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

const TOPIC = 'dugun organizasyonu icin kimle gorusebilirim';
const start = (over: Partial<Parameters<typeof startLeadCapture>[0]> = {}) =>
  startLeadCapture({ topic: TOPIC, room: null, notifyChatId: -100123, language: 'tr', ...over });

// (1) BASLANGIC — herkes AYNI: tek acilista isim + soyisim + telefon istenir
const fresh = start();
const verified = start({ room: '102' }); // dogrulanmis misafir (oda BILINIYOR)
check('1a acilis sorusu lead_ask_all', fresh.question, guestText('lead_ask_all', 'tr'));
check('1b oda bilinse de AYNI soru', verified.question, fresh.question);
check('1c baslangicta isim YOK', fresh.state.name, undefined);
check('1d baslangicta telefon YOK', fresh.state.phone, undefined);
check('1e topic tasindi', fresh.state.topic, TOPIC);
check('1f notifyChatId tasindi', fresh.state.notifyChatId, -100123);
check('1g oda tasindi (kart icin)', verified.state.room, '102');
check('1h oda yoksa null', fresh.state.room, null);
check('1i dil state e yazildi', fresh.state.language, 'tr');

// (2) ESNEK DOLDURMA — yalniz ISIM geldi -> SADECE telefon istenir
const nameOnly = advanceLead(fresh.state, 'Ahmet Yılmaz');
check('2a isim -> telefon sorusu', nameOnly.action, 'ask_phone');
check('2b telefon sorusu metni', nameOnly.action === 'ask_phone' ? nameOnly.reply : null, guestText('lead_ask_phone', 'tr'));
check('2c isim state e yazildi', nameOnly.action === 'ask_phone' ? nameOnly.state.name : null, 'Ahmet Yılmaz');
check('2d telefon hala YOK', nameOnly.action === 'ask_phone' ? nameOnly.state.phone : 'X', undefined);
check('2e cok kelimeli isim kirpilir + tek bosluga iner',
  (() => { const r = advanceLead(fresh.state, '  Ayşe  Naz Demir  '); return r.action === 'ask_phone' ? r.state.name : null; })(),
  'Ayşe Naz Demir');

// (3) ESNEK DOLDURMA — yalniz TELEFON geldi -> SADECE isim istenir
const phoneOnly = advanceLead(fresh.state, '0532 123 45 67');
check('3a telefon -> isim sorusu', phoneOnly.action, 'ask_name');
check('3b isim sorusu metni', phoneOnly.action === 'ask_name' ? phoneOnly.reply : null, guestText('lead_ask_name', 'tr'));
check('3c telefon state e yazildi', phoneOnly.action === 'ask_name' ? phoneOnly.state.phone : null, '0532 123 45 67');
check('3d isim hala YOK', phoneOnly.action === 'ask_name' ? phoneOnly.state.name : 'X', undefined);

// (4) TAMAMLANMA — iki sirayla da, tek mesajda da
const doneAfterName = advanceLead(nameOnly.action === 'ask_phone' ? nameOnly.state : fresh.state, '05321234567');
check('4a isim sonra telefon -> TAMAM', doneAfterName.action, 'complete');
check('4b isim state ten gelir', doneAfterName.action === 'complete' ? doneAfterName.name : null, 'Ahmet Yılmaz');
check('4c telefon aynen tasinir', doneAfterName.action === 'complete' ? doneAfterName.phone : null, '05321234567');
check('4d tamamlanma cevabi', doneAfterName.action === 'complete' ? doneAfterName.reply : null, guestText('lead_thanks', 'tr'));

const doneAfterPhone = advanceLead(phoneOnly.action === 'ask_name' ? phoneOnly.state : fresh.state, 'Ahmet Yılmaz');
check('4e telefon sonra isim -> TAMAM', doneAfterPhone.action, 'complete');
check('4f state teki telefon korunmus', doneAfterPhone.action === 'complete' ? doneAfterPhone.phone : null, '0532 123 45 67');
check('4g isim yeni mesajdan', doneAfterPhone.action === 'complete' ? doneAfterPhone.name : null, 'Ahmet Yılmaz');

const oneShot = advanceLead(fresh.state, 'Ahmet Yılmaz 0532 123 45 67');
check('4h tek mesajda isim+telefon -> TAMAM', oneShot.action, 'complete');
check('4i telefon ayiklandi', oneShot.action === 'complete' ? oneShot.phone : null, '0532 123 45 67');
check('4j kalan metin isim sayildi', oneShot.action === 'complete' ? oneShot.name : null, 'Ahmet Yılmaz');
// Ilk verilen isim KORUNUR (misafir ismini tekrar yazmak zorunda degil)
check('4k sonraki mesaj ismi EZMEZ',
  (() => {
    const s: LeadCaptureState = { ...fresh.state, name: 'Ahmet Yılmaz' };
    const r = advanceLead(s, 'Mehmet 05321234567');
    return r.action === 'complete' ? r.name : null;
  })(), 'Ahmet Yılmaz');

// (5) VAZGECME — kart YOK, iletim VAAT EDILMEZ
const abandonWords = ['istemiyorum', 'vermek istemiyorum', 'yok', 'Hayır', 'vazgeçtim', 'gerek yok', 'iptal',
  'no thanks', 'not interested', "I don't want to share", 'never mind', 'cancel',
  'kein Interesse', 'nein', 'nein danke', 'не хочу', 'нет', 'لا أريد'];
for (const w of abandonWords) {
  check(`5a["${w}"] vazgecme algilanir`, isLeadAbandon(w), true);
  check(`5b["${w}"] akis kapanir`, advanceLead(fresh.state, w).action, 'close');
}
check('5c kapanis metni (vaat YOK)', (advanceLead(fresh.state, 'istemiyorum') as { reply: string }).reply, guestText('lead_close', 'tr'));
check('5d kapanis metni "ilettim" DEMEZ', guestText('lead_close', 'tr').includes('ilettim'), false);
check('5e kapanis metni "ekibimiz" VAAT ETMEZ', guestText('lead_close', 'tr').includes('ekibimiz'), false);
// YANLIS POZITIF olmamali: normal isim/telefon vazgecme sayilmaz
for (const w of ['Ahmet Yılmaz', 'Nolan Yoksal', '05321234567', 'Иван Иванов', 'Hans Meier']) {
  check(`5f["${w}"] vazgecme DEGIL`, isLeadAbandon(w), false);
}
// Numara TASIYAN mesaj asla vazgecme sayilmaz (talep yutulmasin)
const abandonWithPhone = advanceLead(
  { ...fresh.state, name: 'Ahmet Yılmaz' },
  'aslında istemiyorum ama numaram 0532 123 45 67',
);
check('5g vazgecme sozu + numara -> TAMAMLANIR', abandonWithPhone.action, 'complete');
check('5h bos mesaj -> kapanis', advanceLead(fresh.state, '   ').action, 'close');

// (6) BILDIRIM KARARI — kart YALNIZ tamamlanmada
check('6a start -> kart YOK', decideLeadNotify({ phase: 'start' }).send, false);
check('6b start -> kind null', decideLeadNotify({ phase: 'start' }).kind, null);
check('6c complete -> kart VAR', decideLeadNotify({ phase: 'complete' }).send, true);
check('6d complete -> kind final_new', decideLeadNotify({ phase: 'complete' }).kind, 'final_new');
check('6e abandon -> kart YOK', decideLeadNotify({ phase: 'abandon' }).send, false);
check('6f abandon -> kind null', decideLeadNotify({ phase: 'abandon' }).kind, null);
const ALL_DECISIONS = (['start', 'complete', 'abandon'] as const).map((phase) => decideLeadNotify({ phase }));
check('6g send=false -> kind null invaryanti', ALL_DECISIONS.every((d) => d.send || d.kind === null), true);
check('6h send=true -> kind DOLU invaryanti', ALL_DECISIONS.every((d) => !d.send || d.kind !== null), true);
check('6i tek kart kurali (3 fazdan yalniz 1 i gonderir)', ALL_DECISIONS.filter((d) => d.send).length, 1);

// (7) PAYLASILAN TELEFON DEDEKTORU (tek kaynak — ikinci kopya YASAK)
check('7a uluslararasi format', extractPhone('numaram +90 532 123 45 67'), '+90 532 123 45 67');
check('7b bitisik format', extractPhone('05321234567'), '05321234567');
check('7c metinde telefon yok', extractPhone('merhaba nasilsiniz'), null);
check('7d oda no telefon DEGIL', extractPhone('102'), null);
check('7e isim telefon DEGIL', extractPhone('Ahmet Yılmaz'), null);
// Oda no gibi kisa sayilar isim adayi olarak akar, telefon SAYILMAZ
check('7f kisa sayi -> hala isim sorulur', advanceLead(fresh.state, '102').action, 'ask_phone');

// (8) STATE — conversations.metadata jsonb (MIGRATION YOK)
const meta0 = { baska_anahtar: 'korunmali' };
const meta1 = withLeadCapture(meta0, nameOnly.action === 'ask_phone' ? nameOnly.state : fresh.state);
check('8a state geri okunur', readLeadCapture(meta1)?.name, 'Ahmet Yılmaz');
check('8b yabanci anahtar korunur (yazarken)', meta1.baska_anahtar, 'korunmali');
check('8c anahtar adi', Object.prototype.hasOwnProperty.call(meta1, LEAD_METADATA_KEY), true);
const meta2 = clearLeadCapture(meta1);
check('8d temizlenince state YOK', readLeadCapture(meta2), null);
check('8e yabanci anahtar korunur (temizlerken)', meta2.baska_anahtar, 'korunmali');
check('8f topic yoksa -> state YOK', readLeadCapture({ [LEAD_METADATA_KEY]: { name: 'Ahmet' } }), null);
check('8g metadata null -> state YOK', readLeadCapture(null), null);
check('8h telefon round-trip',
  readLeadCapture(withLeadCapture({}, phoneOnly.action === 'ask_name' ? phoneOnly.state : fresh.state))?.phone, '0532 123 45 67');

// (9) GERIYE UYUM — IS 18 ONCESI state (step/notifyMsgId/isInhouse/phoneRetried)
// Toplanan isim TASINIR; kalkan alanlar sessizce yok sayilir, akis yeni kurala gore surer.
const legacy = readLeadCapture({
  [LEAD_METADATA_KEY]: {
    step: 'phone', topic: TOPIC, notifyChatId: -1, notifyMsgId: 7, name: 'Ahmet', room: '102',
    isInhouse: true, phoneRetried: true, language: 'de',
  },
});
check('9a eski state okunur', legacy?.topic, TOPIC);
check('9b eski state ismi tasinir', legacy?.name, 'Ahmet');
check('9c eski state odasi tasinir', legacy?.room, '102');
check('9d eski state dili tasinir', legacy?.language, 'de');
check('9e eski state te telefon YOK', legacy?.phone, undefined);
check('9f eski akis telefonla TAMAMLANIR', legacy ? advanceLead(legacy, '05321234567').action : null, 'complete');
// IS 17 oncesi state: `language` alani YOK -> 'tr' varsayilir ('en' fallback DEGIL)
check('9g cok eski state dili tr sayilir',
  readLeadCapture({ [LEAD_METADATA_KEY]: { step: 'name', topic: TOPIC, notifyChatId: -1 } })?.language, 'tr');
check('9h bozuk dil kodu okunurken normalize edilir',
  readLeadCapture({ [LEAD_METADATA_KEY]: { topic: TOPIC, language: 'zz' } })?.language, 'en');

// (10) PERSONEL KARTI — misafirin dili ne olursa olsun TR (personel bildirimi kurali)
const finalCard = buildLeadFinalCard({ name: 'Ahmet Yılmaz', phone: '0532 123 45 67', topic: TOPIC, room: '102' });
check('10a final kart ad-soyad', finalCard.includes('Ahmet Yılmaz'), true);
check('10b final kart telefon', finalCard.includes('0532 123 45 67'), true);
check('10c final kart konu', finalCard.includes(TOPIC), true);
check('10d final kart oda (dogrulanmis misafir)', finalCard.includes('Oda: 102'), true);
check('10e final kart SLA yok ibaresi', finalCard.includes('(SLA yok)'), true);
const ngFinal = buildLeadFinalCard({ name: 'Ali Veli', phone: '05320000000', topic: TOPIC, room: null });
check('10f oda bilinmiyorsa oda satiri YOK', ngFinal.includes('Oda:'), false);
check('10g oda yokken isim+telefon yine VAR', ngFinal.includes('Ali Veli') && ngFinal.includes('05320000000'), true);
check('10h HTML escape (enjeksiyon)',
  buildLeadFinalCard({ name: '<b>Ali', phone: '05320000000', topic: TOPIC, room: null }).includes('&lt;b&gt;Ali'), true);

// (11) COK DILLILIK — 5 dilin HEPSI ayri metin, dil state te tasinir
const langs = ['tr', 'en', 'de', 'ru', 'ar'] as const;
for (const l of langs) {
  const s = start({ language: l });
  check(`11a[${l}] acilis sorusu o dilde`, s.question, guestText('lead_ask_all', l));
  check(`11b[${l}] dil state e yazildi`, s.state.language, l);
  const nm = advanceLead(s.state, 'Hans Meier');
  check(`11c[${l}] telefon sorusu o dilde`, nm.action === 'ask_phone' ? nm.reply : null, guestText('lead_ask_phone', l));
  const ph = advanceLead(s.state, '+90 532 000 00 00');
  check(`11d[${l}] isim sorusu o dilde`, ph.action === 'ask_name' ? ph.reply : null, guestText('lead_ask_name', l));
}
check('11e 5 dil 5 ayri acilis sorusu', new Set(langs.map((l) => guestText('lead_ask_all', l))).size, 5);
check('11f 5 dil 5 ayri telefon sorusu', new Set(langs.map((l) => guestText('lead_ask_phone', l))).size, 5);
check('11g 5 dil 5 ayri isim sorusu', new Set(langs.map((l) => guestText('lead_ask_name', l))).size, 5);
check('11h 5 dil 5 ayri kapanis', new Set(langs.map((l) => guestText('lead_close', l))).size, 5);
check('11i 5 dil 5 ayri tesekkur', new Set(langs.map((l) => guestText('lead_thanks', l))).size, 5);
check('11j bilinmeyen dil -> en', start({ language: 'fr' }).question, guestText('lead_ask_all', 'en'));
check('11k dilsiz -> en', startLeadCapture({ topic: TOPIC, notifyChatId: 1 }).state.language, 'en');

// (12) DEVAM TURLARI ayni dilde (classify o turlarda CALISMAZ -> dil state ten gelir)
const deStart = start({ language: 'de' });
const deName = advanceLead(deStart.state, 'Hans Meier');
check('12a DE dil state icinde korunur', deName.action === 'ask_phone' ? deName.state.language : null, 'de');
check('12b DE kapanis metni DE', (advanceLead(deStart.state, 'kein Interesse') as { reply: string }).reply, guestText('lead_close', 'de'));
check('12c override verilirse o dil kullanilir',
  (advanceLead(deStart.state, 'nein', 'ru') as { reply: string }).reply, guestText('lead_close', 'ru'));
// Yabanci dilde isim/telefon ICERIK olarak dogru islenir (dil metni degistirir, karari DEGIL)
const ruName = advanceLead(start({ language: 'ru' }).state, 'Иван Иванов');
check('12d RU isim mesajin TAMAMI', ruName.action === 'ask_phone' ? ruName.state.name : null, 'Иван Иванов');
const ruDone = advanceLead(ruName.action === 'ask_phone' ? ruName.state : fresh.state, '+7 916 000 00 00');
check('12e RU telefon tamamlanir', ruDone.action, 'complete');
check('12f RU tesekkur RU', ruDone.action === 'complete' ? ruDone.reply : null, guestText('lead_thanks', 'ru'));
// AR: Arap-Hint rakamli numara da yakalanir (phone.ts normalize)
const arDone = advanceLead({ ...start({ language: 'ar' }).state, name: 'محمد علي' }, '٠٥٣٢١٢٣٤٥٦٧');
check('12g AR yerel rakamli numara tamamlanir', arDone.action, 'complete');
check('12h AR numara ASCII ye cevrildi', arDone.action === 'complete' ? arDone.phone : null, '05321234567');
check('12i AR tesekkur AR', arDone.action === 'complete' ? arDone.reply : null, guestText('lead_thanks', 'ar'));

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
