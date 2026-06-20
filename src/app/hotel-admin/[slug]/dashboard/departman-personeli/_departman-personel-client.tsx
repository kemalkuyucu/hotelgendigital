'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { DepartmentKey } from '@/lib/hotel-admin/types'
import { deptLabel } from '@/lib/hotel-admin/types'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface StaffRow {
  id: string
  department_key: string
  full_name: string
  role_title: string | null
  telegram_user_id: string | null
  telegram_username: string | null
  whatsapp_id: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
}

interface Props {
  slug: string
  adminRole: string
  adminRoleLabel: string
  allowedDepts: DepartmentKey[]
  isOwner: boolean
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info'
interface Toast {
  id: number
  type: ToastType
  message: string
}

// ─── Departman renk paleti ────────────────────────────────────────────────────
const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  front_office: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', text: '#a5b4fc', badge: 'rgba(99,102,241,0.18)' },
  housekeeping: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', badge: 'rgba(16,185,129,0.18)' },
  technical: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d', badge: 'rgba(245,158,11,0.18)' },
  fb: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#fca5a5', badge: 'rgba(239,68,68,0.18)' },
  guest_relation: { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.25)', text: '#f9a8d4', badge: 'rgba(236,72,153,0.18)' },
  spa: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)', text: '#7dd3fc', badge: 'rgba(14,165,233,0.18)' },
  animation: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.25)', text: '#d8b4fe', badge: 'rgba(168,85,247,0.18)' },
}

function getDeptColor(key: string) {
  return DEPT_COLORS[key] ?? {
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.25)',
    text: '#94a3b8',
    badge: 'rgba(100,116,139,0.18)',
  }
}

// ─── Format tarih ─────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── WhatsApp Sütun Başlığı ───────────────────────────────────────────────────
function WhatsAppHeader() {
  return (
    <th style={{
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: 700,
      color: '#22c55e',
      whiteSpace: 'nowrap',
      letterSpacing: '0.03em',
    }}>
      📱 <span style={{ borderBottom: '2px solid #22c55e' }}>WhatsApp ID</span>
    </th>
  )
}

// ─── Telegram Sütun Başlığı ────────────────────────────────────────────────────
function TelegramHeader() {
  return (
    <th style={{
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: 700,
      color: '#38bdf8',
      whiteSpace: 'nowrap',
      letterSpacing: '0.03em',
    }}>
      ✈️ <span style={{ borderBottom: '2px solid #38bdf8' }}>Telegram ID</span>
    </th>
  )
}

// ─── ID Hücre ─────────────────────────────────────────────────────────────────
function IdCell({ value, type }: { value: string | null; type: 'whatsapp' | 'telegram' }) {
  if (!value) {
    return (
      <span style={{
        color: '#475569',
        fontSize: '12px',
        fontStyle: 'italic',
      }}>
        — tanımlı değil
      </span>
    )
  }

  const isWa = type === 'whatsapp'
  return (
    <code style={{
      fontSize: '12px',
      fontFamily: "'Courier New', monospace",
      background: isWa ? 'rgba(34,197,94,0.10)' : 'rgba(56,189,248,0.10)',
      color: isWa ? '#4ade80' : '#7dd3fc',
      padding: '3px 8px',
      borderRadius: '6px',
      border: `1px solid ${isWa ? 'rgba(34,197,94,0.25)' : 'rgba(56,189,248,0.25)'}`,
      display: 'inline-block',
      maxWidth: '180px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}>
      {value}
    </code>
  )
}

// ─── Durum Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      background: active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
      color: active ? '#4ade80' : '#64748b',
      border: `1px solid ${active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}`,
    }}>
      <span style={{ fontSize: '8px' }}>{active ? '●' : '●'}</span>
      {active ? 'Aktif' : 'Arşiv'}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{
            height: '14px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Toast Container ──────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      right: '28px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '380px',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            background:
              t.type === 'success' ? 'rgba(22,163,74,0.85)' :
                t.type === 'error' ? 'rgba(185,28,28,0.85)' :
                  'rgba(37,99,235,0.85)',
            border: `1px solid ${t.type === 'success' ? 'rgba(74,222,128,0.4)' :
                t.type === 'error' ? 'rgba(248,113,113,0.4)' :
                  'rgba(147,197,253,0.4)'
              }`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            color: '#f8fafc',
            fontSize: '13.5px',
            fontWeight: 500,
            pointerEvents: 'auto',
            animation: 'fadeIn 0.25s ease',
            cursor: 'pointer',
          }}
          onClick={() => onRemove(t.id)}
        >
          <span style={{ fontSize: '18px', flexShrink: 0 }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Personel Ekle Modal ──────────────────────────────────────────────────────
interface AddStaffModalProps {
  slug: string
  onClose: () => void
  onSuccess: (row: StaffRow) => void
  onToast: (type: ToastType, message: string) => void
}

function AddStaffModal({ slug, onClose, onSuccess, onToast }: AddStaffModalProps) {
  const [fullName, setFullName] = useState('')
  const [whatsappId, setWhatsappId] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ fullName?: string; platform?: string }>({})
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    // ESC ile kapat
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!fullName.trim()) errs.fullName = 'Ad Soyad zorunludur.'
    if (!whatsappId.trim() && !telegramId.trim()) errs.platform = 'En az bir platform ID\'si girin (WhatsApp veya Telegram).'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/department-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          whatsapp_id: whatsappId.trim() || undefined,
          telegram_id: telegramId.trim() || undefined,
        }),
      })
      const json = await res.json() as { staff?: StaffRow; error?: string }
      if (!res.ok) {
        onToast('error', json.error ?? `Hata: HTTP ${res.status}`)
        return
      }
      onSuccess(json.staff!)
      onToast('success', `"${fullName.trim()}" başarıyla eklendi.`)
      onClose()
    } catch {
      onToast('error', 'Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        padding: '32px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Modal başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              👤 Personel Ekle
            </h2>
            <p style={{ color: '#64748b', fontSize: '12.5px', margin: '4px 0 0' }}>
              Departmanınıza yeni personel ekleyin
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '16px',
              width: '36px', height: '36px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)}>
          {/* Ad Soyad */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ad Soyad <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: undefined })) }}
              placeholder="Örn: Ahmet Yılmaz"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: `1px solid ${errors.fullName ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
            />
            {errors.fullName && (
              <p style={{ color: '#f87171', fontSize: '11.5px', margin: '5px 0 0' }}>⚠ {errors.fullName}</p>
            )}
          </div>

          {/* Platform ID'leri — yan yana veya alt alta */}
          <div style={{ marginBottom: errors.platform ? '8px' : '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              {/* WhatsApp — yeşil */}
              <div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: '#22c55e', fontSize: '12px', fontWeight: 700,
                  marginBottom: '8px', letterSpacing: '0.03em',
                }}>
                  📱 <span style={{ borderBottom: '2px solid #22c55e' }}>WhatsApp ID</span>
                </label>
                <input
                  type="text"
                  value={whatsappId}
                  onChange={e => { setWhatsappId(e.target.value); setErrors(p => ({ ...p, platform: undefined })) }}
                  placeholder="905551234567"
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${errors.platform ? 'rgba(248,113,113,0.4)' : 'rgba(34,197,94,0.25)'}`,
                    background: 'rgba(34,197,94,0.06)',
                    color: '#4ade80',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: "'Courier New', monospace",
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.platform ? 'rgba(248,113,113,0.4)' : 'rgba(34,197,94,0.25)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <p style={{ color: '#4ade80', fontSize: '10.5px', opacity: 0.65, margin: '4px 0 0' }}>Uluslararası format</p>
              </div>

              {/* Telegram — mavi */}
              <div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: '#38bdf8', fontSize: '12px', fontWeight: 700,
                  marginBottom: '8px', letterSpacing: '0.03em',
                }}>
                  ✈️ <span style={{ borderBottom: '2px solid #38bdf8' }}>Telegram ID</span>
                </label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={e => { setTelegramId(e.target.value); setErrors(p => ({ ...p, platform: undefined })) }}
                  placeholder="Sayısal Chat ID"
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${errors.platform ? 'rgba(248,113,113,0.4)' : 'rgba(56,189,248,0.25)'}`,
                    background: 'rgba(56,189,248,0.06)',
                    color: '#7dd3fc',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: "'Courier New', monospace",
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.platform ? 'rgba(248,113,113,0.4)' : 'rgba(56,189,248,0.25)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <p style={{ color: '#7dd3fc', fontSize: '10.5px', opacity: 0.65, margin: '4px 0 0' }}>Sayısal Chat ID</p>
              </div>
            </div>

            {errors.platform && (
              <p style={{ color: '#f87171', fontSize: '11.5px', margin: '8px 0 0' }}>⚠ {errors.platform}</p>
            )}
          </div>

          {/* Info notu */}
          <div style={{
            marginBottom: '24px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            fontSize: '11.5px',
            color: '#94a3b8',
          }}>
            🔒 Departman otomatik atanır — kendi departmanınıza eklenir.
          </div>

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: loading
                  ? 'rgba(99,102,241,0.4)'
                  : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Ekleniyor...
                </>
              ) : '✓ Personel Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Arşiv Onay Modalı ────────────────────────────────────────────────────────
interface ConfirmModalProps {
  staff: StaffRow
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}

function ConfirmModal({ staff, onConfirm, onClose, loading }: ConfirmModalProps) {
  const isArchiving = staff.is_active
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        padding: '32px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.2s ease',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>
          {isArchiving ? '📦' : '♻️'}
        </div>
        <h3 style={{ color: '#f1f5f9', fontSize: '17px', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
          {isArchiving ? 'Personeli Arşivle' : 'Personeli Geri Al'}
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '0 0 6px', lineHeight: 1.6 }}>
          <strong style={{ color: '#e2e8f0' }}>{staff.full_name}</strong> adlı personel
          {isArchiving
            ? ' arşivlenecek. Verisi silinmez, istediğinizde geri alabilirsiniz.'
            : ' tekrar aktif edilecek.'}
        </p>
        {isArchiving && (
          <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 24px' }}>
            Bu işlem geri alınabilir.
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: loading
                ? 'rgba(100,116,139,0.3)'
                : isArchiving
                  ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#fff',
              fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : isArchiving ? '0 4px 12px rgba(100,116,139,0.3)' : '0 4px 12px rgba(34,197,94,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : isArchiving ? '📦 Arşivle' : '♻️ Geri Al'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ana Component ────────────────────────────────────────────────────────────
export default function DepartmanPersonelClient({
  slug,
  adminRole,
  adminRoleLabel,
  allowedDepts,
  isOwner,
}: Props) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDept, setFilterDept] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Yazma işlemleri state (sadece müdür)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<StaffRow | null>(null)
  const [statusLoading, setStatusLoading] = useState<string | null>(null) // staffId

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  function addToast(type: ToastType, message: string) {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }
  function removeToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/department-staff`)
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json() as { staff: StaffRow[] }
      setStaff(json.staff)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void fetchStaff() }, [fetchStaff])

  // ── Personel eklendi callback ───────────────────────────────────────────────
  function handleStaffAdded(newRow: StaffRow) {
    setStaff(prev => [newRow, ...prev])
  }

  // ── Arşivle / Geri Al ──────────────────────────────────────────────────────
  async function handleStatusToggle() {
    if (!confirmTarget) return
    setStatusLoading(confirmTarget.id)
    const newActive = !confirmTarget.is_active
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/department-staff/${confirmTarget.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      })
      const json = await res.json() as { staff?: StaffRow; error?: string }
      if (!res.ok) {
        addToast('error', json.error ?? `Hata: HTTP ${res.status}`)
        return
      }
      setStaff(prev => prev.map(s => s.id === confirmTarget.id ? { ...s, is_active: newActive } : s))
      addToast(
        'success',
        newActive
          ? `"${confirmTarget.full_name}" geri alındı — artık aktif.`
          : `"${confirmTarget.full_name}" arşivlendi.`
      )
    } catch {
      addToast('error', 'Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setStatusLoading(null)
      setConfirmTarget(null)
    }
  }

  // ── Filtreler ──────────────────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    if (filterDept !== 'all' && s.department_key !== filterDept) return false
    if (filterStatus === 'active' && !s.is_active) return false
    if (filterStatus === 'archived' && s.is_active) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.whatsapp_id ?? '').toLowerCase().includes(q) ||
        (s.telegram_user_id ?? '').toLowerCase().includes(q) ||
        (s.telegram_username ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Özet istatistikler ─────────────────────────────────────────────────────
  const totalActive = staff.filter(s => s.is_active).length
  const totalArchived = staff.filter(s => !s.is_active).length

  // ── Kolon sayısı (işlemler sütunu müdür için eklenir) ─────────────────────
  const colCount = isOwner ? 6 : 7

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '32px',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .staff-row:hover td {
          background: rgba(255,255,255,0.03) !important;
        }
        .filter-select:focus {
          outline: none;
          border-color: rgba(99,102,241,0.5) !important;
        }
        .search-input:focus {
          outline: none;
          border-color: rgba(99,102,241,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .action-btn-archive:hover {
          background: rgba(100,116,139,0.25) !important;
          border-color: rgba(100,116,139,0.5) !important;
        }
        .action-btn-restore:hover {
          background: rgba(34,197,94,0.2) !important;
          border-color: rgba(34,197,94,0.5) !important;
        }
        .add-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.45) !important;
        }
      `}</style>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modaller */}
      {showAddModal && !isOwner && (
        <AddStaffModal
          slug={slug}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleStaffAdded}
          onToast={addToast}
        />
      )}
      {confirmTarget && !isOwner && (
        <ConfirmModal
          staff={confirmTarget}
          onConfirm={() => void handleStatusToggle()}
          onClose={() => setConfirmTarget(null)}
          loading={statusLoading === confirmTarget.id}
        />
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#f1f5f9',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
              }}>
                👥 Departman Personeli
              </h1>
              <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
                {isOwner
                  ? 'Tüm departmanların personel listesi — salt okunur görünüm'
                  : `${adminRoleLabel} — kendi departmanınızın personeli`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* + Personel Ekle butonu — SADECE MÜDÜRE GÖRÜNÜR */}
              {!isOwner && (
                <button
                  id="add-staff-btn"
                  className="add-btn"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ＋ Personel Ekle
                </button>
              )}

              {/* Rol rozeti */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: isOwner ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${isOwner ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                fontSize: '12px',
                fontWeight: 600,
                color: isOwner ? '#fcd34d' : '#a5b4fc',
              }}>
                {isOwner ? '👁️ Görüntüleme' : '🏢 Departman Yöneticisi'}
                <span style={{
                  fontSize: '10px',
                  fontWeight: 400,
                  opacity: 0.8,
                }}>
                  {isOwner ? '(salt okunur)' : `(${allowedDepts.map(d => deptLabel(d)).join(', ')})`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── İstatistik Kartlar ──────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {[
            { label: 'Toplam Personel', value: staff.length, color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
            { label: 'Aktif', value: totalActive, color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
            { label: 'Arşiv', value: totalArchived, color: '#94a3b8', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
            { label: 'Departman', value: allowedDepts.length, color: '#7dd3fc', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)' },
          ].map(card => (
            <div key={card.label} style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: '14px',
              padding: '16px 20px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {loading ? '—' : card.value}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtreler ────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}>
          {/* Arama */}
          <input
            className="search-input"
            type="text"
            placeholder="🔍 Ad, WhatsApp ID veya Telegram ID ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 220px',
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              fontSize: '13px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />

          {/* Departman filtresi (sadece owner'a) */}
          {isOwner && (
            <select
              className="filter-select"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '9px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <option value="all" style={{ background: '#1e293b' }}>🏢 Tüm Departmanlar</option>
              {allowedDepts.map(d => (
                <option key={d} value={d} style={{ background: '#1e293b' }}>
                  {deptLabel(d)}
                </option>
              ))}
            </select>
          )}

          {/* Durum filtresi */}
          <select
            className="filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <option value="all" style={{ background: '#1e293b' }}>📋 Tümü</option>
            <option value="active" style={{ background: '#1e293b' }}>✅ Sadece Aktif</option>
            <option value="archived" style={{ background: '#1e293b' }}>🗂️ Sadece Arşiv</option>
          </select>

          {/* Yenile */}
          <button
            onClick={() => void fetchStaff()}
            disabled={loading}
            style={{
              padding: '9px 16px',
              borderRadius: '9px',
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.12)',
              color: '#a5b4fc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Yenile
          </button>
        </div>

        {/* ── Tablo ────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}>

          {/* WhatsApp/Telegram uyarı bandı */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            padding: '10px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '11.5px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'rgba(34,197,94,0.4)',
                border: '1px solid rgba(34,197,94,0.6)',
              }} />
              <span style={{ color: '#4ade80', fontWeight: 600 }}>📱 WhatsApp</span>
              <span style={{ color: '#64748b' }}>— yeşil alan, uluslararası format (örn: 905551234567)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'rgba(56,189,248,0.4)',
                border: '1px solid rgba(56,189,248,0.6)',
              }} />
              <span style={{ color: '#7dd3fc', fontWeight: 600 }}>✈️ Telegram</span>
              <span style={{ color: '#64748b' }}>— mavi alan, sayısal Chat ID</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Ad Soyad
                  </th>
                  {/* WhatsApp — belirgin yeşil */}
                  <WhatsAppHeader />
                  {/* Telegram — belirgin mavi */}
                  <TelegramHeader />
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Departman
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Durum
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Eklenme
                  </th>
                  {/* İşlemler — SADECE MÜDÜRE */}
                  {!isOwner && (
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      İşlemler
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton */}
                {loading && [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} cols={colCount} />)}

                {/* Hata */}
                {!loading && error && (
                  <tr>
                    <td colSpan={colCount} style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        maxWidth: '360px',
                      }}>
                        <div style={{ fontSize: '36px' }}>⚠️</div>
                        <p style={{ color: '#f87171', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                          Veri yüklenemedi
                        </p>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>
                          {error}
                        </p>
                        <button
                          onClick={() => void fetchStaff()}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#fca5a5',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Tekrar Dene
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Boş durum */}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ padding: '64px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                        {staff.length === 0 ? '👥' : '🔍'}
                      </div>
                      <p style={{ color: '#475569', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
                        {staff.length === 0 ? 'Henüz personel eklenmemiş' : 'Filtreye uyan personel yok'}
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                        {staff.length === 0
                          ? (isOwner ? 'Departman müdürleri personel ekleyebilir.' : '"+ Personel Ekle" butonunu kullanarak başlayın.')
                          : 'Filtreleri değiştirerek tekrar deneyin.'}
                      </p>
                    </td>
                  </tr>
                )}

                {/* Personel satırları */}
                {!loading && !error && filtered.map(row => {
                  const deptColor = getDeptColor(row.department_key)
                  const isThisLoading = statusLoading === row.id
                  return (
                    <tr
                      key={row.id}
                      className="staff-row"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.1s',
                        opacity: isThisLoading ? 0.6 : 1,
                      }}
                    >
                      {/* Ad Soyad + Ünvan */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div>
                          <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                            {row.full_name}
                          </span>
                          {row.role_title && (
                            <span style={{
                              display: 'block',
                              color: '#64748b',
                              fontSize: '11.5px',
                              marginTop: '2px',
                            }}>
                              {row.role_title}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp ID — yeşil vurgu */}
                      <td style={{
                        padding: '14px 16px',
                        verticalAlign: 'middle',
                        borderLeft: '2px solid rgba(34,197,94,0.15)',
                      }}>
                        <IdCell value={row.whatsapp_id} type="whatsapp" />
                      </td>

                      {/* Telegram ID — mavi vurgu */}
                      <td style={{
                        padding: '14px 16px',
                        verticalAlign: 'middle',
                        borderLeft: '2px solid rgba(56,189,248,0.15)',
                      }}>
                        <IdCell
                          value={row.telegram_user_id ?? row.telegram_username}
                          type="telegram"
                        />
                      </td>

                      {/* Departman Badge */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: deptColor.bg,
                          border: `1px solid ${deptColor.border}`,
                          color: deptColor.text,
                          whiteSpace: 'nowrap',
                        }}>
                          {deptLabel(row.department_key as DepartmentKey)}
                        </span>
                      </td>

                      {/* Durum */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <StatusBadge active={row.is_active} />
                      </td>

                      {/* Eklenme tarihi */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span style={{ color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDate(row.created_at)}
                        </span>
                        {row.created_by && (
                          <span style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                            {row.created_by}
                          </span>
                        )}
                      </td>

                      {/* İşlemler — SADECE MÜDÜRE */}
                      {!isOwner && (
                        <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {row.is_active ? (
                            <button
                              id={`archive-btn-${row.id}`}
                              className="action-btn-archive"
                              disabled={isThisLoading}
                              onClick={() => setConfirmTarget(row)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '7px',
                                border: '1px solid rgba(100,116,139,0.3)',
                                background: 'rgba(100,116,139,0.12)',
                                color: '#94a3b8',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: isThisLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {isThisLoading
                                ? <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(148,163,184,0.3)', borderTopColor: '#94a3b8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                : '📦'} Arşivle
                            </button>
                          ) : (
                            <button
                              id={`restore-btn-${row.id}`}
                              className="action-btn-restore"
                              disabled={isThisLoading}
                              onClick={() => setConfirmTarget(row)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '7px',
                                border: '1px solid rgba(34,197,94,0.3)',
                                background: 'rgba(34,197,94,0.08)',
                                color: '#4ade80',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: isThisLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {isThisLoading
                                ? <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(74,222,128,0.3)', borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                : '♻️'} Geri Al
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Alt bilgi */}
          {!loading && !error && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#475569',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <span>
                {filtered.length} kayıt gösteriliyor
                {filtered.length !== staff.length && ` (toplam ${staff.length} kayıttan)`}
              </span>
              {isOwner && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.15)',
                  color: '#fbbf24',
                  fontSize: '11px',
                }}>
                  👁️ Otel Sahibi — Salt Okunur Görünüm
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
