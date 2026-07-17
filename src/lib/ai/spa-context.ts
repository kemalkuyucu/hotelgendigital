import { normalizeTr } from '@/lib/utils/normalize-tr';

// Spa baglam tespiti — DETERMINISTIK (LLM DEGIL). Fiyat kapisi (route.ts) icin
// negatif guard: "spa rezervasyonu/randevusu" gibi mesajlar oda-fiyat kapisina
// dusmesin, spa beynine gitsin. Yonlendirme karari kodda kalir (KALICI KURAL #3).
export const SPA_CONTEXT_KEYWORDS = ['spa', 'masaj', 'hamam', 'sauna', 'wellness', 'buhar odasi', 'cilt bakimi'];

export function isSpaContext(text: string): boolean {
  const n = normalizeTr(text);
  return SPA_CONTEXT_KEYWORDS.some((k) => n.includes(k));
}
