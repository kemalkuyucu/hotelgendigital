'use client';

export type ManagerTab = 'master-hub' | 'department' | 'settings';

interface ManagerTabsProps {
  active: ManagerTab;
  onChange: (tab: ManagerTab) => void;
}

const TABS: { id: ManagerTab; label: string }[] = [
  { id: 'master-hub', label: 'Master Hub' },
  { id: 'department', label: 'Departman Yönetimi' },
  { id: 'settings', label: 'Otel Sistem Ayarları' },
];

export default function ManagerTabs({ active, onChange }: ManagerTabsProps) {
  return (
    <nav className="manager-tabs" role="tablist" aria-label="Yönetici Panel Sekmeleri">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          className={active === tab.id ? 'manager-tab-active' : 'manager-tab-inactive'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
