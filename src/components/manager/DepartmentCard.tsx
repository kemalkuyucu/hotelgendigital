'use client';

import React from 'react';
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
  BellIcon,
} from './icons';

export interface Department {
  id: string;
  code: string;
  display_name: string;
  is_enabled: boolean;
  sla_minutes: number | null;
  working_hours: Record<string, unknown> | null;
  off_hours_behavior: string | null;
  notification_channel_priority: string | null;
  staff_count: number;
}

interface DepartmentCardProps {
  department: Department;
  index: number;
}

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
  return <Icon size={28} className="dept-card-icon-svg" />;
}

export default function DepartmentCard({ department, index }: DepartmentCardProps) {
  const {
    code,
    display_name,
    is_enabled,
    sla_minutes,
    notification_channel_priority,
    staff_count,
  } = department;


  return (
    <div
      className={`department-card${!is_enabled ? ' department-card--disabled' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      role="article"
      aria-label={`${display_name} departmanı`}
    >
      {/* ── Header ── */}
      <div className="dept-card-header">
        <div className="dept-card-icon-wrap">
          <DeptIcon code={code} />
        </div>

        <div className="dept-card-title-wrap">
          <h3 className="dept-card-title">{display_name}</h3>
          <span className="dept-card-code">{code}</span>
        </div>

        {/* Status dot */}
        <div className={`dept-status-badge${is_enabled ? ' dept-status-badge--active' : ' dept-status-badge--inactive'}`}>
          <span className={`dept-status-dot${is_enabled ? ' dept-status-dot--active' : ''}`} />
          {is_enabled ? 'Aktif' : 'Pasif'}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="dept-stat-row">
        <div className="stat-chip">
          <UsersIcon size={13} />
          <span>{staff_count} kişi</span>
        </div>
        <div className="stat-chip">
          <ClockIcon size={13} />
          <span>{sla_minutes ?? '—'} dk</span>
        </div>
        <div className="stat-chip">
          <BellIcon size={13} />
          <span>{notification_channel_priority ?? '—'}</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="dept-card-footer">
        <Link
          href={`/manager/departments/${code}`}
          className="dept-manage-btn"
          aria-label={`${display_name} departmanını yönet`}
          id={`dept-manage-btn-${code}`}
        >
          Yönet
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
