/**
 * Çevre Keşfi sayfası
 * /hotel-admin/[slug]/bilgi-yonetimi/cevre-kesfi
 *
 * Manager panelinden taşındı (/manager/dashboard → HotelSettingsTab → PerplexityDiscoverySubTab).
 */

import PerplexityDiscoverySubTab from '@/components/manager/hotel-settings/PerplexityDiscoverySubTab';

export default function CevreKesfiPage() {
  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
          🗺️ Çevre Keşfi
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
          Otel çevresindeki mekanları, ulaşım seçeneklerini ve ilgi noktalarını keşfedin.
        </p>
      </div>
      <PerplexityDiscoverySubTab />
    </div>
  );
}
