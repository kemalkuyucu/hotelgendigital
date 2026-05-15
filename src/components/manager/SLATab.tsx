'use client';

import { useState, useCallback } from 'react';
import Toast, { ToastItem, useToast } from './Toast';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface SLATabProps {
  departmentCode: string;
  currentSlaMinutes: number;
  onSaved?: (newMinutes: number) => void;
}

const QUICK_OPTIONS = [1, 3, 5, 10, 15, 30];

/* ── Component ────────────────────────────────────────────────────────────── */
export default function SLATab({ departmentCode, currentSlaMinutes, onSaved }: SLATabProps) {
  const [value, setValue] = useState<number>(currentSlaMinutes ?? 15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { addToast } = useToast(setToasts);

  const isDirty = value !== currentSlaMinutes;

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/departments/${departmentCode}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sla_minutes: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Bir hata oluştu');
        return;
      }
      addToast('SLA süresi güncellendi', 'success');
      onSaved?.(value);
    } catch {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setSaving(false);
    }
  }, [departmentCode, value, addToast, onSaved]);

  const handleCancel = () => {
    setValue(currentSlaMinutes ?? 15);
    setError(null);
  };

  return (
    <div className="staff-tab-root">
      <Toast toasts={toasts} />

      <div className="form-card">
        {/* ── Header ── */}
        <div className="form-card-header">
          <h2 className="form-card-title">SLA Süresi</h2>
          <p className="form-card-desc">
            Bu departmanın bir misafir isteğine yanıt verme süresi (dakika)
          </p>
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

        {/* ── SLA Input ── */}
        <div className="sla-input-group">
          <input
            id="sla-minutes-input"
            type="number"
            min={1}
            max={1440}
            value={value}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) setValue(Math.min(1440, Math.max(1, n)));
            }}
            className="sla-large-input"
            aria-label="SLA süresi (dakika)"
          />
          <span className="sla-unit-label">dk</span>
        </div>

        {/* ── Quick Select Buttons ── */}
        <div className="sla-quick-buttons">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`sla-quick-btn${value === opt ? ' sla-quick-btn--active' : ''}`}
              onClick={() => setValue(opt)}
              id={`sla-quick-${opt}`}
            >
              {opt} dk
            </button>
          ))}
        </div>

        {/* ── Hint ── */}
        <p className="form-card-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          Süre dolarsa, sistem isteği otomatik olarak Resepsiyon&apos;a yönlendirir
        </p>

        {/* ── Actions ── */}
        <div className="form-card-actions">
          <button
            type="button"
            className="btn-form-cancel"
            onClick={handleCancel}
            disabled={saving}
            id="sla-cancel-btn"
          >
            İptal
          </button>
          <button
            type="button"
            className="btn-form-save"
            onClick={handleSave}
            disabled={!isDirty || saving}
            id="sla-save-btn"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
