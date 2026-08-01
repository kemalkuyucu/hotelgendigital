/**
 * BACKLOG #3 — webhook-girisi update_id kimlik cikarimi testi (local, is8 korpusu).
 *
 * GERCEK modul import edilir (src/lib/telegram/update-dedup.ts) — kopya fonksiyon
 * YASAK: kopya yesil donerken canli davranisla celisebilir (bu tuzak bir kez
 * yasandi). Ag/LLM/DB cagrisi YOK.
 *
 * KAPSANAN KARAR: `extractUpdateId` — govdeden update_id'nin cikarilmasi ve NEYIN
 * gecerli kimlik SAYILMADIGI. null = "kimlik okunamadi" -> cagiran dedup'i ATLAR
 * (fail-safe: mesaji islemek, sessizce yutmaktan iyidir).
 *
 * BURADA DOGRULANAMAZ (canli UAT / DB): `claimTelegramUpdate` IO tasir — PRIMARY KEY
 * catismasinin gercekten tek satir dondurdugu, DB hatasinda fail-safe `true`
 * donuldugu ve route.ts'in duplicate dalinda 200 + yan-etkisiz dondugu.
 */
import { extractUpdateId } from '@/lib/telegram/update-dedup';

let pass = 0;
const fails: string[] = [];
function check(name: string, got: unknown, exp: unknown): void {
  if (got === exp) pass++;
  else fails.push(`${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
}

// §u1 — normal Telegram govdesi (sayi)
check('u1 {update_id:123} -> 123', extractUpdateId({ update_id: 123 }), 123);
check('u1b buyuk deger (int32 ustu) korunur',
  extractUpdateId({ update_id: 9007199254740991 }), 9007199254740991);
check('u1c diger alanlar kimligi etkilemez',
  extractUpdateId({ update_id: 77, message: { text: 'merhaba' } }), 77);

// §u2 — alan YOK
check('u2 alan yok -> null', extractUpdateId({}), null);
check('u2b baska alanlar var ama update_id yok -> null',
  extractUpdateId({ message: { text: 'x' } }), null);

// §u3 — yalniz-rakam string (araya giren proxy sayiyi string'e cevirebilir)
check('u3 "456" -> 456', extractUpdateId({ update_id: '456' }), 456);
check('u3b "0" -> 0', extractUpdateId({ update_id: '0' }), 0);

// §u4 — harf iceren string
check('u4 "12a" -> null', extractUpdateId({ update_id: '12a' }), null);
check('u4b bos string -> null', extractUpdateId({ update_id: '' }), null);
check('u4c bosluklu string -> null', extractUpdateId({ update_id: ' 12 ' }), null);
check('u4d ondalik string -> null', extractUpdateId({ update_id: '1.5' }), null);
check('u4e negatif string -> null', extractUpdateId({ update_id: '-1' }), null);

// §u5 — null / undefined deger
check('u5 null -> null', extractUpdateId({ update_id: null }), null);
check('u5b undefined -> null', extractUpdateId({ update_id: undefined }), null);

// §u6 — ondalik sayi
check('u6 3.5 -> null', extractUpdateId({ update_id: 3.5 }), null);
check('u6b NaN -> null', extractUpdateId({ update_id: NaN }), null);
check('u6c Infinity -> null', extractUpdateId({ update_id: Infinity }), null);

// §u7 — negatif
check('u7 -1 -> null', extractUpdateId({ update_id: -1 }), null);

// §u8 — SIFIR gecerli kimliktir (falsy tuzagi: `if (!id)` yazilsaydi 0 elenirdi)
check('u8 0 -> 0', extractUpdateId({ update_id: 0 }), 0);

// §u9 — govde nesne DEGIL
check('u9 number govde -> null', extractUpdateId(123), null);
check('u9b string govde -> null', extractUpdateId('update_id=1'), null);
check('u9c array govde -> null', extractUpdateId([{ update_id: 1 }]), null);
check('u9d null govde -> null', extractUpdateId(null), null);
check('u9e undefined govde -> null', extractUpdateId(undefined), null);
check('u9f boolean govde -> null', extractUpdateId(true), null);

// §u10 — nesne/dizi DEGER (bozuk govde) kimlik sayilmaz
check('u10 nesne deger -> null', extractUpdateId({ update_id: { n: 1 } }), null);
check('u10b dizi deger -> null', extractUpdateId({ update_id: [1] }), null);
check('u10c boolean deger -> null', extractUpdateId({ update_id: true }), null);

const total = pass + fails.length;
if (fails.length > 0) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error('  x ' + f);
  console.log(`\n${pass}/${total} PASS`);
  process.exit(1);
}
console.log(`${pass}/${total} PASS`);
