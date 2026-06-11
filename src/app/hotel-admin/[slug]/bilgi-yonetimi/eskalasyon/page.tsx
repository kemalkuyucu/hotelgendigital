/**
 * Eskalasyon sayfasi
 * /hotel-admin/[slug]/bilgi-yonetimi/eskalasyon
 * SLA asimi / yanitsiz talepleri listeler (auth: ust layout hotel_owner guard'i).
 */
import EskalasyonClient from './_eskalasyon-client';

export default function EskalasyonPage() {
  return (
    <div style={{ padding: '40px' }}>
      <EskalasyonClient />
    </div>
  );
}
