/**
 * /manager/login — Bu route artık kullanılmıyor.
 * Geriye uyumluluk için /hotel-admin/demo-hotel/login'e yönlendirir.
 *
 * NOT: Eğer farklı bir slug kullanıyorsanız URL'i kendiniz güncelleyin.
 * Tek oturum sistemi: hg_hotel_session cookie (hotel admin session).
 */
import { redirect } from 'next/navigation';

export default function ManagerLoginRedirect() {
  redirect('/hotel-admin/demo-hotel/login');
}
