/**
 * IS 13 — etkinlik/iletisim ON BURO override (LEG a) + sahte-vaat guard (LEG b2) testi
 * (local, is8 korpusu).
 *
 * classify-and-respond.ts forceEventForward + sahte-vaat-guard KARARLARININ bayrak-seviyesi
 * aynasi. is8-info-gate-test.ts bagBranch deseni gibi: karar GIRDISI gercek modulden
 * (normalizeTr), dallanma ifadesi (tek satir) burada aynalanir (LLM-sonrasi kod offline
 * calistirilamaz -> classify-and-respond callAI import eder). Ag/LLM cagrisi YOK.
 *
 * KARAR: sahte vaat (bot "ilettim" der ama forward yok). LEG(a) dugun/organizasyon/etkinlik
 * TALEBI + acik iletisim talebini front_office'e deterministik forward eder; LEG(b2) forward'siz
 * "ilettim" cikarsa front_office forward'i tetikler. YALIN BILGI sorusu forward EDILMEZ.
 *
 * TESLIM SEKLI (5. blok): bu iki yol SLA TALEP karti DEGIL, BILDIRIM uretir. Bayraklar
 * AYNALANMAZ — EVENT_CONTACT_NOTIFY gercek modulden (message-types.ts) import edilir,
 * iki uretim yolu (classify-and-respond LEG a + LEG b2) da bu tek sabiti kullanir.
 */
import { normalizeTr } from '@/lib/utils/normalize-tr';
import { EVENT_CONTACT_NOTIFY, messageTypeTraits } from '@/lib/ai/message-types';

// classify-and-respond.ts LEG(a)/LEG(b2) ile BIREBIR ayna (orada local const, export DEGIL):
const EVENT_KEYWORDS = ['dugun', 'nikah', 'kina', 'organizasyon', 'etkinlik', 'kongre', 'seminer', 'davet', 'balo', 'grup rezervasyon'];
const EVENT_REQUEST_SIGNALS = ['organize', 'yaptirmak', 'planl', 'teklif', 'fiyat al', 'rezerv', 'kimle gorus', 'beni ara', 'iletisim', 'gorusme', 'yetkili'];
const CONTACT_SIGNALS = ['kimle gorus', 'beni ara', 'iletisime gec', 'baglayabilir', 'yetkiliyle gorus'];
const PROMISE_SIGNALS = ['ilettim', 'ilgili ekib', 'aktardim', 'iletiyorum', 'gorusulecek', 'talebinizi aldim'];

// LEG(a) forceEventForward dallanmasi:
function eventBranch(msg: string): 'FORWARD' | 'NO_FORWARD' {
  const n = normalizeTr(msg);
  const hasEventKw = EVENT_KEYWORDS.some((k) => n.includes(k));
  const hasEventReq = EVENT_REQUEST_SIGNALS.some((k) => n.includes(k));
  const hasContactReq = CONTACT_SIGNALS.some((k) => n.includes(k));
  return (hasEventKw && hasEventReq) || hasContactReq ? 'FORWARD' : 'NO_FORWARD';
}

// LEG(b2) sahte-vaat-guard dallanmasi:
function guardFires(reply: string, anyForward: boolean): boolean {
  const norm = normalizeTr(reply);
  const hasPromise = reply.trim().length > 0 && PROMISE_SIGNALS.some((p) => norm.includes(p));
  return !anyForward && hasPromise;
}

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// (1) Etkinlik TALEBI (keyword + talep sinyali) -> forward front_office
check('1a dugun organizasyonu yaptirmak', eventBranch('dugun organizasyonu yaptirmak istiyorum'), 'FORWARD');
check('1b balo salonu icin teklif', eventBranch('balo salonu icin teklif alabilir miyim'), 'FORWARD');
check('1c kina organizasyonu planlamak', eventBranch('kina organizasyonu planliyoruz'), 'FORWARD');
check('1d grup rezervasyonu yaptirmak', eventBranch('grup rezervasyonu yaptirmak istiyorum'), 'FORWARD');

// (2) Etkinlik BILGI sorusu (talep sinyali YOK) -> forward YOK (fact cevabi kalir)
check('2a dugun yapiyor musunuz', eventBranch('dugun yapiyor musunuz'), 'NO_FORWARD');
check('2b dugun var mi', eventBranch('dugun var mi'), 'NO_FORWARD');
check('2c balo salonu var mi', eventBranch('balo salonunuz var mi'), 'NO_FORWARD');

// (3) Acik iletisim/geri-arama -> forward front_office (konu farketmez)
check('3a kimle gorusebilirim', eventBranch('kimle gorusebilirim'), 'FORWARD');
check('3b beni arayin', eventBranch('beni arayin lutfen'), 'FORWARD');
check('3c yetkiliyle gorusmek', eventBranch('yetkiliyle gorusmek istiyorum'), 'FORWARD');
check('3d alakasiz bilgi -> forward yok', eventBranch('havuz kacta aciliyor'), 'NO_FORWARD');

// (4) shouldForward=false + reply forward-vaadi -> guard tetikler; aksi -> tetiklemez
check('4a forward yok + ilettim -> guard', guardFires('Talebinizi ilgili ekibe ilettim, gorusulecek.', false), true);
check('4b forward yok + iletiyorum -> guard', guardFires('Bu konuyu ilgili ekibimize iletiyorum.', false), true);
check('4c forward VAR + ilettim -> guard YOK', guardFires('Talebinizi ilettim.', true), false);
check('4d forward yok + vaat YOK -> guard YOK', guardFires('Havuz saat 09:00da acilir.', false), false);

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

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
