/**
 * Misafirin diline ve cinsiyetine göre hitap döner.
 * gender NULL ise boş string döner — çağıran taraf hitap atmadan kullanmalı.
 */

type Gender = 'male' | 'female' | null | undefined;
type Lang = string | null | undefined;

const SALUTATION_MAP: Record<string, { male: string; female: string }> = {
  tr: { male: 'Bey',       female: 'Hanım'   },
  en: { male: 'Mr.',       female: 'Ms.'     },
  de: { male: 'Herr',      female: 'Frau'    },
  ru: { male: 'Господин',  female: 'Госпожа' },
  ar: { male: 'السيد',     female: 'السيدة'  },
};

export function getSalutation(language: Lang, gender: Gender): string {
  if (!gender) return '';
  const lang = (language || 'tr').toLowerCase().slice(0, 2);
  return SALUTATION_MAP[lang]?.[gender] || '';
}

/**
 * Tam hitap stringi üretir: "Özgür Bey", "Mr. Smith", "Herr Müller", vs.
 * gender yoksa sadece adı döner: "Özgür Özen"
 *
 * TR'de hitap isimden SONRA gelir (Özgür Bey).
 * EN/DE/RU/AR'de hitap isimden ÖNCE gelir (Mr. Smith, Herr Müller).
 */
export function formatGuestAddress(
  firstName: string | null,
  lastName: string | null,
  language: Lang,
  gender: Gender,
): string {
  const lang = (language || 'tr').toLowerCase().slice(0, 2);
  const salutation = getSalutation(lang, gender);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (!salutation) return fullName;

  // TR: "Özgür Bey"  (ad + hitap)
  // EN: "Mr. Smith"  (hitap + soyad)
  // DE: "Herr Müller" (hitap + soyad)
  // RU: "Господин Иванов" (hitap + soyad)
  // AR: "السيد سميث" (hitap + soyad)
  if (lang === 'tr') {
    return `${firstName || lastName} ${salutation}`.trim();
  }
  return `${salutation} ${lastName || firstName}`.trim();
}
