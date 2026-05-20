/**
 * Modül 18 — Türkiye Saat Dilimi (Europe/Istanbul) Yardımcıları
 *
 * Vercel sunucusu UTC'de çalışır. Türkiye UTC+3 olduğu için
 * saat 21:00 UTC'den sonra new Date() ile yapılan tarih hesapları
 * bir gün kayar. Bu modül tüm tarih hesaplarını Europe/Istanbul
 * üzerinden yapar.
 */

const TR_TZ = 'Europe/Istanbul';

/**
 * Türkiye saatindeki YYYY-MM-DD'yi temsil eden yerel gece yarısı Date döner.
 */
export function getTurkeyDate(date: Date = new Date()): Date {
  const str = date.toLocaleString('en-CA', {
    timeZone: TR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return new Date(str + 'T00:00:00');
}

/**
 * 'YYYY-MM-DD' formatında bugünün Türkiye tarihini döner.
 */
export function getTurkeyToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TR_TZ });
}

/**
 * 'YYYY-MM-DD' formatında yarının Türkiye tarihini döner.
 */
export function getTurkeyTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('en-CA', { timeZone: TR_TZ });
}

/**
 * İki tarihin Türkiye saatinde aynı gün olup olmadığını kontrol eder.
 * date1 / date2: 'YYYY-MM-DD' string veya Date nesnesi kabul eder.
 */
export function isSameTurkeyDay(
  date1: string | Date,
  date2: string | Date,
): boolean {
  const d1 =
    typeof date1 === 'string'
      ? date1.split('T')[0]
      : new Date(date1).toLocaleDateString('en-CA', { timeZone: TR_TZ });
  const d2 =
    typeof date2 === 'string'
      ? date2.split('T')[0]
      : new Date(date2).toLocaleDateString('en-CA', { timeZone: TR_TZ });
  return d1 === d2;
}

/**
 * Türkiye saatinde tarih+saat formatını döner: "20.05.2026 21:30"
 */
export function formatTurkeyDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('tr-TR', {
    timeZone: TR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
