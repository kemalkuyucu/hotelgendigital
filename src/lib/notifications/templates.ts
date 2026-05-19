/**
 * Module 17.c/17.d - Notification message templates
 * Hard-coded message templates (no AI, no dynamic config)
 */

export interface LateCheckoutParams {
  guestName: string;
  checkoutDate: string;  // "22.06.2026" format
  hotelName: string;
  checkoutTime?: string; // default "12:00"
}

export function lateCheckoutMessage(params: LateCheckoutParams): string {
  const time = params.checkoutTime ?? '12:00';
  return `Sayin ${params.guestName},

${params.checkoutDate} tarihinde otelimizden ayrilisiniz bulunmaktadir. Oda bosaltma saati ${time}'dir.

Gec cikis talebiniz icin resepsiyona danisabilirsiniz.

Konaklamanizdan memnun kalmis olmanizi dileriz, tekrar bekleriz.

— ${params.hotelName}`;
}

/**
 * Format a YYYY-MM-DD date to DD.MM.YYYY
 */
export function formatCheckoutDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
