/**
 * /manager/dashboard — Bu route artık kullanılmıyor.
 * Geriye uyumluluk için /hotel-admin/demo-hotel/bilgi-yonetimi/otel-bilgileri'ne yönlendirir.
 *
 * VIP paneldeki içerikler /hotel-admin/[slug]/bilgi-yonetimi/* altına taşındı.
 */
import { redirect } from 'next/navigation';

// CSP Faz 2/a: STRONG alan (/manager) — statik prerender edilirse HTML nonce
// TASIYAMAZ ve enforce'ta tum script'leri bloklanir. Dynamic kalmali.
export const dynamic = 'force-dynamic';

export default function ManagerDashboardRedirect() {
  redirect('/hotel-admin/demo-hotel/bilgi-yonetimi/otel-bilgileri');
}
