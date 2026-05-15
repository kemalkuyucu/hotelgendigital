'use client';

import { useState, useCallback } from 'react';
import Toast, { ToastItem, useToast } from './Toast';

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface WorkingHourDay {
  day: string;
  enabled: boolean;
  start: string | null;
  end: string | null;
  is_24h: boolean;
}

interface WorkingHoursTabProps {
  departmentCode: string;
  currentWorkingHours: WorkingHourDay[] | null | undefined;
  onSaved?: (wh: WorkingHourDay[]) => void;
}

/* ── Constants ────────────────────────────────────────────────────────────── */
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS: Record<string, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

function buildDefault(): WorkingHourDay[] {
  return DAY_KEYS.map((day) => ({
    day,
    enabled: true,
    start: '00:00',
    end: '00:00',
    is_24h: true,
  }));
}

function normalise(raw: WorkingHourDay[] | null | undefined): WorkingHourDay[] {
  if (!raw || raw.length === 0) return buildDefault();
  // Ensure all 7 days present and in correct order
  return DAY_KEYS.map((day) => {
    const found = raw.find((d) => d.day === day);
    return found ?? { day, enabled: true, start: '00:00', end: '00:00', is_24h: true };
  });
}

/* ── Component ────────────────────────────────────────────────────────────── */
export default function WorkingHoursTab({
  departmentCode,
  currentWorkingHours,
  onSaved,
}: WorkingHoursTabProps) {
  const [schedule, setSchedule] = useState<WorkingHourDay[]>(() =>
    normalise(currentWorkingHours)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { addToast } = useToast(setToasts);

  /* ── All-24h toggle ── */
  const allIs24h = schedule.every((d) => d.is_24h && d.enabled);

  function handleAll24h() {
    setSchedule((prev) =>
      prev.map((d) => ({ ...d, enabled: true, is_24h: !allIs24h }))
    );
  }

  /* ── Per-day updates ── */
  function updateDay(index: number, patch: Partial<WorkingHourDay>) {
    setSchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }

  /* ── Reset / Save ── */
  const handleCancel = () => {
    setSchedule(normalise(currentWorkingHours));
    setError(null);
  };

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/departments/${departmentCode}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ working_hours: schedule }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Bir hata oluştu');
        return;
      }
      addToast('Çalışma düzeni güncellendi', 'success');
      onSaved?.(schedule);
    } catch {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setSaving(false);
    }
  }, [departmentCode, schedule, addToast, onSaved]);

  return (
    <div className="staff-tab-root">
      <Toast toasts={toasts} />

      <div className="form-card form-card--wide">
        {/* ── Header ── */}
        <div className="form-card-header">
          <h2 className="form-card-title">Çalışma Düzeni</h2>
          <p className="form-card-desc">Departmanın haftalık çalışma saatleri</p>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="form-error-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            {error}
          </div>
        )}

        {/* ── All-24h toggle ── */}
        <div className="wh-all24h-row">
          <span className="wh-all24h-label">Tümünü 24/7 yap</span>
          <button
            type="button"
            className={`wh-toggle-pill${allIs24h ? ' wh-toggle-pill--on' : ''}`}
            onClick={handleAll24h}
            aria-pressed={allIs24h}
            id="wh-all-24h-toggle"
          >
            <span className="wh-toggle-knob" />
          </button>
        </div>

        {/* ── 7-day rows ── */}
        <div className="working-hours-table">
          {schedule.map((day, index) => (
            <div className="working-hours-row" key={day.day}>
              {/* Day name */}
              <span className="wh-day-name">{DAY_LABELS[day.day]}</span>

              {/* Open/Closed toggle */}
              <div className="wh-enabled-wrap">
                <button
                  type="button"
                  className={`wh-toggle-pill wh-toggle-pill--sm${day.enabled ? ' wh-toggle-pill--on' : ''}`}
                  onClick={() => updateDay(index, { enabled: !day.enabled })}
                  aria-pressed={day.enabled}
                  aria-label={`${DAY_LABELS[day.day]} ${day.enabled ? 'kapat' : 'aç'}`}
                  id={`wh-enabled-${day.day}`}
                >
                  <span className="wh-toggle-knob" />
                </button>
                <span className="wh-enabled-label">{day.enabled ? 'Açık' : 'Kapalı'}</span>
              </div>

              {/* Time controls (only if enabled) */}
              {day.enabled ? (
                <div className="wh-time-controls">
                  {/* 24h checkbox */}
                  <label className="wh-24h-label" htmlFor={`wh-24h-${day.day}`}>
                    <input
                      type="checkbox"
                      id={`wh-24h-${day.day}`}
                      checked={day.is_24h}
                      onChange={(e) => updateDay(index, { is_24h: e.target.checked })}
                      className="wh-checkbox"
                    />
                    <span>24 Saat</span>
                  </label>

                  {/* Start / End time pickers (only when not 24h) */}
                  {!day.is_24h && (
                    <div className="wh-time-pair">
                      <input
                        type="time"
                        value={day.start ?? '08:00'}
                        onChange={(e) => updateDay(index, { start: e.target.value })}
                        className="wh-time-input"
                        aria-label={`${DAY_LABELS[day.day]} başlangıç saati`}
                        id={`wh-start-${day.day}`}
                      />
                      <span className="wh-time-sep">—</span>
                      <input
                        type="time"
                        value={day.end ?? '00:00'}
                        onChange={(e) => updateDay(index, { end: e.target.value })}
                        className="wh-time-input"
                        aria-label={`${DAY_LABELS[day.day]} bitiş saati`}
                        id={`wh-end-${day.day}`}
                      />
                    </div>
                  )}

                  {day.is_24h && (
                    <span className="wh-24h-badge">24 Saat Açık</span>
                  )}
                </div>
              ) : (
                <div className="wh-closed-wrap">
                  <span className="wh-closed-badge">Kapalı</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="form-card-actions">
          <button
            type="button"
            className="btn-form-cancel"
            onClick={handleCancel}
            disabled={saving}
            id="wh-cancel-btn"
          >
            İptal
          </button>
          <button
            type="button"
            className="btn-form-save"
            onClick={handleSave}
            disabled={saving}
            id="wh-save-btn"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
