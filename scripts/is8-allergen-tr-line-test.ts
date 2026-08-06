/**
 * IS 8 — ALERJEN TURKCE SATIRI karari (needsTurkishLine) korpusu. Backlog #4.
 * GERCEK modul import edilir (kopya fonksiyon YASAK); ag/LLM cagrisi YOK.
 *
 * Bu karar IKI kartta birden kullanilir (mutfak/GR HTML karti + on buro
 * max-deneme plain-text karti). Yanlis TRUE = gereksiz gurultu satiri;
 * yanlis FALSE = RU/AR alerji metni personele CEVRILMEDEN gider (yasamsal
 * guvenlik metni okunamaz).
 */
import { needsTurkishLine } from '@/lib/telegram/allergen-notify';

let pass = 0;
const fails: string[] = [];
function check(desc: string, got: boolean, expected: boolean) {
  if (got === expected) pass++;
  else fails.push(`FAIL "${desc}" -> ${got} (beklenen ${expected})`);
}

// ── §1 — SATIR EKLENIR (ceviri gercekten farkli) ────────────────────────────
check('1a RU alerji cevrildi', needsTurkishLine('аллергия на орехи', 'findik alerjisi'), true);
check('1b AR alerji cevrildi', needsTurkishLine('حساسية من الفول السوداني', 'yer fistigi alerjisi'), true);
check('1c DE alerji cevrildi', needsTurkishLine('Nussallergie', 'findik alerjisi'), true);
check('1d yalniz buyuk/kucuk harf farki bile FARKLIDIR', needsTurkishLine('Sut', 'sut'), true);

// ── §2 — SATIR EKLENMEZ ─────────────────────────────────────────────────────
check('2a metin zaten Turkce (ayni doner)', needsTurkishLine('findik alerjisi', 'findik alerjisi'), false);
check('2b ceviri bos dondu', needsTurkishLine('аллергия', ''), false);
check('2c ceviri yalniz bosluk', needsTurkishLine('аллергия', '   '), false);
check('2d TRIM farki tek basina satir ACMAZ', needsTurkishLine('sut alerjisi', '  sut alerjisi  '), false);
check('2e orijinal bosluklu, ceviri ayni', needsTurkishLine('  sut alerjisi  ', 'sut alerjisi'), false);
check('2f ikisi de bos', needsTurkishLine('', ''), false);
check('2g orijinal bos, ceviri dolu -> satir EKLENIR', needsTurkishLine('', 'sut'), true);

// ── §3 — RAW-FALLBACK GARANTISI ─────────────────────────────────────────────
// translateToTurkish hata halinde ORIJINALI geri verir. O durumda ikinci satir
// basilmamali (ayni metni iki kez gostermek personeli yanıltir).
check('3a ceviri hata -> orijinali dondu -> satir YOK', needsTurkishLine('حساسية', 'حساسية'), false);
check('3b uzun metin ayni -> satir YOK', needsTurkishLine('a'.repeat(300), 'a'.repeat(300)), false);
check('3c uzun metin farkli -> satir VAR', needsTurkishLine('a'.repeat(300), 'b'.repeat(300)), true);

for (const f of fails) console.log(f);
console.log(`\n${pass}/${pass + fails.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
