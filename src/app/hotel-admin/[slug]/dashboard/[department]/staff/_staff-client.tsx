'use client'

import { useState } from 'react'
import type { Staff, DepartmentKey, StaffInput } from '@/lib/hotel-admin/types'

const DAY_OPTIONS = [
  { key: 'mon', label: 'Pzt' },
  { key: 'tue', label: 'Sal' },
  { key: 'wed', label: 'Çar' },
  { key: 'thu', label: 'Per' },
  { key: 'fri', label: 'Cum' },
  { key: 'sat', label: 'Cmt' },
  { key: 'sun', label: 'Paz' },
]

interface Props {
  slug: string
  department: DepartmentKey
  departmentLabel: string
  initialStaff: Staff[]
}

function formatShift(start: string | null, end: string | null): string {
  if (!start || !end) return '7/24'
  // "HH:MM:SS" → "HH:MM"
  const fmt = (t: string) => t.substring(0, 5)
  return `${fmt(start)} — ${fmt(end)}`
}

function formatDaysOff(days: string[]): string {
  if (!days || days.length === 0) return '—'
  const map: Record<string, string> = {
    mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz',
  }
  return days.map((d) => map[d] ?? d).join(', ')
}

const EMPTY_FORM: Omit<StaffInput, 'department_key'> = {
  full_name: '',
  role_title: '',
  telegram_user_id: '',
  telegram_username: '',
  whatsapp_id: '',
  shift_start: '',
  shift_end: '',
  days_off: [],
  is_active: true,
  notes: '',
}

export default function StaffPageClient({ slug, department, departmentLabel, initialStaff }: Props) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<StaffInput, 'department_key'>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTgInfo, setShowTgInfo] = useState(false)

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(s: Staff) {
    setEditingId(s.id)
    setForm({
      full_name: s.full_name,
      role_title: s.role_title ?? '',
      telegram_user_id: s.telegram_user_id ?? '',
      telegram_username: s.telegram_username ?? '',
      whatsapp_id: s.whatsapp_id ?? '',
      shift_start: s.shift_start ? s.shift_start.substring(0, 5) : '',
      shift_end: s.shift_end ? s.shift_end.substring(0, 5) : '',
      days_off: s.days_off ?? [],
      is_active: s.is_active,
      notes: s.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      setError('Ad Soyad zorunludur.')
      return
    }
    setSaving(true)
    setError('')

    const payload: StaffInput = {
      ...(editingId ? { id: editingId } : {}),
      department_key: department,
      full_name: form.full_name.trim(),
      role_title: form.role_title?.trim() || undefined,
      telegram_user_id: form.telegram_user_id?.trim() || undefined,
      telegram_username: form.telegram_username?.trim() || undefined,
      whatsapp_id: form.whatsapp_id?.trim() || undefined,
      shift_start: form.shift_start?.trim() || undefined,
      shift_end: form.shift_end?.trim() || undefined,
      days_off: form.days_off,
      is_active: form.is_active,
      notes: form.notes?.trim() || undefined,
    }

    try {
      let res: Response
      if (editingId) {
        res = await fetch(`/api/hotel-admin/staff/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/hotel-admin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data: unknown = await res.json()
      if (!res.ok) {
        const msg =
          typeof data === 'object' && data !== null && 'error' in data
            ? (data as { error: string }).error
            : 'Kayıt başarısız.'
        setError(msg)
        return
      }

      // Listeyi yenile
      const refreshRes = await fetch(`/api/hotel-admin/staff?department=${department}`)
      const refreshData = (await refreshRes.json()) as { staff: Staff[] }
      setStaff(refreshData.staff ?? [])
      setShowModal(false)
    } catch {
      setError('Ağ hatası.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" adlı personeli silmek istiyor musunuz?`)) return

    try {
      const res = await fetch(`/api/hotel-admin/staff/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setStaff((prev) => prev.filter((s) => s.id !== id))
      }
    } catch {
      alert('Silme işlemi başarısız.')
    }
  }

  function toggleDayOff(day: string) {
    setForm((prev) => {
      const current = prev.days_off ?? []
      if (current.includes(day)) {
        return { ...prev, days_off: current.filter((d) => d !== day) }
      }
      return { ...prev, days_off: [...current, day] }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#1e293b',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#64748b',
    marginBottom: '6px',
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              {departmentLabel} › Personel
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
              {staff.filter((s) => s.is_active).length} aktif personel
            </p>
          </div>
          <button
            id="staff-add-btn"
            onClick={openAdd}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            }}
          >
            + Yeni Personel Ekle
          </button>
        </div>

        {/* Table */}
        {staff.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '60px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>👥</div>
            <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
              Henüz personel eklenmemiş. &quot;+ Yeni Personel Ekle&quot; ile başlayın.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Ad Soyad', 'Görev', 'Telegram', 'Vardiya', 'İzin Günleri', 'Durum', 'İşlemler'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: i < staff.length - 1 ? '1px solid #f1f5f9' : 'none',
                      opacity: s.is_active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                      {s.full_name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                      {s.role_title ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6366f1', fontFamily: 'monospace' }}>
                      {s.telegram_username ? `@${s.telegram_username}` : s.telegram_user_id ? `ID:${s.telegram_user_id}` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {formatShift(s.shift_start, s.shift_end)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                      {formatDaysOff(s.days_off)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: s.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                          color: s.is_active ? '#059669' : '#64748b',
                        }}
                      >
                        {s.is_active ? '✅ Aktif' : '⛔ Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => openEdit(s)}
                        style={{
                          background: 'rgba(99,102,241,0.1)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#6366f1',
                          cursor: 'pointer',
                          fontWeight: 600,
                          marginRight: '8px',
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.full_name)}
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 24px' }}>
              {editingId ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Ad Soyad */}
              <div>
                <label style={labelStyle}>Ad Soyad *</label>
                <input
                  id="staff-full-name"
                  style={inputStyle}
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Ahmet Yılmaz"
                />
              </div>

              {/* Görev */}
              <div>
                <label style={labelStyle}>Görev / Pozisyon</label>
                <input
                  style={inputStyle}
                  value={form.role_title}
                  onChange={(e) => setForm((p) => ({ ...p, role_title: e.target.value }))}
                  placeholder="Elektrikçi, Tesisatçı..."
                />
              </div>

              {/* Telegram User ID */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Telegram User ID
                  <button
                    type="button"
                    onClick={() => setShowTgInfo(!showTgInfo)}
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '11px',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ?
                  </button>
                </label>
                {showTgInfo && (
                  <div
                    style={{
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      color: '#4338ca',
                      marginBottom: '8px',
                      lineHeight: 1.6,
                    }}
                  >
                    💡 Personelin Telegram User ID&apos;sini almak için: Personel{' '}
                    <strong>@userinfobot</strong> botuna <strong>/start</strong> yazsın, dönen
                    sayısal ID&apos;yi buraya girin.
                  </div>
                )}
                <input
                  id="staff-telegram-id"
                  style={inputStyle}
                  value={form.telegram_user_id}
                  onChange={(e) => setForm((p) => ({ ...p, telegram_user_id: e.target.value }))}
                  placeholder="758605940"
                />
              </div>

              {/* Telegram Username */}
              <div>
                <label style={labelStyle}>Telegram Kullanıcı Adı (opsiyonel)</label>
                <input
                  style={inputStyle}
                  value={form.telegram_username}
                  onChange={(e) => setForm((p) => ({ ...p, telegram_username: e.target.value }))}
                  placeholder="ahmet_y (@ olmadan)"
                />
              </div>

              {/* WhatsApp ID */}
              <div>
                <label style={labelStyle}>WhatsApp ID (ileride kullanılacak)</label>
                <input
                  style={inputStyle}
                  value={form.whatsapp_id}
                  onChange={(e) => setForm((p) => ({ ...p, whatsapp_id: e.target.value }))}
                  placeholder="905551234567"
                />
              </div>

              {/* Vardiya */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Vardiya Başlangıç (boş = 7/24)</label>
                  <input
                    type="time"
                    style={inputStyle}
                    value={form.shift_start}
                    onChange={(e) => setForm((p) => ({ ...p, shift_start: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vardiya Bitiş</label>
                  <input
                    type="time"
                    style={inputStyle}
                    value={form.shift_end}
                    onChange={(e) => setForm((p) => ({ ...p, shift_end: e.target.value }))}
                  />
                </div>
              </div>

              {/* İzin Günleri */}
              <div>
                <label style={labelStyle}>İzin Günleri</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {DAY_OPTIONS.map((day) => {
                    const selected = (form.days_off ?? []).includes(day.key)
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDayOff(day.key)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: selected ? '1px solid #6366f1' : '1px solid #e2e8f0',
                          background: selected ? 'rgba(99,102,241,0.12)' : '#f8fafc',
                          color: selected ? '#6366f1' : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label style={labelStyle}>Notlar</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Serbest not..."
                />
              </div>

              {/* Aktif */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="staff-is-active"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                />
                <label htmlFor="staff-is-active" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                  Aktif
                </label>
              </div>

              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#dc2626',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    fontSize: '14px',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  İptal
                </button>
                <button
                  id="staff-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: saving
                      ? 'rgba(99,102,241,0.5)'
                      : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
