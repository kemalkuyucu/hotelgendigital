'use client';

import React, { useEffect, useState, useCallback, useId } from 'react';

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface DepartmentStaff {
  id: string;
  full_name: string;
  role_title: string | null;
  telegram_user_id: number;
  telegram_username: string | null;
  whatsapp_id: string | null;
  created_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  exiting?: boolean;
}

interface Props {
  departmentCode: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/* ── Toast Component ──────────────────────────────────────────────────────── */
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}${t.exiting ? ' toast--exiting' : ''}`}
          role="status"
        >
          {t.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Add Staff Modal ──────────────────────────────────────────────────────── */
interface AddModalProps {
  departmentCode: string;
  onClose: () => void;
  onSaved: (staff: DepartmentStaff) => void;
  onError: (msg: string) => void;
}

function AddStaffModal({ departmentCode, onClose, onSaved, onError }: AddModalProps) {
  const uid = useId();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    role_title: '',
    telegram_user_id: '',
    telegram_username: '',
    whatsapp_id: '',
  });

  /* ── Body scroll lock ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/departments/${departmentCode}/staff`, {
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
        onError(json.error ?? 'Sorumlu eklenemedi');
        return;
      }
      onSaved(json.staff as DepartmentStaff);
    } catch {
      onError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="staff-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-modal-title`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="staff-modal">
        <button
          className="staff-modal-close"
          onClick={onClose}
          aria-label="Modalı kapat"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="staff-modal-title" id={`${uid}-modal-title`}>Yeni Sorumlu Ekle</h2>
        <p className="staff-modal-subtitle">
          Bu departmana yeni bir sorumlu kişi ekleyin
        </p>

        <form onSubmit={handleSubmit} id={`${uid}-add-staff-form`}>
          {/* Tam İsim */}
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-full-name`}>
              TAM İSİM <span className="staff-modal-required">*</span>
            </label>
            <div className="form-input-wrapper">
              <span className="form-input-icon-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id={`${uid}-full-name`}
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
            <label className="form-label" htmlFor={`${uid}-role-title`}>
              GÖREV / UZMANLIK
            </label>
            <div className="form-input-wrapper">
              <span className="form-input-icon-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              </span>
              <input
                id={`${uid}-role-title`}
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
            <label className="form-label" htmlFor={`${uid}-tg-id`}>
              TELEGRAM USER ID <span className="staff-modal-required">*</span>
            </label>
            <div className="form-input-wrapper">
              <span className="form-input-icon-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <input
                id={`${uid}-tg-id`}
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

          {/* Telegram Username */}
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-tg-username`}>
              TELEGRAM USERNAME
            </label>
            <div className="form-input-wrapper">
              <span className="form-input-icon-left" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>@</span>
              <input
                id={`${uid}-tg-username`}
                type="text"
                className="form-input"
                placeholder="Örn: ozgurozen"
                value={form.telegram_username}
                onChange={set('telegram_username')}
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-whatsapp`}>
              WHATSAPP ID
            </label>
            <div className="form-input-wrapper">
              <span className="form-input-icon-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <input
                id={`${uid}-whatsapp`}
                type="text"
                className="form-input"
                placeholder="Örn: +905551234567"
                value={form.whatsapp_id}
                onChange={set('whatsapp_id')}
              />
            </div>
          </div>

          <div className="staff-modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              İptal
            </button>
            <button
              type="submit"
              className="btn-modal-save"
              disabled={saving}
              id={`${uid}-save-staff-btn`}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Confirm Delete Dialog ────────────────────────────────────────────────── */
interface ConfirmProps {
  staff: DepartmentStaff;
  departmentCode: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}

function ConfirmDeleteDialog({ staff, departmentCode, onClose, onDeleted, onError }: ConfirmProps) {
  const [deleting, setDeleting] = useState(false);

  /* ── Body scroll lock ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/manager/departments/${departmentCode}/staff/${staff.id}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok) {
        const json = await res.json();
        onError(json.error ?? 'Sorumlu silinemedi');
        return;
      }
      onDeleted(staff.id);
    } catch {
      onError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="staff-confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="staff-confirm-dialog">
        <h3 className="staff-confirm-title">Sorumluyu Sil</h3>
        <p className="staff-confirm-body">
          <span className="staff-confirm-name">{staff.full_name}</span> adlı kişiyi bu
          departmandan silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </p>
        <div className="staff-confirm-actions">
          <button
            type="button"
            className="btn-confirm-cancel"
            onClick={onClose}
            disabled={deleting}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="btn-confirm-delete"
            onClick={handleDelete}
            disabled={deleting}
            id={`confirm-delete-${staff.id}`}
          >
            {deleting ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function StaffManagementTab({ departmentCode }: Props) {
  const [staff, setStaff] = useState<DepartmentStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentStaff | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ── Toast helpers ── */
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    // Start exit animation at 2.7s, remove at 3s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    }, 2700);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  /* ── Fetch staff ── */
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/manager/departments/${departmentCode}/staff`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? 'Sorumlular getirilemedi');
        return;
      }
      setStaff(json.staff as DepartmentStaff[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [departmentCode]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  /* ── Handlers ── */
  function handleSaved(newStaff: DepartmentStaff) {
    setStaff((prev) =>
      [...prev, newStaff].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
    );
    setShowAddModal(false);
    addToast('Sorumlu başarıyla eklendi', 'success');
  }

  function handleDeleted(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    setDeleteTarget(null);
    addToast('Sorumlu silindi', 'success');
  }

  function handleError(msg: string) {
    addToast(msg, 'error');
  }

  /* ── Render ── */
  return (
    <div className="staff-tab-root">
      {/* Header */}
      <div className="staff-tab-header">
        <div>
          <h2 className="staff-tab-title">Sorumlular</h2>
          {!loading && !fetchError && (
            <p className="staff-tab-count">
              {staff.length === 0
                ? 'Henüz sorumlu yok'
                : `${staff.length} sorumlu`}
            </p>
          )}
        </div>
        <button
          className="btn-add-staff"
          onClick={() => setShowAddModal(true)}
          id="btn-add-staff"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yeni Sorumlu Ekle
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="staff-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="staff-row-skeleton" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="dept-state-box dept-state-box--error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Sorumlular yüklenemedi.{' '}
            <button
              onClick={fetchStaff}
              style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}
            >
              Tekrar dene
            </button>
            {fetchError && (
              <span style={{ display: 'block', fontSize: '11px', opacity: 0.6, marginTop: '4px', fontFamily: 'monospace' }}>
                Detay: {fetchError}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Empty */}
      {!loading && !fetchError && staff.length === 0 && (
        <div className="staff-empty">
          <div className="staff-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="staff-empty-title">Henüz sorumlu eklenmemiş</p>
          <p className="staff-empty-sub">
            Bu departmana Telegram bildirimleri alacak sorumluları ekleyin
          </p>
        </div>
      )}

      {/* Staff List */}
      {!loading && !fetchError && staff.length > 0 && (
        <div className="staff-list">
          {staff.map((s, i) => (
            <div
              key={s.id}
              className="staff-row"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Avatar */}
              <div className="staff-avatar" aria-hidden="true">
                {getInitials(s.full_name)}
              </div>

              {/* Info */}
              <div className="staff-info">
                <p className="staff-name">{s.full_name}</p>
                {s.role_title && (
                  <p className="staff-role">{s.role_title}</p>
                )}
                <div className="staff-contacts">
                  <span className="staff-contact-item">
                    <span>📱</span>
                    <span>{s.telegram_user_id}</span>
                  </span>
                  {s.telegram_username && (
                    <span className="staff-contact-item">
                      <span style={{ opacity: 0.6 }}>@</span>
                      <span>{s.telegram_username}</span>
                    </span>
                  )}
                  {s.whatsapp_id && (
                    <span className="staff-contact-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{s.whatsapp_id}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                className="btn-delete-staff"
                onClick={() => setDeleteTarget(s)}
                aria-label={`${s.full_name} sorumlunu sil`}
                id={`btn-delete-staff-${s.id}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Sil
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddStaffModal
          departmentCode={departmentCode}
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
          onError={handleError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          staff={deleteTarget}
          departmentCode={departmentCode}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
          onError={handleError}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
