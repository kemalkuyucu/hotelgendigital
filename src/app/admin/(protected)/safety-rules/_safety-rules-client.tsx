'use client'

import { useState } from 'react'
import type { SafetyRule } from './page'

interface Props {
  initialRules: SafetyRule[]
}

interface FormState {
  category: string
  title: string
  description: string
  ai_instruction: string
  priority: number
  is_active: boolean
}

const defaultForm: FormState = {
  category: '',
  title: '',
  description: '',
  ai_instruction: '',
  priority: 50,
  is_active: true,
}

// ─── Ortak glassmorphism kart stili ─────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#f1f5f9',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function SafetyRulesClient({ initialRules }: Props) {
  const [rules, setRules] = useState<SafetyRule[]>(initialRules)
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<SafetyRule | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* ─── helpers ─── */

  function openNewModal() {
    setEditingRule(null)
    setForm(defaultForm)
    setError(null)
    setShowModal(true)
  }

  function openEditModal(rule: SafetyRule) {
    setEditingRule(rule)
    setForm({
      category: rule.category ?? '',
      title: rule.title,
      description: rule.description ?? '',
      ai_instruction: rule.ai_instruction,
      priority: rule.priority,
      is_active: rule.is_active,
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingRule(null)
    setError(null)
  }

  /* ─── toggle is_active inline ─── */
  async function handleToggle(rule: SafetyRule) {
    const updated = { ...rule, is_active: !rule.is_active }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))

    const res = await fetch(`/api/admin/safety-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (!res.ok) {
      // revert
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)))
    }
  }

  /* ─── save (create or update) ─── */
  async function handleSave() {
    setError(null)
    setSaving(true)

    try {
      const url = editingRule
        ? `/api/admin/safety-rules/${editingRule.id}`
        : '/api/admin/safety-rules'
      const method = editingRule ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category.trim() || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          ai_instruction: form.ai_instruction.trim(),
          priority: form.priority,
          is_active: form.is_active,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Bir hata oluştu.')
        return
      }

      if (editingRule) {
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? (json.rule as SafetyRule) : r))
        )
      } else {
        setRules((prev) =>
          [...prev, json.rule as SafetyRule].sort((a, b) => a.priority - b.priority)
        )
      }

      closeModal()
    } finally {
      setSaving(false)
    }
  }

  /* ─── delete ─── */
  async function handleDelete(rule: SafetyRule) {
    if (!confirm(`"${rule.title}" kuralını silmek istediğinizden emin misiniz?`)) return
    setDeletingId(rule.id)
    try {
      const res = await fetch(`/api/admin/safety-rules/${rule.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== rule.id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  /* ─── render ─── */

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Güvenlik Kuralları</h1>
          <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>{rules.length} kural tanımlanmış</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Yeni Kural Ekle
        </button>
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl p-4 text-sm"
        style={{
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.25)',
          color: '#fcd34d',
        }}
      >
        <span className="font-semibold">ℹ️ Önemli:</span> Bu kurallar{' '}
        <span className="font-semibold">TÜM oteller için geçerlidir.</span> AI her sohbete bu
        talimatları yükler. Kuralların sırası (Priority) AI&apos;ın öncelik sırasını belirler.
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={glassCard}>
        <table className="w-full">
          <thead>
            <tr
              style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Kategori
              </th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Başlık
              </th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Priority
              </th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Aktif
              </th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Aksiyon
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm" style={{ color: '#64748b' }}>
                  Henüz güvenlik kuralı eklenmemiş.{' '}
                  <button
                    onClick={openNewModal}
                    style={{ color: '#60a5fa' }}
                    className="hover:underline"
                  >
                    İlk kuralı ekle →
                  </button>
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="p-4">
                    {rule.category ? (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium font-mono"
                        style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}
                      >
                        {rule.category}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#475569' }}>—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-sm" style={{ color: '#f1f5f9' }}>{rule.title}</div>
                    {rule.description && (
                      <div className="text-xs mt-0.5 max-w-xs truncate" style={{ color: '#64748b' }}>
                        {rule.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className="text-sm font-mono px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
                    >
                      {rule.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        rule.is_active ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                      aria-label={rule.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() => openEditModal(rule)}
                        style={{ color: '#60a5fa' }}
                        className="font-medium hover:opacity-80 transition-opacity"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        disabled={deletingId === rule.id}
                        style={{ color: '#f87171' }}
                        className="font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
                      >
                        {deletingId === rule.id ? 'Siliniyor…' : 'Sil'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div
            className="rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{
              background: 'rgba(15,23,42,0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {/* Modal Header */}
            <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="text-xl font-bold" style={{ color: '#f8fafc' }}>
                {editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Ekle'}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                {editingRule
                  ? 'Kural bilgilerini güncelleyin.'
                  : 'Yeni bir güvenlik kuralı tanımlayın.'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div
                  className="text-sm rounded-lg p-3"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                >
                  {error}
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
                  Kategori{' '}
                  <span className="font-normal" style={{ color: '#64748b' }}>(benzersiz, opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="örn: profanity, illegal_request"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
                  Başlık <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="örn: Küfür ve Hakaret Engeli"
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
                  Açıklama <span className="font-normal" style={{ color: '#64748b' }}>(opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Kısa açıklama"
                  style={inputStyle}
                />
              </div>

              {/* AI Instruction */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
                  AI Talimatı <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.ai_instruction}
                  onChange={(e) => setForm((f) => ({ ...f, ai_instruction: e.target.value }))}
                  rows={4}
                  placeholder="AI'a verilecek talimat."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Priority + is_active row */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
                    Priority{' '}
                    <span className="font-normal" style={{ color: '#64748b' }}>(0 = en yüksek, 100 = en düşük)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: Number(e.target.value) }))
                    }
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
                <div className="pt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      form.is_active ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>
                    {form.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', background: 'rgba(255,255,255,0.06)' }}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.ai_instruction.trim()}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {saving ? 'Kaydediliyor…' : editingRule ? 'Güncelle' : 'Kural Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
