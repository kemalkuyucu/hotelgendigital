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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
          🏛️ Toplantı Salonları
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
          Otelin toplantı ve etkinlik salonlarını yönetin.
        </p>
      </div>
      <MeetingRoomsSubTab />
    </div>
  );
}
