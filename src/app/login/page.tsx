'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';

// Departman listesi — hotel_admin_users.role enum ile eşleşir
// Adım 6: "ANIM - Animasyon" en alta eklendi
const DEPARTMENTS = [
  { code: 'fo',   label: 'FO — Ön Büro'           },
  { code: 'fb',   label: 'F&B — Yiyecek & İçecek' },
  { code: 'hk',   label: 'HK — Housekeeping'       },
  { code: 'gr',   label: 'GR — Guest Relation'     },
  { code: 'ts',   label: 'TS — Teknik Servis'      },
  { code: 'spa',  label: 'SPA — SPA & Wellness'    },
  { code: 'anim', label: 'ANIM — Animasyon'        },
] as const;

// Demo hotel slug (gerçek projede dinamik olur)
const DEMO_HOTEL_SLUG = 'demo-hotel';

export default function LoginChooserPage() {
  const router = useRouter();
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');

  function handleDeptSelect(deptCode: string) {
    setSelectedDept(deptCode);
    setShowDeptDropdown(false);
    router.push(`/hotel-admin/${DEMO_HOTEL_SLUG}/login?dept=${deptCode}`);
  }

  return (
    <div className="landing-root login-chooser-root">
      <CursorGlow />
      <ParticleBackground />

      <button
        className="back-button"
        onClick={() => router.push('/')}
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Sunuma Dön</span>
      </button>

      <div className="login-chooser-container">
        <div className="login-chooser-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hero-icon-check">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <h1 className="login-chooser-title">Sisteme Giriş Yapın</h1>
        <p className="login-chooser-subtitle">Lütfen yetkili olduğunuz alanı seçerek devam edin.</p>

        <div className="login-chooser-cards">

          {/* ── Hotel Sistem Ayarları Kartı + Departman Dropdown ── */}
          <div className="login-card-wrapper">
            <button
              className="login-card login-card-system"
              onClick={() => setShowDeptDropdown((prev) => !prev)}
              type="button"
              aria-expanded={showDeptDropdown}
              aria-haspopup="listbox"
              id="hotel-sistem-card"
            >
              <div className="login-card-icon login-card-icon-blue">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <h3 className="login-card-title">Hotel Sistem Ayarları</h3>
              <p className="login-card-desc">
                {selectedDept
                  ? `Seçilen: ${DEPARTMENTS.find((d) => d.code === selectedDept)?.label}`
                  : 'Departmanınızı seçerek giriş yapın.'}
              </p>
              {/* Dropdown ok ikonu */}
              <svg
                className={`dept-chevron${showDeptDropdown ? ' dept-chevron--open' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Departman listesi */}
            {showDeptDropdown && (
              <ul
                className="dept-dropdown"
                role="listbox"
                aria-label="Departman seçin"
                id="dept-dropdown-list"
              >
                {DEPARTMENTS.map((dept) => (
                  <li
                    key={dept.code}
                    role="option"
                    aria-selected={selectedDept === dept.code}
                    className={`dept-dropdown-item${selectedDept === dept.code ? ' dept-dropdown-item--active' : ''}`}
                    onClick={() => handleDeptSelect(dept.code)}
                    id={`dept-option-${dept.code}`}
                  >
                    {dept.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Yönetici Paneli Kartı ── */}
          <button
            className="login-card login-card-manager"
            onClick={() => router.push('/manager/login')}
            type="button"
            id="yonetici-paneli-card"
          >
            <div className="login-card-icon login-card-icon-purple">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3 className="login-card-title">Yönetici Paneli</h3>
            <p className="login-card-desc">Üst Düzey Yönetici ve İletişim yetkileri.</p>
          </button>

        </div>
      </div>
    </div>
  );
}
