'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import ManagerTopBar from '@/components/manager/ManagerTopBar';
import ManagerTabs, { type ManagerTab } from '@/components/manager/ManagerTabs';
import MasterHubTab from '@/components/manager/MasterHubTab';
import DepartmentManagementTab from '@/components/manager/DepartmentManagementTab';
import HotelSettingsTab from '@/components/manager/HotelSettingsTab';

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<ManagerTab>('master-hub');

  // 5 dakika hareketsizlik → otomatik logout
  useIdleTimeout();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/manager/logout', { method: 'POST' });
    } finally {
      router.push('/manager/login');
    }
  }

  return (
    <div className="manager-dashboard-root landing-root login-chooser-root">
      <CursorGlow />
      <ParticleBackground />

      {/* Tam sayfa wrapper — scroll için */}
      <div className="manager-dashboard-layout">
        {/* Üst Navigasyon Barı */}
        <ManagerTopBar onLogout={handleLogout} loggingOut={loggingOut} />

        {/* Sekme Barı */}
        <ManagerTabs active={activeTab} onChange={setActiveTab} />

        {/* İçerik Alanı */}
        <main className="manager-content-area">
          <div
            className={`manager-tab-panel ${activeTab === 'master-hub' ? 'manager-tab-panel--visible' : ''}`}
          >
            <MasterHubTab />
          </div>
          <div
            className={`manager-tab-panel ${activeTab === 'department' ? 'manager-tab-panel--visible' : ''}`}
          >
            <DepartmentManagementTab />
          </div>
          <div
            className={`manager-tab-panel ${activeTab === 'settings' ? 'manager-tab-panel--visible' : ''}`}
          >
            <HotelSettingsTab />
          </div>
        </main>
      </div>
    </div>
  );
}
