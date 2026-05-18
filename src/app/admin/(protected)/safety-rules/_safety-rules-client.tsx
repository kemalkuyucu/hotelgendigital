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
          <h1 className="text-3xl font-bold text-gray-900">Güvenlik Kuralları</h1>
          <p className="text-gray-500 mt-1 text-sm">{rules.length} kural tanımlanmış</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Yeni Kural Ekle
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <span className="font-semibold">ℹ️ Önemli:</span> Bu kurallar{' '}
        <span className="font-semibold">TÜM oteller için geçerlidir.</span> AI her sohbete bu
        talimatları yükler. Kuralların sırası (Priority) AI'ın öncelik sırasını belirler.
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kategori
              </th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Başlık
              </th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Aktif
              </th>
              <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Aksiyon
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">
                  Henüz güvenlik kuralı eklenmemiş.{' '}
                  <button
                    onClick={openNewModal}
                    className="text-blue-600 hover:underline"
                  >
                    İlk kuralı ekle →
                  </button>
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    {rule.category ? (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium font-mono">
                        {rule.category}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900 text-sm">{rule.title}</div>
                    {rule.description && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">
                        {rule.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {rule.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        rule.is_active ? 'bg-green-500' : 'bg-gray-300'
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
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        disabled={deletingId === rule.id}
                        className="text-red-500 hover:text-red-600 font-medium disabled:opacity-40"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Ekle'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingRule
                  ? 'Kural bilgilerini güncelleyin.'
                  : 'Yeni bir güvenlik kuralı tanımlayın.'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Kategori{' '}
                  <span className="font-normal text-gray-400">(benzersiz, opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="örn: profanity, illegal_request"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Başlık <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="örn: Küfür ve Hakaret Engeli"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Açıklama <span className="font-normal text-gray-400">(opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Kısa açıklama"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* AI Instruction */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  AI Talimatı <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.ai_instruction}
                  onChange={(e) => setForm((f) => ({ ...f, ai_instruction: e.target.value }))}
                  rows={4}
                  placeholder="AI'a verilecek talimat. Örn: Kullanıcı hakaret veya küfür içeren mesaj gönderirse kibarca uyar ve konuyu değiştir."
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              {/* Priority + is_active row */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Priority{' '}
                    <span className="font-normal text-gray-400">(0 = en yüksek, 100 = en düşük)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: Number(e.target.value) }))
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div className="pt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      form.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600 font-medium">
                    {form.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
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
