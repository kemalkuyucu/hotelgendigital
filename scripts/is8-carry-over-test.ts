/**
 * C2 — telegram_id tasima plani birim testi (local, gitignored).
 * GERCEK planTelegramCarryOver import edilir (kopya YOK).
 *
 * GIZLILIK KRITIK: bir damganin YANLIS misafire gecmesi, o misafirin baskasinin
 * odasini/taleplerini gormesi demektir. Asagidaki "TASINMAMALI" vakalarinin
 * HEPSI bos plan uretmek ZORUNDA.
 */
import { planTelegramCarryOver, type ArchivedStampRow, type InsertedGuestRow } from '@/lib/verification/inhouse-link';

interface Case {
  name: string;
  archived: ArchivedStampRow[];
  inserted: InsertedGuestRow[];
  expect: { fromId: string; toId: string; telegramId: string }[];
}

const CASES: Case[] = [
  {
    // CANLI VAKA: 312 / "Kemal Kuyucu" (arsiv) -> "KEMAL KUYUCU" (yeni, buyuk harf)
    name: 'AYNI isim + ayni oda -> TASINIR (canli 312 vakasi, buyuk/kucuk harf farki)',
    archived: [{ id: 'old-312', room_number: '312', guest_name: 'Kemal Kuyucu', telegram_id: '758605940' }],
    inserted: [{ id: 'new-312', room_number: '312', guest_name: 'KEMAL KUYUCU' }],
    expect: [{ fromId: 'old-312', toId: 'new-312', telegramId: '758605940' }],
  },
  {
    name: 'TR diyakritik farki (SEHMUS/ŞEHMUŞ) -> TASINIR (normalizeTr)',
    archived: [{ id: 'o1', room_number: '210', guest_name: 'ŞEHMUŞ ÖZTÜRK', telegram_id: '111' }],
    inserted: [{ id: 'n1', room_number: '210', guest_name: 'sehmus ozturk' }],
    expect: [{ fromId: 'o1', toId: 'n1', telegramId: '111' }],
  },
  {
    name: 'fazla bosluk -> TASINIR (bosluk sadelestirmesi)',
    archived: [{ id: 'o1', room_number: '210', guest_name: 'AYSE  YILMAZ', telegram_id: '111' }],
    inserted: [{ id: 'n1', room_number: '210', guest_name: 'AYSE YILMAZ' }],
    expect: [{ fromId: 'o1', toId: 'n1', telegramId: '111' }],
  },
  {
    // ★ EN KRITIK VAKA — yeni misafir eski misafirin Telegram linkini ALMAMALI
    name: 'FARKLI isim ayni oda -> TASINMAZ (yeni misafir link ALMAZ)',
    archived: [{ id: 'old-312', room_number: '312', guest_name: 'Kemal Kuyucu', telegram_id: '758605940' }],
    inserted: [{ id: 'new-312', room_number: '312', guest_name: 'AYSE YILMAZ' }],
    expect: [],
  },
  {
    name: 'ayni isim FARKLI oda -> TASINMAZ',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' }],
    inserted: [{ id: 'n1', room_number: '415', guest_name: 'KEMAL KUYUCU' }],
    expect: [],
  },
  {
    name: 'benzer ama farkli soyad -> TASINMAZ',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' }],
    inserted: [{ id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCUOGLU' }],
    expect: [],
  },
  {
    name: 'damgasiz arsiv -> no-op',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: null }],
    inserted: [{ id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCU' }],
    expect: [],
  },
  {
    name: 'bos string damga -> no-op',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '   ' }],
    inserted: [{ id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCU' }],
    expect: [],
  },
  {
    name: 'yeni satir YOK (misafir cikti) -> TASINMAZ, damga arsivde oksuz kalir',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' }],
    inserted: [{ id: 'n1', room_number: '415', guest_name: 'HASAN YILDIZ' }],
    expect: [],
  },
  {
    name: 'BELIRSIZ: ayni oda+isimde IKI yeni satir -> TASINMAZ',
    archived: [{ id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' }],
    inserted: [
      { id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCU' },
      { id: 'n2', room_number: '312', guest_name: 'KEMAL KUYUCU' },
    ],
    expect: [],
  },
  {
    name: 'CAKISMA: iki farkli hesap ayni yeni satiri talep -> HICBIRI tasinmaz',
    archived: [
      { id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '111' },
      { id: 'o2', room_number: '312', guest_name: 'kemal kuyucu', telegram_id: '222' },
    ],
    inserted: [{ id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCU' }],
    expect: [],
  },
  {
    name: 'TEK-DAMGA: ayni telegram_id iki hedefe -> HICBIRI tasinmaz',
    archived: [
      { id: 'o1', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' },
      { id: 'o2', room_number: '415', guest_name: 'KEMAL KUYUCU', telegram_id: '758605940' },
    ],
    inserted: [
      { id: 'n1', room_number: '312', guest_name: 'KEMAL KUYUCU' },
      { id: 'n2', room_number: '415', guest_name: 'KEMAL KUYUCU' },
    ],
    expect: [],
  },
  {
    // COKLU ODA — capraz sizinti OLMAMALI
    name: 'COKLU oda karisimi -> her biri KENDI eslesmesi, capraz sizinti YOK',
    archived: [
      { id: 'o312', room_number: '312', guest_name: 'KEMAL KUYUCU', telegram_id: '111' },
      { id: 'o415', room_number: '415', guest_name: 'HASAN YILDIZ', telegram_id: '222' },
      { id: 'o210', room_number: '210', guest_name: 'FATMA SAHIN', telegram_id: '333' },
    ],
    inserted: [
      { id: 'n415', room_number: '415', guest_name: 'HASAN YILDIZ' },
      { id: 'n312', room_number: '312', guest_name: 'KEMAL KUYUCU' },
      { id: 'n210', room_number: '210', guest_name: 'ZEYNEP CELIK' }, // 210'a YENI misafir
    ],
    expect: [
      { fromId: 'o312', toId: 'n312', telegramId: '111' },
      { fromId: 'o415', toId: 'n415', telegramId: '222' },
      // 210: isim farkli -> TASIMA YOK (333 hicbir yere gitmez)
    ],
  },
  {
    name: 'bos girdiler -> bos plan',
    archived: [],
    inserted: [],
    expect: [],
  },
];

let pass = 0;
const fails: string[] = [];

for (const c of CASES) {
  const plan = planTelegramCarryOver(c.archived, c.inserted);
  const got = plan
    .map((p) => `${p.fromId}->${p.toId}:${p.telegramId}`)
    .sort()
    .join(' | ');
  const want = c.expect
    .map((p) => `${p.fromId}->${p.toId}:${p.telegramId}`)
    .sort()
    .join(' | ');
  if (got === want) pass++;
  else fails.push(`FAIL "${c.name}"\n     beklenen: [${want}]\n     gelen   : [${got}]`);
}

// EK INVARYANT: hicbir planda bir hedef satir >1 damga ALMAMALI, bir damga >1 hedefe GITMEMELI.
for (const c of CASES) {
  const plan = planTelegramCarryOver(c.archived, c.inserted);
  const targets = new Set<string>();
  const stamps = new Set<string>();
  for (const p of plan) {
    if (targets.has(p.toId)) fails.push(`INVARYANT IHLALI "${c.name}": hedef ${p.toId} birden fazla damga aldi`);
    if (stamps.has(p.telegramId)) fails.push(`INVARYANT IHLALI "${c.name}": damga ${p.telegramId} birden fazla hedefe gitti`);
    targets.add(p.toId);
    stamps.add(p.telegramId);
  }
}

for (const f of fails) console.log(f);
console.log(`\n${pass}/${CASES.length} PASS${fails.length ? ` (+${fails.length} sorun)` : ''}`);
process.exit(fails.length === 0 ? 0 : 1);
