/**
 * Toplantı Salonları sayfası
 * /hotel-admin/[slug]/bilgi-yonetimi/toplanti-salonlari
 *
 * Bilgi Yönetimi sol menüsünden erişilir.
 */

import MeetingRoomsSubTab from '@/components/manager/hotel-settings/MeetingRoomsSubTab';

export default function ToplantiSalonlariPage() {
  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          🏛️ Toplantı Salonları
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Otelin toplantı ve etkinlik salonlarını yönetin.
        </p>
      </div>
      <MeetingRoomsSubTab />
    </div>
  );
}
