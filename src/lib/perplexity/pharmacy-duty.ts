/**
 * Nobetci eczane override — deterministik (KALICI KARAR #3).
 * Mesai disi saatte (18:30–08:30 TR) eczane sorusu gelirse, cache yerine
 * guncel nobetci eczane linki dondurulur. Sorumluluk linke + misafire gecer.
 * Brain'e dokunmaz (Yol B); fetchNearbyPlaces bu fonksiyonu cagirir.
 */

import { normalizeTr } from '@/lib/utils/normalize-tr';

// Turkiye 81 il — adres icinde il tespiti icin (normalize edilmis: ASCII kucuk)
const TR_PROVINCES: string[] = [
  'adana', 'adiyaman', 'afyonkarahisar', 'agri', 'amasya', 'ankara', 'antalya',
  'artvin', 'aydin', 'balikesir', 'bilecik', 'bingol', 'bitlis', 'bolu', 'burdur',
  'bursa', 'canakkale', 'cankiri', 'corum', 'denizli', 'diyarbakir', 'edirne',
  'elazig', 'erzincan', 'erzurum', 'eskisehir', 'gaziantep', 'giresun',
  'gumushane', 'hakkari', 'hatay', 'isparta', 'mersin', 'istanbul', 'izmir',
  'kars', 'kastamonu', 'kayseri', 'kirklareli', 'kirsehir', 'kocaeli', 'konya',
  'kutahya', 'malatya', 'manisa', 'kahramanmaras', 'mardin', 'mugla', 'mus',
  'nevsehir', 'nigde', 'ordu', 'rize', 'sakarya', 'samsun', 'siirt', 'sinop',
  'sivas', 'tekirdag', 'tokat', 'trabzon', 'tunceli', 'sanliurfa', 'usak', 'van',
  'yozgat', 'zonguldak', 'aksaray', 'bayburt', 'karaman', 'kirikkale', 'batman',
  'sirnak', 'bartin', 'ardahan', 'igdir', 'yalova', 'karabuk', 'kilis',
  'osmaniye', 'duzce',
]

/**
 * Su an Turkiye saatiyle nobet saatinde miyiz? (18:30–08:30)
 * TR = UTC+3 (yil boyu sabit, yaz saati uygulamasi yok).
 */
export function isPharmacyDutyTime(now: Date = new Date()): boolean {
  // UTC saatine 3 ekleyerek TR saatini bul
  const trHour = (now.getUTCHours() + 3) % 24
  const trMinute = now.getUTCMinutes()
  const trTotalMin = trHour * 60 + trMinute

  const dutyStart = 18 * 60 + 30 // 18:30
  const dutyEnd = 8 * 60 + 30 // 08:30

  // Gece araligi: 18:30'dan gece yarisina VEYA gece yarisindan 08:30'a
  return trTotalMin >= dutyStart || trTotalMin < dutyEnd
}

/**
 * Adres metninden Turkiye ilini yakalar. Bulamazsa null.
 * ONCE adresin son "/"-parcasini ("Ilce/IL" formatinda gercek il) dener; boylece
 * mahalle/sokak adindaki il-adi (ornek: "Igdir Mh." -> Mersin'deki otel) yanlis
 * yakalanmaz. Bulamazsa TUM adres uzerinde arar. Paylasilan normalizeTr kullanilir
 * (buyuk İ dogru islenir; ikinci normalizer YAZILMAZ — CLAUDE.md).
 */
export function extractProvince(address: string | null | undefined): string | null {
  if (!address) return null
  // 1) Adresin son "/"-parcasi = gercek il ("Ilce/IL")
  const segs = address.split('/')
  const tail = normalizeTr(segs[segs.length - 1] ?? '')
  for (const province of TR_PROVINCES) {
    if (new RegExp(`\\b${province}\\b`).test(tail)) return province
  }
  // 2) Fallback: tum adres uzerinde ara
  const full = normalizeTr(address)
  for (const province of TR_PROVINCES) {
    if (new RegExp(`\\b${province}\\b`).test(full)) return province
  }
  return null
}

/**
 * Nobet saatinde context'e enjekte edilecek metni uretir.
 * Il yakalanirsa il-bazli link, yoksa genel ana sayfa linki.
 */
export function buildPharmacyDutyBlock(address: string | null | undefined): string {
  const province = extractProvince(address)
  const link = province
    ? `https://www.eczaneler.gen.tr/nobetci-${province}`
    : `https://www.eczaneler.gen.tr/`

  return (
    `CEVRE [pharmacy] (NOBET SAATI):\n` +
    `Su an mesai disi saat. Nobetci eczaneler saatlik degisir, bu yuzden sabit liste yerine ` +
    `guncel nobetci eczane bilgisini su adresten anlik gorebilirsiniz: ${link}\n` +
    `Sayfada bulundugunuz ilce/konuma gore secim yapip eczaneyi telefonla teyit etmeniz onerilir.`
  )
}
