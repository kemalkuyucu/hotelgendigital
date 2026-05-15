'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FrontOfficeIcon,
  FBIcon,
  HousekeepingIcon,
  TechnicalIcon,
  GuestRelationIcon,
  SpaIcon,
  AnimationIcon,
  UsersIcon,
  ClockIcon,
} from './icons';
import type { Department } from './DepartmentCard';

/* ─── Types ──────────────────────────────────────────────────────────── */

type FetchState = 'loading' | 'error' | 'data';

type WorkingDayEntry = {
  day?: string;
  enabled?: boolean;
  /** legacy field — treated same as enabled */
  is_open?: boolean;
  is_24h?: boolean;
  start?: string;
  end?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

/**
 * Returns a human-readable working-hours summary:
 *  - "Yapılandırılmadı"  → null / undefined / empty / no enabled day
 *  - "Kapalı"            → all days explicitly closed
 *  - "24/7"              → all open days are 24 h
 *  - "HH:MM-HH:MM"       → first open day with explicit hours
 */
function getWorkingHoursSummary(
  workingHours: Record<string, unknown> | unknown[] | null | undefined,
): string {
  // ① null / undefined
  if (workingHours == null) return 'Yapılandırılmadı';

  // ② normalise to array
  const days = (Array.isArray(workingHours)
    ? workingHours
    : Object.values(workingHours)) as WorkingDayEntry[];

  // ③ empty array
  if (days.length === 0) return 'Yapılandırılmadı';

  // ④ check which days are "enabled" (supports both `enabled` and legacy `is_open`)
  const enabledDays = days.filter((d) => {
    if (typeof d.enabled === 'boolean') return d.enabled;
    if (typeof d.is_open === 'boolean') return d.is_open;
    return true; // assume open when neither field is present
  });

  // ⑤ no day is enabled → not configured
  if (enabledDays.length === 0) return 'Yapılandırılmadı';

  // ⑥ check for any explicitly closed days (all closed → Kapalı)
  const openDays = days.filter((d) => d.is_open !== false);
  if (openDays.length === 0) return 'Kapalı';

  // ⑦ all open days are 24 h
  //    Guard: enabledDays.every() on empty array = vacuous true → skip
  const all24h = enabledDays.length > 0 && enabledDays.every((d) => d.is_24h === true);
  if (all24h) return '24/7';

  // ⑧ first day with explicit hours
  const firstWithHours = enabledDays.find((d) => !d.is_24h && d.start && d.end);
  if (firstWithHours) return `${firstWithHours.start}-${firstWithHours.end}`;

  // ⑨ enabled days exist but no 24h flag and no start/end → schedule incomplete
  return 'Yapılandırılmadı';
}

/* ─── Icon map (same as DepartmentCard) ─────────────────────────────── */

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

function DeptIcon({ code, size = 22 }: { code: string; size?: number }) {
  const Icon = ICON_MAP[code] ?? FrontOfficeIcon;
  return <Icon size={size} className="summary-card-dept-icon" />;
}

/* ─── Calendar icon (inline) ─────────────────────────────────────────── */
function CalendarIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ─── Grid icon (for stat cards) ────────────────────────────────────── */
function GridIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CheckCircleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function TimerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  index: number;
}

function StatCard({ label, value, sub, icon, index }: StatCardProps) {
  return (
    <div
      className="stat-card"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Summary Card ───────────────────────────────────────────────────── */

interface SummaryCardProps {
  dept: Department;
  index: number;
}

function SummaryCard({ dept, index }: SummaryCardProps) {
  const { code, display_name, is_enabled, sla_minutes, staff_count, working_hours } = dept;
  const hoursSummary = getWorkingHoursSummary(working_hours);

  return (
    <Link
      href={`/manager/departments/${code}`}
      className={`summary-card${!is_enabled ? ' summary-card--disabled' : ''}`}
      style={{ animationDelay: `${200 + index * 60}ms` }}
      aria-label={`${display_name} departman detayına git`}
      id={`hub-summary-card-${code}`}
    >
      {/* Header */}
      <div className="summary-card-header">
        <div className="summary-card-icon-wrap">
          <DeptIcon code={code} size={20} />
        </div>
        <div className="summary-card-name">{display_name}</div>
        <div className={`summary-badge${is_enabled ? ' summary-badge--active' : ' summary-badge--inactive'}`}>
          <span className={`summary-badge-dot${is_enabled ? ' summary-badge-dot--active' : ''}`} />
          {is_enabled ? 'Aktif' : 'Pasif'}
        </div>
      </div>

      {/* Stat Row */}
      <div className="summary-stat-row">
        <div className="summary-stat-chip">
          <UsersIcon size={12} />
          <span>{staff_count} kişi</span>
        </div>
        <div className="summary-stat-chip">
          <ClockIcon size={12} />
          <span>{sla_minutes ?? '—'} dk</span>
        </div>
        <div className={`summary-stat-chip${hoursSummary === 'Yapılandırılmadı' ? ' summary-stat-chip--unconfigured' : ''}`}>
          <CalendarIcon size={12} />
          <span>{hoursSummary}</span>
        </div>
      </div>

      {/* Footer link */}
      <div className="summary-card-footer">
        <span className="summary-detail-link">
          Detay
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function SkeletonStatCards() {
  return (
    <div className="stat-cards-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card stat-card--skeleton" />
      ))}
    </div>
  );
}

function SkeletonSummaryGrid() {
  return (
    <div className="summary-cards-grid">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="summary-card summary-card--skeleton" />
      ))}
    </div>
  );
}

/* ─── Health Badge ───────────────────────────────────────────────────── */

function HealthBadge({ departments }: { departments: Department[] }) {
  const inactive = departments.filter((d) => !d.is_enabled).length;
  if (inactive === 0) {
    return (
      <div className="health-badge health-badge--healthy">
        <CheckCircleIcon size={13} />
        Sistem Sağlıklı
      </div>
    );
  }
  return (
    <div className="health-badge health-badge--warning">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      {inactive} departman pasif
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function MasterHubTab() {
  const [state, setState] = useState<FetchState>('loading');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    setState('loading');
    setErrorDetail(null);

    fetch('/api/manager/departments/list', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          let detail: string | null = null;
          try {
            const json = await r.json();
            detail = json?.detail ?? json?.error ?? null;
          } catch {
            // ignore parse errors
          }
          setErrorDetail(detail);
          setState('error');
          return;
        }
        const data: { departments: Department[] } = await r.json();
        setDepartments(data.departments ?? []);
        setState('data');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorDetail(msg);
        setState('error');
      });
  }, []);

  /* ── Computed stats ── */
  const totalDepts = departments.length;
  const activeDepts = departments.filter((d) => d.is_enabled).length;
  const totalStaff = departments.reduce((sum, d) => sum + (d.staff_count ?? 0), 0);
  const avgSla =
    departments.filter((d) => d.sla_minutes != null).length > 0
      ? Math.round(
          departments.reduce((sum, d) => sum + (d.sla_minutes ?? 0), 0) /
            departments.filter((d) => d.sla_minutes != null).length
        )
      : null;

  return (
    <div
      className="master-hub-root"
      role="tabpanel"
      id="tabpanel-master-hub"
      aria-labelledby="tab-master-hub"
    >
      {/* ── Top Bar ── */}
      <div className="master-hub-topbar">
        <div>
          <h2 className="master-hub-title">Master Hub</h2>
          <p className="master-hub-subtitle">Tüm departmanların anlık özet görünümü</p>
        </div>
        {state === 'data' && <HealthBadge departments={departments} />}
      </div>

      {/* ── Stat Cards ── */}
      {state === 'loading' && <SkeletonStatCards />}

      {state === 'data' && (
        <div className="stat-cards-grid">
          <StatCard
            index={0}
            label="Toplam Departman"
            value={totalDepts}
            sub={`${activeDepts} aktif, ${totalDepts - activeDepts} pasif`}
            icon={<GridIcon size={18} />}
          />
          <StatCard
            index={1}
            label="Aktif Departman"
            value={activeDepts}
            sub={`${totalDepts - activeDepts} departman pasif`}
            icon={<CheckCircleIcon size={18} />}
          />
          <StatCard
            index={2}
            label="Toplam Sorumlu"
            value={totalStaff}
            sub="Tüm departmanlar toplamı"
            icon={<UsersIcon size={18} />}
          />
          <StatCard
            index={3}
            label="Ortalama SLA"
            value={avgSla != null ? `${avgSla} dk` : '—'}
            sub="Departman ortalaması"
            icon={<TimerIcon size={18} />}
          />
        </div>
      )}

      {/* ── Error Banner ── */}
      {state === 'error' && (
        <div className="master-hub-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Veriler yüklenemedi. Lütfen sayfayı yenileyin.
            {errorDetail && (
              <span className="master-hub-error-detail">Detay: {errorDetail}</span>
            )}
          </span>
        </div>
      )}

      {/* ── Department Summary Grid ── */}
      {state === 'loading' && <SkeletonSummaryGrid />}

      {state === 'data' && (
        <>
          <div className="master-hub-section-label">Departman Özeti</div>
          <div className="summary-cards-grid">
            {departments.map((dept, i) => (
              <SummaryCard key={dept.id} dept={dept} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
