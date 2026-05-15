'use client';

import { useEffect, useState } from 'react';
import DepartmentCard, { type Department } from './DepartmentCard';

type FetchState = 'loading' | 'error' | 'empty' | 'data';

export default function DepartmentManagementTab() {
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
            // JSON parse başarısız olsa bile devam et
          }
          setErrorDetail(detail);
          setState('error');
          return;
        }
        const data: { departments: Department[] } = await r.json();
        if (!data.departments || data.departments.length === 0) {
          setState('empty');
        } else {
          setDepartments(data.departments);
          setState('data');
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorDetail(msg);
        setState('error');
      });
  }, []);

  return (
    <div
      role="tabpanel"
      id="tabpanel-department"
      aria-labelledby="tab-department"
      className="dept-tab-root"
    >
      {/* ── Header ── */}
      <div className="dept-tab-header">
        <h2 className="dept-tab-title">Departman Yönetimi</h2>
        <p className="dept-tab-subtitle">
          Otel departmanlarını görüntüleyin ve yapılandırın
        </p>
      </div>

      {/* ── Loading ── */}
      {state === 'loading' && (
        <div className="department-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="department-card-skeleton" />
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {state === 'error' && (
        <div className="dept-state-box dept-state-box--error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Departmanlar yüklenemedi. Lütfen sayfayı yenileyin.
            {errorDetail && (
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  opacity: 0.6,
                  marginTop: '4px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                Detay: {errorDetail}
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Empty ── */}
      {state === 'empty' && (
        <div className="dept-state-box dept-state-box--empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
          Henüz departman tanımlı değil.
        </div>
      )}

      {/* ── Data ── */}
      {state === 'data' && (
        <div className="department-grid">
          {departments.map((dept, i) => (
            <DepartmentCard key={dept.id} department={dept} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
