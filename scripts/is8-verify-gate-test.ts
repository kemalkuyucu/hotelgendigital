/**
 * IS 9 — verify-gate birim testi (beyin callAI atlama karari).
 * GERCEK shouldSkipBrainForVerification import edilir (kopya YOK — kopya yesil
 * doner, canli davranisla celisir; bu tuzak bir kez yasandi).
 *
 * NE test edilir: dogrulanmamis misafirde requiresVerification olan HER departmanda
 * beyin cagrisinin ATLANDIGI; dogrulanmis misafirde ve dogrulama gerektirmeyen
 * departmanlarda ATLANMADIGI (yanlis kesme = misafire giden metni bozar).
 * VERIFICATION_REQUIRED_INTENTS listesi SURUCUDUR: listeye yeni departman eklenirse
 * bu test onu otomatik kapsar (guard departman-agnostik olmali).
 *
 * NE test EDILEMEZ (canli UAT konusu): gercek callAI'nin atlandigi, misafire giden
 * metnin BYTE-AYNI kaldigi, [verify-gate] log satirinin Vercel'de gorundugu.
 * Bu dosya bayrak seviyesidir — ag/LLM cagrisi YOK, API anahtari gerekmez.
 */
import {
  shouldSkipBrainForVerification,
  VERIFICATION_REQUIRED_INTENTS,
} from '@/lib/ai/verification-intents';

interface Case {
  desc: string;
  dept: string | null;
  verified: boolean;
  expected: boolean; // true = beyin ATLANIR (skip)
}

const CASES: Case[] = [
  // ── Dogrulama GEREKTIREN her departman, misafir DOGRULANMAMIS -> ATLA ────────
  // Bu turda gate metni nasilsa eziyor; beyin cagrisi bosa gidiyordu (IS 9 hedefi).
  ...VERIFICATION_REQUIRED_INTENTS.map((d): Case => ({
    desc: `${d}: dogrulanmamis -> beyin ATLANIR`,
    dept: d,
    verified: false,
    expected: true,
  })),

  // ── Ayni departmanlar, misafir DOGRULANMIS -> CAGIR ─────────────────────────
  // Metin misafire ULASIYOR; kesmek cevabi bozar.
  ...VERIFICATION_REQUIRED_INTENTS.map((d): Case => ({
    desc: `${d}: dogrulanmis -> beyin CAGRILIR`,
    dept: d,
    verified: true,
    expected: false,
  })),

  // ── Dogrulama GEREKTIRMEYEN departmanlar: dogrulanmamis olsa bile KESILMEZ ───
  { desc: 'front_office: dogrulanmamis -> kesilmez', dept: 'front_office', verified: false, expected: false },
  { desc: 'guest_relation: dogrulanmamis -> kesilmez', dept: 'guest_relation', verified: false, expected: false },
  { desc: 'greeting: dogrulanmamis -> kesilmez', dept: 'greeting', verified: false, expected: false },
  { desc: 'knowledge_query: dogrulanmamis -> kesilmez', dept: 'knowledge_query', verified: false, expected: false },
  { desc: 'chitchat: dogrulanmamis -> kesilmez', dept: 'chitchat', verified: false, expected: false },
  // YASAMSAL: allergy dogrulama gerektirmez (bildirim akisina dogrudan gider).
  // Guard bunu KESERSE alerji beyni susar — listede olmadigi icin kesilmemeli.
  { desc: 'allergy: dogrulanmamis -> KESILMEZ (yasamsal)', dept: 'allergy', verified: false, expected: false },
  { desc: 'allergy: dogrulanmis -> kesilmez', dept: 'allergy', verified: true, expected: false },

  // ── Sinir degerler: departman cozulememis -> kesme YOK ──────────────────────
  { desc: 'null departman -> kesilmez', dept: null, verified: false, expected: false },
  { desc: 'bos string departman -> kesilmez', dept: '', verified: false, expected: false },
  { desc: 'bilinmeyen departman -> kesilmez', dept: 'unknown', verified: false, expected: false },
  // Buyuk harf yazim listede YOK -> requiresVerification false -> kesilmez
  // (guard sadece BIREBIR eslesen departmani keser; sessiz genisleme olmaz)
  { desc: 'HOUSEKEEPING (buyuk harf) -> kesilmez', dept: 'HOUSEKEEPING', verified: false, expected: false },
];

let pass = 0;
const fails: string[] = [];
for (const c of CASES) {
  const got = shouldSkipBrainForVerification(c.dept, c.verified);
  if (got === c.expected) pass++;
  else fails.push(`FAIL "${c.desc}" → ${got} (beklenen ${c.expected})`);
}

for (const f of fails) console.log(f);
console.log(`\n${pass}/${CASES.length} PASS`);
process.exit(fails.length === 0 ? 0 : 1);
