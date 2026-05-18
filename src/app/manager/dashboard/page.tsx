/**
 * /manager/dashboard — Bu route artık kullanılmıyor.
 * Geriye uyumluluk için /hotel-admin/demo-hotel/bilgi-yonetimi/otel-bilgileri'ne yönlendirir.
 *
 * VIP paneldeki içerikler /hotel-admin/[slug]/bilgi-yonetimi/* altına taşındı.
 */
import { redirect } from 'next/navigation';

export default function ManagerDashboardRedirect() {
  redirect('/hotel-admin/demo-hotel/bilgi-yonetimi/otel-bilgileri');
}
