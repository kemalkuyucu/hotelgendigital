/**
 * IS 13 + IS 17 — etkinlik/iletisim ON BURO override (LEG a) + sahte-vaat guard (LEG b2)
 * (local, is8 korpusu).
 *
 * IS 17'DE AYNA KALKTI: karar mantigi artik `@/lib/ai/event-contact-gate` icinde SAF
 * yasiyor ve bu test GERCEK modulu import ediyor (kopya fonksiyon YASAK — kopya YESIL
 * donerken canli davranisla celisebilir; bir kez yasandi). Onceki surumde listeler ve
 * dallanma ifadesi burada aynalanmisti cunku classify-and-respond.ts callAI import
 * ediyor ve offline kosulamiyor.
 *
 * KARAR: sahte vaat (bot "ilettim" der ama forward yok). LEG(a) etkinlik TALEBI +
 * acik iletisim talebini front_office'e deterministik forward eder; LEG(b2) forward'siz
 * vaat cikarsa front_office forward'i tetikler. YALIN BILGI sorusu forward EDILMEZ.
 *
 * IS 17 EKI: forward karari artik CIFT kaynakli — LLM'in dil-BAGIMSIZ etiketi
 * (`event_contact_request` / `claims_forward`) BIRINCIL, TR keyword listesi BACKSTOP.
 * Ag/LLM cagrisi YOK: LLM alanlari test girdisi olarak ELDEN verilir.
 */
import {
  decideEventContactForward,
  shouldFireFalsePromiseGuard,
  hasEventKeyword,
  hasForwardPromiseTr,
  preferEventOverPrice,
} from '@/lib/ai/event-contact-gate';
import { shouldSkipForward } from '@/app/api/webhooks/telegram/[hotelSlug]/route';
import { startLeadCapture } from '@/lib/lead/lead-capture';
import { guestText } from '@/lib/i18n/guest-text';
import { normalizeTr } from '@/lib/utils/normalize-tr';
import { EVENT_CONTACT_NOTIFY, PROMISE_BACKSTOP_NOTIFY, messageTypeTraits } from '@/lib/ai/message-types';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

/** TR backstop yolu: LLM alani HIC gelmemis gibi (llm=null), operasyonel baglam YOK. */
function trBranch(msg: string): 'FORWARD' | 'NO_FORWARD' {
  return decideEventContactForward({
    guestMessage: msg,
    llmEventContactRequest: null,
    hasOperationalOrComplaintIntent: false,
  }).forward
    ? 'FORWARD'
    : 'NO_FORWARD';
}

// (1) Etkinlik TALEBI (keyword + talep sinyali) -> forward front_office
check('1a dugun organizasyonu yaptirmak', trBranch('dugun organizasyonu yaptirmak istiyorum'), 'FORWARD');
check('1b balo salonu icin teklif', trBranch('balo salonu icin teklif alabilir miyim'), 'FORWARD');
check('1c kina organizasyonu planlamak', trBranch('kina organizasyonu planliyoruz'), 'FORWARD');
check('1d grup rezervasyonu yaptirmak', trBranch('grup rezervasyonu yaptirmak istiyorum'), 'FORWARD');

// (2) Etkinlik BILGI sorusu (talep sinyali YOK) -> forward YOK (fact cevabi kalir)
check('2a dugun yapiyor musunuz', trBranch('dugun yapiyor musunuz'), 'NO_FORWARD');
check('2b dugun var mi', trBranch('dugun var mi'), 'NO_FORWARD');
check('2c balo salonu var mi', trBranch('balo salonunuz var mi'), 'NO_FORWARD');

// (3) Acik iletisim/geri-arama -> forward front_office (konu farketmez)
check('3a kimle gorusebilirim', trBranch('kimle gorusebilirim'), 'FORWARD');
check('3b beni arayin', trBranch('beni arayin lutfen'), 'FORWARD');
check('3c yetkiliyle gorusmek', trBranch('yetkiliyle gorusmek istiyorum'), 'FORWARD');
check('3d alakasiz bilgi -> forward yok', trBranch('havuz kacta aciliyor'), 'NO_FORWARD');

// (4) LEG(b2) guard: forward YOK + vaat VAR -> tetikler
check('4a forward yok + ilettim -> guard',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: null, replyText: 'Talebinizi ilgili ekibe ilettim, gorusulecek.' }), true);
check('4b forward yok + iletiyorum -> guard',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: null, replyText: 'Bu konuyu ilgili ekibimize iletiyorum.' }), true);
check('4c forward VAR + ilettim -> guard YOK',
  shouldFireFalsePromiseGuard({ anyForward: true, llmClaimsForward: null, replyText: 'Talebinizi ilettim.' }), false);
check('4d forward yok + vaat YOK -> guard YOK',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: null, replyText: 'Havuz saat 09:00da acilir.' }), false);

// (5) TESLIM SEKLI: event/contact forward'i BILDIRIM (SLA yok, buton yok, eskalasyon yok).
//     LEG(a) ve LEG(b2) ayni sabiti yazar -> tek kaynak burada dogrulanir.
check('5a bildirim tipi', EVENT_CONTACT_NOTIFY.messageType, 'BILDIRIM');
check('5b sla_events YAZILMAZ', EVENT_CONTACT_NOTIFY.createsSlaEvent, false);
check('5c onay/eskalasyon butonu YOK', EVENT_CONTACT_NOTIFY.withButtons, false);
check('5d bildirim sablonu anahtari', EVENT_CONTACT_NOTIFY.notifyKind, 'event_contact');
// Taksonomiyle uyum: bayraklar BILDIRIM trait'inden sapmamali
check('5e BILDIRIM trait uyumu (sla)', EVENT_CONTACT_NOTIFY.createsSlaEvent, messageTypeTraits('BILDIRIM').createsSlaEvent);
check('5f BILDIRIM trait uyumu (buton)', EVENT_CONTACT_NOTIFY.withButtons, messageTypeTraits('BILDIRIM').withButtons);
// Regresyon kapisi: operasyonel TALEP yolu SLA uretmeye DEVAM etmeli (dokunulmadi)
check('5g TALEP hala sla_events uretir', messageTypeTraits('TALEP').createsSlaEvent, true);
check('5h TALEP hala butonlu', messageTypeTraits('TALEP').withButtons, true);
check('5i housekeeping TALEP kaldi', messageTypeTraits('housekeeping').createsSlaEvent, true);

// (6) LEG(a) ile LEG(b2) AYRI notifyKind tasir: iletisim toplama (ad-soyad+telefon)
//     YALNIZ gercek etkinlik/iletisim talebinde calisir; jenerik sahte-vaat
//     backstop'unda CALISMAZ (sikayet mesajina "telefonunuzu verin" denmemeli).
check('6a event yolu anahtari', EVENT_CONTACT_NOTIFY.notifyKind, 'event_contact');
check('6b backstop yolu anahtari', PROMISE_BACKSTOP_NOTIFY.notifyKind, 'promise_backstop');
check('6c iki yol farkli', EVENT_CONTACT_NOTIFY.notifyKind === PROMISE_BACKSTOP_NOTIFY.notifyKind, false);
check('6d backstop da SLA uretmez', PROMISE_BACKSTOP_NOTIFY.createsSlaEvent, false);
check('6e backstop da butonsuz', PROMISE_BACKSTOP_NOTIFY.withButtons, false);
check('6f backstop da BILDIRIM', PROMISE_BACKSTOP_NOTIFY.messageType, 'BILDIRIM');

// ── IS 17 ─────────────────────────────────────────────────────────────────────

// (7) LLM ETIKETI BIRINCIL — TR keyword HIC gecmeyen yabanci dil mesaji forward EDILIR.
//     Bu, IS 17'nin cozdugu asil kirilma: "I'd like to organize a wedding" TR listeye
//     takilmadigi icin forward EDILMIYORDU (sessiz yutma).
const enWedding = "I'd like to organize a wedding at your hotel, who can I speak to?";
const deWedding = 'Ich moechte bei Ihnen eine Hochzeit organisieren';
check('7a EN dugun talebi TR backstop ile YAKALANMAZ (kirilmanin kaniti)', trBranch(enWedding), 'NO_FORWARD');
check('7b EN dugun talebi LLM etiketiyle FORWARD',
  decideEventContactForward({ guestMessage: enWedding, llmEventContactRequest: true, hasOperationalOrComplaintIntent: false }).forward, true);
check('7c DE dugun talebi LLM etiketiyle FORWARD',
  decideEventContactForward({ guestMessage: deWedding, llmEventContactRequest: true, hasOperationalOrComplaintIntent: false }).forward, true);
check('7d karar kaynagi llm olarak isaretlenir',
  decideEventContactForward({ guestMessage: enWedding, llmEventContactRequest: true, hasOperationalOrComplaintIntent: false }).source, 'llm');
check('7e TR yolunda kaynak tr-keyword',
  decideEventContactForward({ guestMessage: 'dugun organizasyonu yaptirmak istiyorum', llmEventContactRequest: null, hasOperationalOrComplaintIntent: false }).source, 'tr-keyword');
check('7f duz bilgi sorusu (LLM false) -> forward YOK',
  decideEventContactForward({ guestMessage: 'do you host weddings?', llmEventContactRequest: false, hasOperationalOrComplaintIntent: false }).forward, false);
check('7g DE duz bilgi sorusu (LLM false) -> forward YOK',
  decideEventContactForward({ guestMessage: 'Haben Sie einen Tagungsraum?', llmEventContactRequest: false, hasOperationalOrComplaintIntent: false }).forward, false);
check('7h LLM false ama TR backstop dolu -> yine FORWARD (backstop korunur)',
  decideEventContactForward({ guestMessage: 'dugun organizasyonu yaptirmak istiyorum', llmEventContactRequest: false, hasOperationalOrComplaintIntent: false }).forward, true);

// (8) OPERASYONEL / SIKAYET baglaminda "tek basina iletisim sinyali" backstop'u KAPANIR
//     -> lead akisi (telefon isteme) baslamaz; talep kendi departman akisinda kalir.
const acBroken = 'klimam bozuk, yetkiliyle gorusmek istiyorum';
check('8a operasyonel baglam YOKken contact sinyali forward eder', trBranch(acBroken), 'FORWARD');
check('8b operasyonel baglamda contact backstop KAPALI',
  decideEventContactForward({ guestMessage: acBroken, llmEventContactRequest: null, hasOperationalOrComplaintIntent: true }).forward, false);
check('8c sikayet baglaminda beni arayin -> lead baslamaz',
  decideEventContactForward({ guestMessage: 'odam cok kirli, beni arayin', llmEventContactRequest: null, hasOperationalOrComplaintIntent: true }).forward, false);
// Etkinlik keyword + talep sinyali kombinasyonu operasyonel baglamdan ETKILENMEZ
check('8d operasyonel baglamda bile gercek etkinlik talebi FORWARD',
  decideEventContactForward({ guestMessage: 'dugun organizasyonu icin teklif alabilir miyim', llmEventContactRequest: null, hasOperationalOrComplaintIntent: true }).forward, true);

// (9) KELIME-SINIRI: gunluk kelimeler etkinlik keyword'u SANILMAMALI
check('9a toplant EKLENDI (kw)', hasEventKeyword(normalizeTr('toplantı salonu')), true);
check('9b toplanti + rezerv -> FORWARD', trBranch('toplanti salonu rezerve etmek istiyorum'), 'FORWARD');
check('9c toplanti salonu var mi -> NO_FORWARD (bilgi)', trBranch('toplanti salonunuz var mi'), 'NO_FORWARD');
check('9d makina "kina" SAYILMAZ', hasEventKeyword(normalizeTr('makina arizali')), false);
check('9e balon "balo" SAYILMAZ', hasEventKeyword(normalizeTr('odaya balon suslemesi')), false);
check('9f davetsiz "davet" SAYILMAZ', hasEventKeyword(normalizeTr('davetsiz misafir geldi')), false);
check('9g kina hala yakalanir', hasEventKeyword(normalizeTr('kına gecesi')), true);
check('9h balo hala yakalanir', hasEventKeyword(normalizeTr('balo salonu')), true);
check('9i davet hala yakalanir', hasEventKeyword(normalizeTr('davetimiz var')), true);
// Regresyon: yanlis-pozitif kelimeler talep sinyaliyle birleşse bile forward ETMEMELI
check('9j makina + rezerv -> NO_FORWARD', trBranch('makina icin rezervasyon'), 'NO_FORWARD');
check('9k balon + teklif -> NO_FORWARD', trBranch('balon icin teklif'), 'NO_FORWARD');

// (10) LEG(b2) DIL-BAGIMSIZ: claims_forward=true + forward YOK -> backstop ateslenir
const enPromise = "I've notified our team, someone will get back to you shortly.";
check('10a EN vaat TR taramasiyla GORULMEZ (kirilmanin kaniti)', hasForwardPromiseTr(enPromise), false);
check('10b EN vaat + forward yok -> LLM etiketiyle guard',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: true, replyText: enPromise }), true);
check('10c claims_forward=true ama forward VAR -> guard YOK',
  shouldFireFalsePromiseGuard({ anyForward: true, llmClaimsForward: true, replyText: enPromise }), false);
check('10d claims_forward=false ama TR vaat kacmis -> ikincil backstop yakalar',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: false, replyText: 'Talebinizi ilettim.' }), true);
check('10e claims_forward=false + vaat yok -> guard YOK',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: false, replyText: 'Pool opens at 09:00.' }), false);
check('10f DE vaat + LLM etiketi -> guard',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: true, replyText: 'Ich habe es an unser Team weitergeleitet.' }), true);
check('10g bos cevap + etiket yok -> guard YOK',
  shouldFireFalsePromiseGuard({ anyForward: false, llmClaimsForward: null, replyText: '   ' }), false);

// ── (11) FIYAT KAPISI NEGATIF GUARD (preferEventOverPrice) ────────────────────
// CANLI KIRILMA (2026-07-28): "dugun organizasyonu icin fiyat almak istiyoruz" ->
// detectPriceIntent EVET -> route.ts fiyat kapisi `return` -> classify HIC calismadi
// -> event lead ACILMADI, misafire oda fiyati icin tarih/kisi soruldu.
// Guard mesaji fiyat kapisindan gecirir; forward karari DEGISMEDI (asagida kanit).
check('11a etkinlik + fiyat sinyali -> guard ACIK',
  preferEventOverPrice('düğün organizasyonu için fiyat almak istiyoruz'), true);
check('11b etkinlik + iletisim sinyali -> guard ACIK',
  preferEventOverPrice('düğün organizasyonu için kimle görüşebilirim'), true);
check('11c duz oda fiyati -> guard KAPALI',
  preferEventOverPrice('2 kişi 3 gece oda fiyatı'), false);
check('11d etkinlik BILGI sorusu (sinyal yok) -> guard KAPALI',
  preferEventOverPrice('düğün yapıyor musunuz'), false);
check('11e salon kapasite sorusu -> guard KAPALI',
  preferEventOverPrice('balo salonu kaç kişilik'), false);

// Regresyon: DUZ ODA REZERVASYONU fiyat kapisinda KALMALI (etkinlik keyword'u yok).
check('11f rezervasyon yaptirmak -> guard KAPALI', preferEventOverPrice('rezervasyon yaptırmak istiyorum'), false);
check('11g musait oda var mi -> guard KAPALI', preferEventOverPrice('müsait oda var mı'), false);
check('11h temmuzda fiyat -> guard KAPALI', preferEventOverPrice('temmuzda oda fiyatı nedir'), false);
check('11i aile odasi ne kadar -> guard KAPALI', preferEventOverPrice('aile odası ne kadar'), false);
// Spa yolu KENDI guard'inda kalir (iki guard birbirinin isini yapmaz)
check('11j spa randevusu -> event guard KAPALI', preferEventOverPrice('spa randevusu almak istiyorum'), false);
// Toplanti salonu REZERVASYONU oda rezervasyonu DEGILDIR -> event yoluna gider
check('11k toplanti salonu rezerve -> guard ACIK', preferEventOverPrice('toplantı salonu rezerve etmek istiyorum'), true);

// (12) UCTAN UCA: guard atlatinca lead GERCEKTEN aciliyor mu?
//      Zincir: fiyat kapisi ATLANIR -> event kapisi FORWARD -> lead ilk soruyu sorar.
const canliVaka = 'düğün organizasyonu için fiyat almak istiyoruz';
check('12a halka-1 fiyat kapisi atlanir', preferEventOverPrice(canliVaka), true);
check('12b halka-2 event kapisi FORWARD', trBranch(canliVaka), 'FORWARD');
const leadOpen = startLeadCapture({ topic: canliVaka, notifyChatId: 1, language: 'tr' });
check('12c halka-3 lead acilir (isim+soyisim+telefon TEK soru)',
  leadOpen.question, guestText('lead_ask_all', 'tr'));
check('12d lead state konuyu tasir', leadOpen.state.topic, canliVaka);
check('12e non-guest lead odasiz acilir', leadOpen.state.room, null);

// ── (13) AYNI GUARD RE-VERIFY KAPISINDA DA KULLANILIR (route.ts:3146) ─────────
// CANLI KIRILMA (2026-07-28 02:07): event guard fiyat kapisini atlattiktan SONRA mesaj
// re-verify kapisina dustu — ROOM_REGEX (verify-guest.ts:79) prefix'siz oldugu icin
// "40 kisilik" ifadesindeki "40" ODA NO sanildi, isPureIdentityClaim true dondu, bot
// "in-house listesinde eslesme bulamadim" deyip RETURN etti -> event lead ACILMADI.
// KRITIK REGRESYON: GERCEK salt-kimlik mesaji guard'a TAKILMAMALI, yoksa oda degistiren
// misafirin re-verify'i sessizce olur.
check('13a salt kimlik -> guard KAPALI (re-verify korunur)',
  preferEventOverPrice('312 Kemal Kuyucu'), false);
check('13b oda onekli salt kimlik -> guard KAPALI',
  preferEventOverPrice('oda 312 kemal kuyucu'), false);
check('13c canli kirilma cumlesi -> guard ACIK (re-verify atlanir)',
  preferEventOverPrice('40 kişilik düğün organizasyonu için fiyat almak istiyoruz'), true);

// ── (14) FORWARD SUPPRESSOR (route.ts shouldSkipForward — GERCEK fonksiyon) ───
// KAPI: route.ts'te `if (skipForward)` forward blogunu KOMPLE atlar ve lead acilisi
// (startLeadCapture) o blogun ICINDEDIR. Etkinlik mesajinda LLM "KB'den cevapladim"
// derse (answered_from_knowledge=true) lead HIC acilmazdi: misafir salon bilgisini
// alir, personele hicbir sey gitmez (SESSIZ YUTMA). Istisna YALNIZ etkinlik mesajinda.
const EV_MSG = '40 kişilik düğün organizasyonu için fiyat almak istiyoruz';
check('14a etkinlik + KB cevabi -> forward BASTIRILMAZ',
  shouldSkipForward({ aiShouldForward: true, answeredFromKnowledge: true, guestMessage: EV_MSG }), false);
check('14b duz etkinlik BILGI sorusu + KB cevabi -> bastirilir (eski davranis)',
  shouldSkipForward({ aiShouldForward: true, answeredFromKnowledge: true, guestMessage: 'düğün yapıyor musunuz' }), true);
check('14c oda fiyati + KB cevabi -> bastirilir (eski davranis)',
  shouldSkipForward({ aiShouldForward: true, answeredFromKnowledge: true, guestMessage: 'temmuzda oda fiyatı nedir' }), true);
check('14d operasyonel talep + KB cevabi -> bastirilir (eski davranis)',
  shouldSkipForward({ aiShouldForward: true, answeredFromKnowledge: true, guestMessage: 'klima çalışmıyor' }), true);
check('14e siniflandirici forward etmiyorsa etkinlik bile ZORLAMAZ',
  shouldSkipForward({ aiShouldForward: false, answeredFromKnowledge: false, guestMessage: EV_MSG }), true);
check('14f KB cevabi yok + forward var -> bastirma YOK',
  shouldSkipForward({ aiShouldForward: true, answeredFromKnowledge: false, guestMessage: 'havlu istiyorum' }), false);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
