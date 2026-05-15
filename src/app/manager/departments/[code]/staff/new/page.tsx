'use client';

import React, { useEffect, useState } from 'react';
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

/* ── Types ────────────────────────────────────────────────────────────────── */
interface DepartmentInfo {
  id: string;
  code: string;
  display_name: string;
  is_enabled: boolean;
  sla_minutes: number | null;
}

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

const VALID_CODES = new Set([
  'front_office', 'fb', 'housekeeping', 'technical',
  'guest_relation', 'spa', 'animation',
]);

/* ── Success animation component ─────────────────────────────────────────── */
function SuccessState({ name }: { name: string }) {
  return (
    <div className="staff-new-success">
      <div className="staff-new-success-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      <p className="staff-new-success-title">{name} başarıyla eklendi!</p>
      <p className="staff-new-success-sub">Departman sayfasına yönlendiriliyorsunuz...</p>
    </div>
  );
}

/* ── Page component ───────────────────────────────────────────────────────── */
export default function NewStaffPage() {
  const router = useRouter();
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';

  /* ── Department info ── */
  const [dept, setDept] = useState<DepartmentInfo | null>(null);
  const [loadingDept, setLoadingDept] = useState(true);

  /* ── Form state ── */
  const [form, setForm] = useState({
    full_name: '',
    role_title: '',
    telegram_user_id: '',
    telegram_username: '',
    whatsapp_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ── Auth + dept fetch ── */
  useEffect(() => {
    if (!code || !VALID_CODES.has(code)) {
      router.replace('/manager/dashboard');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/manager/departments/list', { credentials: 'include' });
        if (res.status === 401) {
          router.replace('/manager/login');
          return;
        }
        if (!res.ok) { router.replace('/manager/dashboard'); return; }
        const json = await res.json();
        const found = (json.departments as DepartmentInfo[]).find((d) => d.code === code);
        if (!found) { router.replace('/manager/dashboard'); return; }
        setDept(found);
      } catch {
        router.replace('/manager/dashboard');
      } finally {
        setLoadingDept(false);
      }
    })();
  }, [code, router]);

  /* ── Form helpers ── */
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/departments/${code}/staff`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          role_title: form.role_title || undefined,
          telegram_user_id: Number(form.telegram_user_id),
          telegram_username: form.telegram_username || undefined,
          whatsapp_id: form.whatsapp_id || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error ?? 'Sorumlu eklenemedi');
        return;
      }
      /* Success — show animation then redirect */
      setSuccess(true);
      const addedName = encodeURIComponent(form.full_name);
      setTimeout(() => {
        router.push(`/manager/departments/${code}?added=${addedName}`);
      }, 1500);
    } catch {
      setFormError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  /* ── Loading ── */
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

  const deptName = dept?.display_name ?? '';

  return (
    <div className="landing-root manager-dashboard-root">
      <CursorGlow />
      <ParticleBackground />

      <div className="staff-new-root">
        {/* ── Sticky Top Bar ── */}
        <header className="dept-detail-topbar">
          {/* Back */}
          <Link
            href={`/manager/departments/${code}`}
            className="dept-detail-back-btn"
            id="staff-new-back-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
            <span>{deptName}</span>
          </Link>

          {/* Center */}
          <div className="dept-detail-topbar-center">
            <div className="dept-detail-topbar-icon">
              <DeptIcon code={code} />
            </div>
            <span className="dept-detail-topbar-name">Yeni Sorumlu Ekle</span>
          </div>

          {/* Right: empty placeholder keeps flex layout balanced */}
          <div className="staff-new-topbar-right">
            <span className="staff-new-topbar-hint">Tüm alanlar isteğe bağlı değilse * ile işaretlendi</span>
          </div>
        </header>

        {/* ── Scrollable Content ── */}
        <main className="staff-new-content">
          {success ? (
            <SuccessState name={form.full_name} />
          ) : (
            <div className="staff-form-card">
              {/* Error banner */}
              {formError && (
                <div className="staff-new-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} id="add-staff-form" noValidate>
                {/* Tam İsim */}
                <div className="form-group">
                  <label className="form-label" htmlFor="sf-full-name">
                    TAM İSİM <span className="staff-modal-required">*</span>
                  </label>
                  <div className="form-input-wrapper">
                    <span className="form-input-icon-left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="sf-full-name"
                      type="text"
                      className="form-input"
                      placeholder="Örn: Özgür ÖZEN"
                      value={form.full_name}
                      onChange={set('full_name')}
                      required
                      maxLength={100}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Görev / Uzmanlık */}
                <div className="form-group">
                  <label className="form-label" htmlFor="sf-role-title">
                    GÖREV / UZMANLIK
                  </label>
                  <div className="form-input-wrapper">
                    <span className="form-input-icon-left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                      </svg>
                    </span>
                    <input
                      id="sf-role-title"
                      type="text"
                      className="form-input"
                      placeholder="Örn: Elektrik Teknisyeni"
                      value={form.role_title}
                      onChange={set('role_title')}
                    />
                  </div>
                </div>

                {/* Telegram User ID */}
                <div className="form-group">
                  <label className="form-label" htmlFor="sf-tg-id">
                    TELEGRAM USER ID <span className="staff-modal-required">*</span>
                  </label>
                  <div className="form-input-wrapper">
                    <span className="form-input-icon-left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <input
                      id="sf-tg-id"
                      type="number"
                      className="form-input"
                      placeholder="Örn: 123456789"
                      value={form.telegram_user_id}
                      onChange={set('telegram_user_id')}
                      required
                    />
                  </div>
                  <p className="staff-modal-hint">Telegram botun mesaj göndermesi için gerekli numerik ID</p>
                </div>

                {/* Telegram Username + WhatsApp — yan yana */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="sf-tg-username">
                      TELEGRAM USERNAME
                    </label>
                    <div className="form-input-wrapper">
                      <span className="form-input-icon-left" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>@</span>
                      <input
                        id="sf-tg-username"
                        type="text"
                        className="form-input"
                        placeholder="ozgurozen"
                        value={form.telegram_username}
                        onChange={set('telegram_username')}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="sf-whatsapp">
                      WHATSAPP ID
                    </label>
                    <div className="form-input-wrapper">
                      <span className="form-input-icon-left">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </span>
                      <input
                        id="sf-whatsapp"
                        type="text"
                        className="form-input"
                        placeholder="+905551234567"
                        value={form.whatsapp_id}
                        onChange={set('whatsapp_id')}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="staff-new-actions">
                  <Link
                    href={`/manager/departments/${code}`}
                    className="btn-modal-cancel staff-new-cancel-link"
                    id="staff-new-cancel-btn"
                  >
                    İptal
                  </Link>
                  <button
                    type="submit"
                    className="btn-modal-save"
                    disabled={saving}
                    id="staff-new-save-btn"
                    style={{ flex: 2 }}
                  >
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
