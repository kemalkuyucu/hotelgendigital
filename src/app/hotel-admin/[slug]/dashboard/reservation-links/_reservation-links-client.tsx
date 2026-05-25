'use client'

/**
 * Rezervasyon Linkleri — Client Component
 * Modül: Rezervasyon Linkleri Faz 1
 * Rol: hotel_owner | front_office_manager
 */

import { useEffect, useState, useCallback } from 'react'

interface ReservationLink {
  id: string
  label: string
  url: string
  sort_order: number
  is_official: boolean
  is_active: boolean
  created_at: string
  created_by?: string | null
}

type FormState = {
  label: string
  url: string
  sort_order: string
  is_official: boolean
}

const INITIAL_FORM: FormState = { label: '', url: '', sort_order: '', is_official: false }

export default function ReservationLinksClient() {
  const [links, setLinks] = useState<ReservationLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // New link form
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<FormState & { is_active: boolean }>>({})
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/manager/reservation-links')
      if (!res.ok) throw new Error('Linkler yüklenemedi')
      const data = await res.json()
      setLinks(data.links ?? [])
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  // ── Yeni Link Ekle ─────────────────────────────────────────────────────
  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.label.trim()) return setFormError('Etiket zorunludur')
    if (!form.url.trim()) return setFormError('URL zorunludur')
    if (!/^https?:\/\/.+/.test(form.url.trim())) return setFormError('URL http:// veya https:// ile başlamalı')

    setSubmitting(true)
    try {
      const res = await fetch('/api/manager/reservation-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label.trim(),
          url: form.url.trim(),
          sort_order: form.sort_order ? parseInt(form.sort_order, 10) : 99,
          is_official: form.is_official,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Link eklenemedi')
      setForm(INITIAL_FORM)
      setShowForm(false)
      await fetchLinks()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Arşivle ────────────────────────────────────────────────────────────
  async function handleArchive(id: string) {
    if (!confirm('Bu link arşivlenecek (devre dışı bırakılacak). Devam edilsin mi?')) return
    try {
      const res = await fetch(`/api/manager/reservation-links?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Arşivleme başarısız')
      await fetchLinks()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  // ── Düzenleme Başlat / İptal ────────────────────────────────────────────
  function startEdit(link: ReservationLink) {
    setEditId(link.id)
    setEditForm({
      label: link.label,
      url: link.url,
      sort_order: String(link.sort_order),
      is_official: link.is_official,
      is_active: link.is_active,
    })
    setEditError(null)
  }
  function cancelEdit() {
    setEditId(null)
    setEditForm({})
    setEditError(null)
  }

  // ── Düzenleme Kaydet ───────────────────────────────────────────────────
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setEditError(null)
    const url = editForm.url?.trim() ?? ''
    if (url && !/^https?:\/\/.+/.test(url)) return setEditError('URL http:// veya https:// ile başlamalı')

    setEditSubmitting(true)
    try {
      const payload: Record<string, unknown> = { id: editId }
      if (editForm.label) payload.label = editForm.label.trim()
      if (editForm.url) payload.url = editForm.url.trim()
      if (editForm.sort_order) payload.sort_order = parseInt(editForm.sort_order, 10)
      if (typeof editForm.is_official === 'boolean') payload.is_official = editForm.is_official
      if (typeof editForm.is_active === 'boolean') payload.is_active = editForm.is_active

      const res = await fetch('/api/manager/reservation-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Güncelleme başarısız')
      cancelEdit()
      await fetchLinks()
    } catch (e) {
      setEditError((e as Error).message)
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Yeniden Aktif Et ───────────────────────────────────────────────────
  async function handleReactivate(id: string) {
    try {
      const res = await fetch('/api/manager/reservation-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true }),
      })
      if (!res.ok) throw new Error('Yeniden aktifleştirme başarısız')
      await fetchLinks()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const activeLinks = links.filter(l => l.is_active)
  const archivedLinks = links.filter(l => !l.is_active)

  // ── Styles ─────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.7)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#f1f5f9',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }
  const btnPrimary: React.CSSProperties = {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  }
  const btnDanger: React.CSSProperties = {
    background: 'rgba(239,68,68,0.12)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
  const btnGhost: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Info Banner ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>ℹ️</span>
        <p style={{ color: '#a5b4fc', fontSize: '13.5px', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: '#c7d2fe' }}>Nasıl çalışır?</strong> Misafir rezervasyon
          istediğinde bot bu linkleri sırayla iletecek. <strong style={{ color: '#c7d2fe' }}>1.&nbsp;sıra her zaman otelin
          resmi rezervasyon linki olmalı.</strong>
        </p>
      </div>

      {/* ── Hata ────────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#f87171', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Yükleniyor ──────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>
          ⏳ Linkler yükleniyor…
        </div>
      )}

      {/* ── Aktif Linkler ───────────────────────────────────────────────────── */}
      {!loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 700, margin: 0 }}>
              🔗 Aktif Linkler
              <span style={{ marginLeft: '8px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                {activeLinks.length}
              </span>
            </h2>
            <button
              id="add-reservation-link-btn"
              style={btnPrimary}
              onClick={() => { setShowForm(v => !v); setFormError(null); setForm(INITIAL_FORM) }}
            >
              {showForm ? '✕ İptal' : '+ Yeni Link Ekle'}
            </button>
          </div>

          {/* ── Yeni Link Formu ─────────────────────────────────────────────── */}
          {showForm && (
            <div style={{
              ...cardStyle,
              border: '1px solid rgba(99,102,241,0.3)',
              marginBottom: '20px',
            }}>
              <h3 style={{ color: '#c7d2fe', fontSize: '14px', fontWeight: 700, margin: '0 0 20px' }}>➕ Yeni Rezervasyon Linki</h3>
              <form onSubmit={handleAddLink}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Etiket *</label>
                    <input
                      id="new-link-label"
                      style={inputStyle}
                      placeholder='ör. "Otel Resmi Sitesi"'
                      value={form.label}
                      onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Sıra No</label>
                    <input
                      id="new-link-sort-order"
                      style={inputStyle}
                      type="number"
                      min={1}
                      placeholder="1, 2, 3… (1=en üst)"
                      value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>URL *</label>
                  <input
                    id="new-link-url"
                    style={inputStyle}
                    placeholder="https://otelin-sitesi.com/rezervasyon"
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="new-link-official"
                    type="checkbox"
                    checked={form.is_official}
                    onChange={e => setForm(f => ({ ...f, is_official: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#6366f1' }}
                  />
                  <label htmlFor="new-link-official" style={{ color: '#cbd5e1', fontSize: '14px', cursor: 'pointer' }}>
                    ⭐ Otelin resmi rezervasyon linki (1. sıraya alınması önerilir)
                  </label>
                </div>
                {formError && (
                  <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 12px' }}>⚠️ {formError}</p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button id="submit-new-link-btn" type="submit" style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
                    {submitting ? '⏳ Ekleniyor…' : '✓ Link Ekle'}
                  </button>
                  <button type="button" style={btnGhost} onClick={() => { setShowForm(false); setFormError(null) }}>
                    İptal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Link Listesi ─────────────────────────────────────────────────── */}
          {activeLinks.length === 0 && !showForm && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ fontSize: '32px', margin: '0 0 12px' }}>🔗</p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Henüz rezervasyon linki eklenmemiş.</p>
              <p style={{ color: '#475569', fontSize: '13px', margin: '4px 0 0' }}>
                "+ Yeni Link Ekle" butonuyla başlayın.
              </p>
            </div>
          )}

          {activeLinks.map((link, idx) => {
            const isEditing = editId === link.id
            const isFirst = idx === 0

            return (
              <div
                key={link.id}
                style={{
                  ...cardStyle,
                  border: isFirst && link.is_official
                    ? '1px solid rgba(250,204,21,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: isFirst && link.is_official
                    ? 'rgba(250,204,21,0.05)'
                    : 'rgba(15,23,42,0.7)',
                  position: 'relative',
                }}
              >
                {/* Resmi rozeti */}
                {link.is_official && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'rgba(250,204,21,0.15)',
                    border: '1px solid rgba(250,204,21,0.35)',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#fde047',
                  }}>
                    ⭐ Resmi
                  </div>
                )}

                {isEditing ? (
                  /* ── Düzenleme Formu ─────────────────────────────────────── */
                  <form onSubmit={handleSaveEdit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={labelStyle}>Etiket</label>
                        <input
                          style={inputStyle}
                          value={editForm.label ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Sıra No</label>
                        <input
                          style={inputStyle}
                          type="number"
                          min={1}
                          value={editForm.sort_order ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, sort_order: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={labelStyle}>URL</label>
                      <input
                        style={inputStyle}
                        value={editForm.url ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editForm.is_official ?? false} onChange={e => setEditForm(f => ({ ...f, is_official: e.target.checked }))} style={{ accentColor: '#facc15' }} />
                        ⭐ Resmi Link
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editForm.is_active ?? true} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: '#22c55e' }} />
                        ✓ Aktif
                      </label>
                    </div>
                    {editError && <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 10px' }}>⚠️ {editError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" style={{ ...btnPrimary, opacity: editSubmitting ? 0.6 : 1 }} disabled={editSubmitting}>
                        {editSubmitting ? '⏳' : '✓ Kaydet'}
                      </button>
                      <button type="button" style={btnGhost} onClick={cancelEdit}>İptal</button>
                    </div>
                  </form>
                ) : (
                  /* ── Normal Görünüm ──────────────────────────────────────── */
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', paddingRight: link.is_official ? '90px' : '0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{
                          background: 'rgba(99,102,241,0.2)',
                          color: '#a5b4fc',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          #{link.sort_order}
                        </span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '14px' }}>{link.label}</span>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: '13px', textDecoration: 'none', wordBreak: 'break-all', display: 'block' }}
                      >
                        🌐 {link.url}
                      </a>
                      {link.created_by && (
                        <p style={{ color: '#475569', fontSize: '11px', margin: '6px 0 0' }}>
                          Ekleyen: {link.created_by} · {new Date(link.created_at).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        id={`edit-link-${link.id}`}
                        style={btnGhost}
                        onClick={() => startEdit(link)}
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        id={`archive-link-${link.id}`}
                        style={btnDanger}
                        onClick={() => handleArchive(link.id)}
                      >
                        📦 Arşivle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Arşivlenmiş Linkler ──────────────────────────────────────────── */}
          {archivedLinks.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h2 style={{ color: '#475569', fontSize: '14px', fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📦 Arşivlenmiş Linkler ({archivedLinks.length})
              </h2>
              {archivedLinks.map(link => (
                <div
                  key={link.id}
                  style={{
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    opacity: 0.7,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: '13px' }}>{link.label}</span>
                    <p style={{ color: '#374151', fontSize: '12px', margin: '2px 0 0', wordBreak: 'break-all' }}>{link.url}</p>
                  </div>
                  <button
                    id={`reactivate-link-${link.id}`}
                    style={{ ...btnGhost, fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => handleReactivate(link.id)}
                  >
                    ↩ Aktife Al
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
