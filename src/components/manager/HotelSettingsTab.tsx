'use client';

import { useState } from 'react';
import HotelInfoSubTab from './hotel-settings/HotelInfoSubTab';
import KnowledgeBaseSubTab from './hotel-settings/KnowledgeBaseSubTab';
import DocumentsSubTab from './hotel-settings/DocumentsSubTab';
import PerplexityDiscoverySubTab from './hotel-settings/PerplexityDiscoverySubTab';
import MeetingRoomsSubTab from './hotel-settings/MeetingRoomsSubTab';

type SubTab = 'info' | 'knowledge' | 'documents' | 'discovery' | 'meeting-rooms';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'info',          label: 'Otel Bilgileri' },
  { id: 'knowledge',     label: 'Bilgi Tabanı' },
  { id: 'documents',     label: 'Belgeler' },
  { id: 'discovery',     label: 'Çevre Keşfi' },
  { id: 'meeting-rooms', label: '🏛️ Toplantı Salonları' },
];

export default function HotelSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');

  return (
    <div
      className="hotel-settings-root"
      role="tabpanel"
      id="tabpanel-settings"
      aria-labelledby="tab-settings"
    >
      {/* Başlık */}
      <div className="hotel-settings-header">
        <h2 className="hotel-settings-title">Otel Sistem Ayarları</h2>
        <p className="hotel-settings-subtitle">Otel bilgilerini, bilgi tabanını ve belgelerinizi yönetin</p>
      </div>

      {/* Alt Sekme Barı */}
      <nav className="hotel-subtabs" role="tablist" aria-label="Otel Ayarları Alt Sekmeleri">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`subtab-${tab.id}`}
            aria-selected={activeSubTab === tab.id}
            aria-controls={`subtabpanel-${tab.id}`}
            className={activeSubTab === tab.id ? 'hotel-subtab-active' : 'hotel-subtab-inactive'}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Alt Sekme İçeriği */}
      <div
        className="hotel-subtab-content"
        role="tabpanel"
        id={`subtabpanel-${activeSubTab}`}
        aria-labelledby={`subtab-${activeSubTab}`}
      >
        {activeSubTab === 'info'          && <HotelInfoSubTab />}
        {activeSubTab === 'knowledge'     && <KnowledgeBaseSubTab />}
        {activeSubTab === 'documents'     && <DocumentsSubTab />}
        {activeSubTab === 'discovery'     && <PerplexityDiscoverySubTab />}
        {activeSubTab === 'meeting-rooms' && <MeetingRoomsSubTab />}
      </div>
    </div>
  );
}
