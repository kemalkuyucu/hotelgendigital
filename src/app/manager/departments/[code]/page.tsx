'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';
import {
  FrontOfficeIcon,
  FBIcon,
  HousekeepingIcon,
  TechnicalIcon,
  GuestRelationIcon,
  SpaIcon,
  AnimationIcon,
} from '@/components/manager/icons';
import StaffManagementTab from '@/components/manager/StaffManagementTab';
import SLATab from '@/components/manager/SLATab';
import WorkingHoursTab from '@/components/manager/WorkingHoursTab';
import HolidaysTab from '@/components/manager/HolidaysTab';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface DepartmentInfo {
  id: string;
  code: string;
  display_name: string;
  is_enabled: boolean;
  sla_minutes: number | null;
}

type SubTab = 'staff' | 'sla' | 'working-hours' | 'holidays';

/* ── Whitelist (güvenlik: sadece bilinen kodlar) ───────────────────────────── */
const VALID_CODES = new Set([
  'front_office', 'fb', 'housekeeping', 'technical',
  'guest_relation', 'spa', 'animation',
]);

/* ── Icon map ─────────────────────────────────────────────────────────────── */
type SvgIconComponent = (props: { size?: number; className?: string }) => React.ReactElement;

const ICON_MAP: Record<string, SvgIconComponent> = {
  front_office: FrontOfficeIcon,
  fb: FBIcon,
  housekeeping: HousekeepingIcon,
  technical: TechnicalIcon,
  guest_relation: GuestRelationIcon,
  spa: SpaIcon,
  animation: AnimationIcon,
};

function DeptIcon({ code }: { code: string }) {
  const Icon = ICON_MAP[code] ?? FrontOfficeIcon;
  return <Icon size={20} />;
}

/* ── Sub-tab config ───────────────────────────────────────────────────────── */
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'staff',         label: 'Sorumlular' },
  { id: 'sla',           label: 'SLA Süresi' },
  { id: 'working-hours', label: 'Çalışma Düzeni' },
  { id: 'holidays',      label: 'Tatil Günleri' },
];

/* ── Page component ───────────────────────────────────────────────────────── */
export default function DepartmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';

  const [dept, setDept] = useState<DepartmentInfo | null>(null);
  const [loadingDept, setLoadingDept] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>('staff');
  const [toggling, setToggling] = useState(false);

  /* ── Auth + department fetch ── */
  const fetchDept = useCallback(async () => {
    if (!code || !VALID_CODES.has(code)) {
      setNotFound(true);
      setLoadingDept(false);
      return;
    }

    setLoadingDept(true);
    try {
      // Fetch all departments from the existing list endpoint, filter by code
      const res = await fetch('/api/manager/departments/list', { credentials: 'include' });
      if (res.status === 401) {
        router.push('/manager/login');
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      const found = (json.departments as DepartmentInfo[]).find((d) => d.code === code);
      if (!found) {
        setNotFound(true);
        return;
      }
      setDept(found);
    } catch {
      setNotFound(true);
    } finally {
      setLoadingDept(false);
    }
  }, [code, router]);

  useEffect(() => {
    fetchDept();
  }, [fetchDept]);

  /* ── Toggle is_enabled ── */
  async function handleToggleEnabled() {
    if (!dept || toggling) return;
    setToggling(true);
    const newValue = !dept.is_enabled;
    // Optimistic update
    setDept((prev) => prev ? { ...prev, is_enabled: newValue } : prev);
    try {
      const res = await fetch(`/api/manager/departments/${code}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setDept((prev) => prev ? { ...prev, is_enabled: !newValue } : prev);
      }
    } catch {
      // Revert on error
      setDept((prev) => prev ? { ...prev, is_enabled: !newValue } : prev);
    } finally {
      setToggling(false);
    }
  }

  /* ── Loading / not found states ── */
  if (loadingDept) {
    return (
      <div className="landing-root login-chooser-root manager-login-root">
        <ParticleBackground />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px' }}>
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (notFound || !dept) {
    return (
      <div className="landing-root login-chooser-root manager-login-root">
        <ParticleBackground />
        <div style={{ textAlign: 'center', padding: '40px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <p style={{ color: '#f87171', fontSize: '16px', marginBottom: '16px' }}>
            Departman bulunamadı: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{code}</code>
          </p>
          <Link
            href="/manager/dashboard"
            style={{ color: '#c084fc', textDecoration: 'underline', fontSize: '14px' }}
          >
            ← Dashboard&apos;a Dön
          </Link>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className="landing-root manager-dashboard-root">
      <CursorGlow />
      <ParticleBackground />

      <div className="dept-detail-root">
        {/* ── Sticky Top Bar ── */}
        <header className="dept-detail-topbar">
          {/* Back */}
          <Link
            href="/manager/dashboard"
            className="dept-detail-back-btn"
            id="dept-detail-back-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
            <span>Departman Yönetimi</span>
          </Link>

          {/* Center: icon + name + badge */}
          <div className="dept-detail-topbar-center">
            <div className="dept-detail-topbar-icon">
              <DeptIcon code={dept.code} />
            </div>
            <span className="dept-detail-topbar-name">{dept.display_name}</span>
            <div
              className={`dept-status-badge ${dept.is_enabled ? 'dept-status-badge--active' : 'dept-status-badge--inactive'}`}
              style={{ marginLeft: 0 }}
            >
              <span className={`dept-status-dot ${dept.is_enabled ? 'dept-status-dot--active' : ''}`} />
              {dept.is_enabled ? 'Aktif' : 'Pasif'}
            </div>
          </div>

          {/* Right: toggle */}
          <div className="dept-detail-topbar-right">
            <button
              className={`dept-enable-toggle ${dept.is_enabled ? 'dept-enable-toggle--active' : 'dept-enable-toggle--inactive'}`}
              onClick={handleToggleEnabled}
              disabled={toggling}
              aria-pressed={dept.is_enabled}
              aria-label={dept.is_enabled ? 'Departmanı pasif yap' : 'Departmanı aktif yap'}
              id="dept-enable-toggle-btn"
            >
              <div className={`dept-toggle-switch ${dept.is_enabled ? 'dept-toggle-switch--on' : 'dept-toggle-switch--off'}`}>
                <div className={`dept-toggle-knob ${dept.is_enabled ? 'dept-toggle-knob--on' : 'dept-toggle-knob--off'}`} />
              </div>
              {toggling ? 'Güncelleniyor...' : (dept.is_enabled ? 'Aktif' : 'Pasif')}
            </button>
          </div>
        </header>

        {/* ── Second-level Tab Bar ── */}
        <nav className="dept-sub-tabs" role="tablist" aria-label="Departman alt sekmeleri">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              id={`dept-subtab-${tab.id}`}
              className={activeTab === tab.id ? 'dept-sub-tab-active' : 'dept-sub-tab-inactive'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Scrollable Content ── */}
        <main className="dept-detail-content" role="main">
          {activeTab === 'staff' && (
            <StaffManagementTab departmentCode={dept.code} />
          )}
          {activeTab === 'sla' && <SLATab />}
          {activeTab === 'working-hours' && <WorkingHoursTab />}
          {activeTab === 'holidays' && <HolidaysTab />}
        </main>
      </div>
    </div>
  );
}
