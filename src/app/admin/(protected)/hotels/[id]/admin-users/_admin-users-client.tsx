'use client'

import { useState } from 'react'
import type { HotelAdminUser, HotelAdminRole } from '@/lib/hotel-admin/types'
import { roleLabel } from '@/lib/hotel-admin/types'

const ROLES: HotelAdminRole[] = [
  'hotel_owner',
  'front_office_manager',
  'housekeeping_manager',
  'technical_manager',
  'fb_manager',
  'guest_relation_manager',
  'spa_manager',
  'animation_manager',
]

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  hotelId: string
  hotelSlug: string
  initialUsers: HotelAdminUser[]
}

export default function AdminUsersClient({ hotelId, initialUsers }: Props) {
  const [users, setUsers] = useState<HotelAdminUser[]>(initialUsers)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState<string | null>(null) // uid
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Add form state
  const [addForm, setAddForm] = useState({ full_name: '', username: '', role: 'front_office_manager' as HotelAdminRole, password: '' })

  function openAdd() {
    setAddForm({ full_name: '', username: '', role: 'front_office_manager', password: '' })
    setGeneratedPassword('')
    setError('')
    setShowAddModal(true)
  }

  function generateAndSet() {
    const pwd = generatePassword()
    setGeneratedPassword(pwd)
    setAddForm((p) => ({ ...p, password: pwd }))
    setCopied(false)
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAddUser() {
    if (!addForm.full_name.trim() || !addForm.username.trim() || !addForm.password) {
      setError('Ad Soyad, Kullanıcı Adı ve Şifre zorunludur.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/admin-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: addForm.full_name.trim(),
          username: addForm.username.trim(),
          role: addForm.role,
          password: addForm.password,
        }),
      })

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
      const refreshRes = await fetch(`/api/admin/hotels/${hotelId}/admin-users`)
      const refreshData = (await refreshRes.json()) as { users: HotelAdminUser[] }
      setUsers(refreshData.users ?? [])
      setShowAddModal(false)
    } catch {
      setError('Ağ hatası.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(uid: string) {
    const newPwd = generatePassword()
    setGeneratedPassword(newPwd)
    setShowResetModal(uid)
    setCopied(false)
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/admin-users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      })
      if (!res.ok) {
        setError('Şifre sıfırlama başarısız.')
      }
    } catch {
      setError('Ağ hatası.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(uid: string, name: string) {
    if (!confirm(`"${name}" yöneticisini silmek istiyor musunuz?`)) return

    try {
      await fetch(`/api/admin/hotels/${hotelId}/admin-users/${uid}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((u) => u.id !== uid))
    } catch {
      alert('Silme başarısız.')
    }
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

  return (
    <>
      {/* Add button */}
      <div style={{ marginBottom: '24px' }}>
        <button
          id="admin-user-add-btn"
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
          + Yeni Yönetici Ekle
        </button>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '60px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
            Henüz yönetici eklenmemiş.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Ad Soyad', 'Kullanıcı Adı', 'Rol', 'Son Giriş', 'İşlemler'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                    opacity: u.is_active ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                    {u.full_name}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6366f1', fontFamily: 'monospace' }}>
                    {u.username}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: u.role === 'hotel_owner' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.08)',
                        color: u.role === 'hotel_owner' ? '#d97706' : '#6366f1',
                      }}
                    >
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                    {formatDate(u.last_login_at)}
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      style={{
                        background: 'rgba(245,158,11,0.1)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: '#d97706',
                        cursor: 'pointer',
                        fontWeight: 600,
                        marginRight: '8px',
                      }}
                    >
                      Şifre Sıfırla
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.full_name)}
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

      {/* Add Modal */}
      {showAddModal && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '32px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 24px' }}>
              Yeni Yönetici Ekle
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>
                  Ad Soyad *
                </label>
                <input
                  id="admin-user-fullname"
                  style={inputStyle}
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Ali Yılmaz"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>
                  Kullanıcı Adı *
                </label>
                <input
                  id="admin-user-username"
                  style={inputStyle}
                  value={addForm.username}
                  onChange={(e) => setAddForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  placeholder="demo_tech"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>
                  Rol *
                </label>
                <select
                  id="admin-user-role"
                  style={inputStyle}
                  value={addForm.role}
                  onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value as HotelAdminRole }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>
                  Şifre *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="admin-user-password"
                    type="text"
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', background: '#f8fafc' }}
                    value={addForm.password || generatedPassword}
                    readOnly
                    placeholder="Şifre üret butonuna tıklayın"
                  />
                  <button
                    type="button"
                    onClick={generateAndSet}
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '8px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🎲 Üret
                  </button>
                  {(addForm.password || generatedPassword) && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(addForm.password || generatedPassword)}
                      style={{
                        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        color: copied ? '#059669' : '#64748b',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  )}
                </div>
                {generatedPassword && (
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', margin: '6px 0 0' }}>
                    ⚠️ Bu şifreyi kaydedin — bir daha gösterilmeyecek.
                  </p>
                )}
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px' }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
                >
                  İptal
                </button>
                <button
                  id="admin-user-save-btn"
                  onClick={handleAddUser}
                  disabled={saving}
                  style={{
                    background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Kaydediliyor...' : 'Yönetici Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(null) }}
        >
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
              🔑 Yeni Şifre
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>
              Yeni şifre otomatik olarak oluşturuldu ve uygulandı. Bu şifreyi WhatsApp ile ilgili kişiye iletiniz.
            </p>
            <div
              style={{
                background: '#f8fafc',
                border: '2px solid #6366f1',
                borderRadius: '10px',
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '20px',
                fontWeight: 700,
                color: '#4338ca',
                letterSpacing: '2px',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              {generatedPassword}
            </div>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => copyToClipboard(generatedPassword)}
                style={{ background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: copied ? '#059669' : '#6366f1', cursor: 'pointer', fontWeight: 600 }}
              >
                {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
              </button>
              <button
                onClick={() => setShowResetModal(null)}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
