/**
 * Otel Bilgileri sayfası
 * /hotel-admin/[slug]/bilgi-yonetimi/otel-bilgileri
 *
 * Manager panelinden taşındı (/manager/dashboard → HotelSettingsTab → HotelInfoSubTab).
 * Aynı component'ı kullanır, sadece yeni route'ta.
 */

import HotelInfoSubTab from '@/components/manager/hotel-settings/HotelInfoSubTab';

export default function OtelBilgileriPage() {
  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          🏨 Otel Bilgileri
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Otelin temel bilgilerini ve iletişim verilerini yönetin.
        </p>
      </div>
      <HotelInfoSubTab />
    </div>
  );
}
