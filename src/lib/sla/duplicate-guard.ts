import { normalizeTr } from '@/lib/utils/normalize-tr';

/**
 * TEKRAR TALEP (DEDUP) BENZERLIK KARARI — SAF: IO/ag/LLM YOK, ZAMAN YOK.
 *
 * Kaynak: housekeeping-forward.ts'in inline dedup blogu (normalize + Jaccard).
 * Ayni karar iki akista (housekeeping + F&B siparis) yasadigi icin module cekildi;
 * iki kopya = biri degisince digerinin SESSIZCE kaymasi.
 *
 * BURADA OLMAYAN (bilincli — cagirana ait):
 *   - zaman penceresi ve "acik event" tanimi (sla_events sorgusu)
 *   - aday listesinin nereden geldigi
 *   - dup yakalaninca ne yapilacagi (bildirim / kart / misafir mesaji)
 * Boylece karar is8 korpusunda ag/DB olmadan kosulabilir.
 *
 * OLCUT: her iki metin normalizeTr'den gecer, harf/rakam disi karakterler bosluga
 * cevrilir, kelimelere bolunur ve `minTokenLength` altindaki tokenler ELENIR; iki
 * kume arasindaki Jaccard benzerligi (kesisim/birlesim) `threshold`'a ESIT ya da
 * BUYUKSE tekrar sayilir.
 *
 * `minTokenLength` NEDEN OPSIYONEL:
 *   3 (VARSAYILAN) = housekeeping'in bugunku davranisi. Tek haneli miktar rakamlari
 *     elendigi icin "2 yuz havlusu" ile "3 yuz havlusu" AYNI sayilir.
 *   1 = F&B siparis yolu. Orada MIKTAR gercek bir siparis farkidir: "2 kahve" ile
 *     "3 kahve"yi ayni sayip ikincisini iletmemek, misafirin eline yanlis adette
 *     urun gitmesi demektir.
 */

export type DuplicateGuardOpts = {
  /** Jaccard esigi; >= ise tekrar. Varsayilan 0.5 (housekeeping'in canli esigi). */
  threshold?: number;
  /** Bu uzunlugun altindaki tokenler elenir. Varsayilan 3 (housekeeping davranisi). */
  minTokenLength?: number;
};

const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_MIN_TOKEN_LENGTH = 3;

function tokenize(text: string, minTokenLength: number): string[] {
  return normalizeTr(String(text ?? ''))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= minTokenLength);
}

/**
 * `newText` adaylardan HERHANGI BIRIYLE esik ustu benzer mi?
 * Aday listesi bos / newText tokensiz / aday tokensiz -> false (tekrar DEGIL).
 * Bias: supheliyse TEKRAR DEGIL — kayip talep, fazladan karttan kotudur.
 */
export function isDuplicateRequest(
  newText: string,
  candidateTexts: string[],
  opts?: DuplicateGuardOpts,
): boolean {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const minTokenLength = opts?.minTokenLength ?? DEFAULT_MIN_TOKEN_LENGTH;

  const newSet = new Set(tokenize(newText, minTokenLength));
  if (newSet.size === 0) return false;

  return (candidateTexts ?? []).some((candidate) => {
    const oldSet = new Set(tokenize(candidate, minTokenLength));
    if (oldSet.size === 0) return false;
    let inter = 0;
    for (const t of newSet) if (oldSet.has(t)) inter++;
    const uni = new Set([...newSet, ...oldSet]).size;
    return uni > 0 && inter / uni >= threshold;
  });
}
