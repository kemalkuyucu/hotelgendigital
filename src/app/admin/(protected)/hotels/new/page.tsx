import { redirect } from 'next/navigation'

/**
 * /admin/hotels/new — Wizard'a yönlendir.
 * Bu rota korunur (eski bookmarklar bozulmasın) ama wizard'a fallback eder.
 */
export default function NewHotelPage() {
  redirect('/admin/hotels/onboarding')
}
