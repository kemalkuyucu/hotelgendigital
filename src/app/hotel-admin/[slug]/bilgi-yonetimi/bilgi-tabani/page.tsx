/**
 * Bilgi Tabanı sayfası
 * /hotel-admin/[slug]/bilgi-yonetimi/bilgi-tabani
 *
 * Manager panelinden taşındı (/manager/dashboard → HotelSettingsTab → KnowledgeBaseSubTab).
 */

import KnowledgeBaseSubTab from '@/components/manager/hotel-settings/KnowledgeBaseSubTab';

export default function BilgiTabaniPage() {
  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          📚 Bilgi Tabanı
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          AI'ın kullanacağı otel bilgilerini ve SSS içeriklerini yönetin.
        </p>
      </div>
      <KnowledgeBaseSubTab />
    </div>
  );
}
