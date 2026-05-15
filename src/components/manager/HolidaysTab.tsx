'use client';

import { useState, useCallback, useEffect } from 'react';
import Toast, { ToastItem, useToast } from './Toast';

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface Holiday {
  date: string;  // YYYY-MM-DD
  label: string;
}

interface HolidaysTabProps {
  departmentCode: string;
  currentHolidays: Holiday[] | null | undefined;
  onSaved?: (holidays: Holiday[]) => void;
}

/* ── Turkish date formatter ───────────────────────────────────────────────── */
function formatDateTR(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
  } catch {
    return dateStr;
  }
}

function isPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d) < today;
}

function sortHolidays(h: Holiday[]): Holiday[] {
  return [...h].sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Component ────────────────────────────────────────────────────────────── */
export default function HolidaysTab({
  departmentCode,
  currentHolidays,
  onSaved,
}: HolidaysTabProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(() =>
    sortHolidays(currentHolidays ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { addToast } = useToast(setToasts);
  const [isDirty, setIsDirty] = useState(false);

  /* ── beforeunload — kaydedilmemiş değişiklik uyarısı ── */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ── Inline add form ── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  function handleAddOpen() {
    setShowAddForm(true);
    setNewDate('');
    setNewLabel('');
    setAddError(null);
  }

  function handleAddCancel() {
    setShowAddForm(false);
    setAddError(null);
  }

  function handleAddConfirm() {
    setAddError(null);
    if (!newDate) { setAddError('Tarih seçiniz'); return; }
    if (!newLabel.trim()) { setAddError('Etiket zorunludur'); return; }
    if (holidays.some((h) => h.date === newDate)) {
      setAddError('Bu tarih zaten ekli'); return;
    }
    setHolidays((prev) => sortHolidays([...prev, { date: newDate, label: newLabel.trim() }]));
    setIsDirty(true);
    setShowAddForm(false);
  }

  function handleDelete(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
    setIsDirty(true);
  }

  /* ── Save all ── */
  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/departments/${departmentCode}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidays }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Bir hata oluştu');
        return;
      }
      addToast('Tatil günleri güncellendi', 'success');
      setIsDirty(false);
      onSaved?.(holidays);
    } catch {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setSaving(false);
    }
  }, [departmentCode, holidays, addToast, onSaved]);

  return (
    <div className="staff-tab-root">
      <Toast toasts={toasts} />

      <div className="form-card">
        {/* ── Header ── */}
        <div className="form-card-header">
          <div className="form-card-header-row">
            <div>
              <h2 className="form-card-title">Tatil Günleri</h2>
              <p className="form-card-desc">
                Bu departmanın resmi tatil veya özel kapalı günleri
              </p>
            </div>
            {!showAddForm && (
              <button
                type="button"
                className="btn-add-holiday"
                onClick={handleAddOpen}
                id="holiday-add-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Yeni Tatil Ekle
              </button>
            )}
          </div>
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

        {/* ── Inline Add Form ── */}
        {showAddForm && (
          <div className="holiday-add-form">
            <div className="holiday-add-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="holiday-new-date">Tarih</label>
                <input
                  id="holiday-new-date"
                  type="date"
                  className="form-input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="holiday-new-label">Etiket</label>
                <input
                  id="holiday-new-label"
                  type="text"
                  className="form-input"
                  placeholder="Örn: Yılbaşı"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
            {addError && (
              <p className="holiday-add-error">{addError}</p>
            )}
            <div className="holiday-add-actions">
              <button type="button" className="btn-form-cancel btn-form-cancel--sm" onClick={handleAddCancel} id="holiday-add-cancel">
                Vazgeç
              </button>
              <button type="button" className="btn-form-save btn-form-save--sm" onClick={handleAddConfirm} id="holiday-add-confirm">
                Ekle
              </button>
            </div>
          </div>
        )}

        {/* ── Holiday List ── */}
        {holidays.length === 0 ? (
          <div className="holiday-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p>Henüz tatil günü tanımlanmadı</p>
          </div>
        ) : (
          <div className="holiday-list">
            {holidays.map((h) => (
              <div
                key={h.date}
                className={`holiday-item${isPast(h.date) ? ' holiday-item--past' : ''}`}
              >
                <div className="holiday-item-info">
                  <span className="holiday-item-label">{h.label}</span>
                  <span className="holiday-item-date">{formatDateTR(h.date)}</span>
                </div>
                <button
                  type="button"
                  className="btn-delete-holiday"
                  onClick={() => handleDelete(h.date)}
                  aria-label={`${h.label} tatilini sil`}
                  id={`holiday-del-${h.date}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Save All ── */}
        <div className="form-card-actions form-card-actions--right">
          <button
            type="button"
            className="btn-form-save"
            onClick={handleSave}
            disabled={saving}
            id="holidays-save-btn"
          >
            {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
