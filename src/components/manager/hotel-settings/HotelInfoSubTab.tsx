'use client';

import { useState, useEffect, useCallback } from 'react';
import Toast, { ToastItem, useToast } from '../Toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type ConceptType =
  | 'room_only'
  | 'bed_breakfast'
  | 'half_board'
  | 'full_board'
  | 'all_inclusive'
  | 'ultra_all_inclusive';

const CONCEPT_OPTIONS: { value: ConceptType; label: string }[] = [
  { value: 'room_only',          label: 'Sadece Oda' },
  { value: 'bed_breakfast',      label: 'Oda + Kahvaltı' },
  { value: 'half_board',         label: 'Yarım Pansiyon' },
  { value: 'full_board',         label: 'Tam Pansiyon' },
  { value: 'all_inclusive',      label: 'Her Şey Dahil' },
  { value: 'ultra_all_inclusive', label: 'Ultra Her Şey Dahil' },
];

interface HotelSettings {
  id?: string;
  hotel_name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  concept_type: ConceptType;
  check_in_time: string;
  check_out_time: string;
  general_rules: string;
}

const EMPTY: HotelSettings = {
  hotel_name: '',
  contact_phone: '',
  contact_email: '',
  address: '',
  concept_type: 'all_inclusive',
  check_in_time: '14:00',
  check_out_time: '12:00',
  general_rules: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonField({ height = 40, wide = false }: { height?: number; wide?: boolean }) {
  return (
    <div
      className="hotel-info-skeleton-field"
      style={{ height, maxWidth: wide ? '100%' : 560 }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HotelInfoSubTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<HotelSettings>(EMPTY);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { addToast } = useToast(setToasts);

  // ── Derived validations ──
  const emailValid =
    form.contact_email.trim() === '' || EMAIL_RE.test(form.contact_email.trim());
  const canSubmit =
    !saving && form.hotel_name.trim().length > 0 && emailValid;

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/manager/hotel-settings', {
          credentials: 'include',
        });
        const json = await res.json();
        if (!cancelled) {
          if (res.ok && json.settings) {
            const s = json.settings;
            setForm({
              hotel_name:    s.hotel_name    ?? '',
              contact_phone: s.contact_phone ?? '',
              contact_email: s.contact_email ?? '',
              address:       s.address       ?? '',
              concept_type:  (s.concept_type as ConceptType) ?? 'all_inclusive',
              check_in_time: s.check_in_time ?? '14:00',
              check_out_time:s.check_out_time?? '12:00',
              general_rules: s.general_rules ?? '',
            });
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Sunucuya bağlanılamadı');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Field change handler ──────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setError(null);
      setSaving(true);
      try {
        const res = await fetch('/api/manager/hotel-settings', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotel_name:    form.hotel_name.trim(),
            contact_phone: form.contact_phone.trim() || null,
            contact_email: form.contact_email.trim() || null,
            address:       form.address.trim() || null,
            concept_type:  form.concept_type,
            check_in_time: form.check_in_time || '14:00',
            check_out_time:form.check_out_time || '12:00',
            general_rules: form.general_rules.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Bir hata oluştu');
          addToast(json.error ?? 'Kayıt başarısız', 'error');
        } else {
          addToast('Otel bilgileri kaydedildi', 'success');
        }
      } catch {
        setError('Sunucuya bağlanılamadı');
        addToast('Sunucuya bağlanılamadı', 'error');
      } finally {
        setSaving(false);
      }
    },
    [canSubmit, form, addToast]
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="hotel-info-skeleton-root">
        <SkeletonField height={14} wide />
        <SkeletonField height={40} />
        <SkeletonField height={40} />
        <SkeletonField height={40} />
        <SkeletonField height={80} wide />
        <div style={{ display: 'flex', gap: 16 }}>
          <SkeletonField height={40} />
          <SkeletonField height={40} />
        </div>
        <SkeletonField height={100} wide />
        <SkeletonField height={44} />
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="hotel-info-root">
      <Toast toasts={toasts} />

      <div className="form-card form-card--wide">
        {/* Header */}
        <div className="form-card-header">
          <h2 className="form-card-title">Otel Bilgileri</h2>
          <p className="form-card-desc">
            Otelin genel iletişim ve operasyon bilgilerini buradan güncelleyin.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="form-error-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="hotel-info-form-body">

            {/* 1. Otel Adı — required */}
            <div className="form-group">
              <label className="form-label" htmlFor="hotel_name">
                Otel Adı <span className="hotel-info-required">*</span>
              </label>
              <input
                id="hotel_name"
                name="hotel_name"
                type="text"
                className="form-input"
                value={form.hotel_name}
                onChange={handleChange}
                maxLength={100}
                placeholder="örn. Grand Bella Hotel"
                required
                autoComplete="organization"
              />
            </div>

            {/* Row: Phone + Email */}
            <div className="hotel-info-two-col">
              {/* 2. Telefon */}
              <div className="form-group">
                <label className="form-label" htmlFor="contact_phone">
                  İletişim Telefonu
                </label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="text"
                  className="form-input"
                  value={form.contact_phone}
                  onChange={handleChange}
                  maxLength={30}
                  placeholder="+90 242 000 00 00"
                  autoComplete="tel"
                />
              </div>

              {/* 3. E-posta */}
              <div className="form-group">
                <label className="form-label" htmlFor="contact_email">
                  İletişim E-postası
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  className={`form-input${!emailValid ? ' form-input--error' : ''}`}
                  value={form.contact_email}
                  onChange={handleChange}
                  placeholder="info@oteladi.com"
                  autoComplete="email"
                />
                {!emailValid && (
                  <span className="hotel-info-field-error">Geçerli bir e-posta adresi girin</span>
                )}
              </div>
            </div>

            {/* 4. Adres */}
            <div className="form-group">
              <label className="form-label" htmlFor="address">
                Adres
              </label>
              <textarea
                id="address"
                name="address"
                className="form-input form-textarea"
                value={form.address}
                onChange={handleChange}
                maxLength={300}
                placeholder="Cadde, mahalle, ilçe, şehir..."
                rows={3}
              />
            </div>

            {/* 5. Konsept — required */}
            <div className="form-group">
              <label className="form-label" htmlFor="concept_type">
                Konsept <span className="hotel-info-required">*</span>
              </label>
              <select
                id="concept_type"
                name="concept_type"
                className="form-select"
                value={form.concept_type}
                onChange={handleChange}
                required
              >
                {CONCEPT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row: Check-in + Check-out */}
            <div className="hotel-info-two-col">
              {/* 6. Check-in */}
              <div className="form-group">
                <label className="form-label" htmlFor="check_in_time">
                  Check-in Saati
                </label>
                <input
                  id="check_in_time"
                  name="check_in_time"
                  type="time"
                  className="form-input"
                  value={form.check_in_time}
                  onChange={handleChange}
                />
              </div>

              {/* 7. Check-out */}
              <div className="form-group">
                <label className="form-label" htmlFor="check_out_time">
                  Check-out Saati
                </label>
                <input
                  id="check_out_time"
                  name="check_out_time"
                  type="time"
                  className="form-input"
                  value={form.check_out_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* 7. Genel Kurallar */}
            <div className="form-group">
              <label className="form-label" htmlFor="general_rules">
                Genel Kurallar
              </label>
              <textarea
                id="general_rules"
                name="general_rules"
                className="form-input form-textarea form-textarea--tall"
                value={form.general_rules}
                onChange={handleChange}
                maxLength={2000}
                placeholder="Otel kuralları, önemli bilgiler, misafirlere notlar..."
                rows={6}
              />
              <span className="hotel-info-char-count">
                {form.general_rules.length} / 2000
              </span>
            </div>

          </div>

          {/* Actions */}
          <div className="form-card-actions form-card-actions--right" style={{ marginTop: 8 }}>
            <button
              type="submit"
              id="hotel-info-save-btn"
              className="btn-form-save"
              disabled={!canSubmit}
            >
              {saving ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hotel-info-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                  </svg>
                  Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
