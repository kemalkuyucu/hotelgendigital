/**
 * Belgeler sayfası
 * /hotel-admin/[slug]/bilgi-yonetimi/belgeler
 *
 * Manager panelinden taşındı (/manager/dashboard → HotelSettingsTab → DocumentsSubTab).
 */

import DocumentsSubTab from '@/components/manager/hotel-settings/DocumentsSubTab';

export default function BelgelerPage() {
  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          📄 Belgeler
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Otele ait PDF, Word ve diğer belgeleri yükleyin ve yönetin.
        </p>
      </div>
      <DocumentsSubTab />
    </div>
  );
}
