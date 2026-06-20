'use client'

import { useState, useRef, useCallback } from 'react'
import type { KnowledgeDocument, DocumentType } from '@/lib/documents/document-client'
import type { DepartmentKey } from '@/lib/hotel-admin/types'

interface Props {
  slug: string
  department: DepartmentKey
  departmentLabel: string
  initialDocuments: KnowledgeDocument[]
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  fact_sheet: 'Fact Sheet',
  concept: 'Konsept',
  price_list: 'Fiyat Listesi',
  menu: 'Menü',
  reservation: 'Rezervasyon',
  allergen: 'Alerjen',
  schedule: 'Program',
  custom: 'Özel',
}

const DOCUMENT_TYPES: DocumentType[] = [
  'fact_sheet', 'concept', 'price_list', 'menu',
  'reservation', 'allergen', 'schedule', 'custom',
]

function StatusBadge({ status }: { status: KnowledgeDocument['parse_status'] }) {
  const map: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    pending:    { label: 'Bekliyor',    bg: 'rgba(251,191,36,0.12)',  color: '#d97706', icon: '⏳' },
    processing: { label: 'İşleniyor',  bg: 'rgba(99,102,241,0.12)', color: '#6366f1', icon: '⚙️' },
    completed:  { label: 'İşlendi',    bg: 'rgba(16,185,129,0.12)', color: '#059669', icon: '✅' },
    failed:     { label: 'Başarısız',  bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', icon: '❌' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
    }}>
      {s.icon} {s.label}
    </span>
  )
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DocumentsPageClient({ slug, department, departmentLabel, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(initialDocuments)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState<DocumentType>('custom')
  const [uploadNotes, setUploadNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/hotel-admin/documents?department=${department}`)
    if (res.ok) {
      const data = await res.json() as { documents: KnowledgeDocument[] }
      setDocuments(data.documents)
    }
  }, [department])

  // Upload + process
  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) return
    setUploading(true)
    setUploadProgress(30)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', uploadTitle.trim())
      formData.append('document_type', uploadType)
      formData.append('department', department)
      if (uploadNotes.trim()) formData.append('notes', uploadNotes.trim())

      const uploadRes = await fetch('/api/hotel-admin/documents', { method: 'POST', body: formData })
      setUploadProgress(60)

      const uploadData = await uploadRes.json() as { document_id?: string; error?: string }
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Yükleme hatası')

      const docId = uploadData.document_id!
      setUploadProgress(80)
      setShowModal(false)
      resetForm()
      showToast('Belge yüklendi, AI işliyor…')
      await fetchDocuments()

      // Async process tetikle
      setProcessingIds((prev) => new Set(prev).add(docId))
      const processRes = await fetch(`/api/hotel-admin/documents/${docId}/process`, { method: 'POST' })
      const processData = await processRes.json() as { ok?: boolean; sections_created?: number; error?: string }
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(docId); return s })

      if (processRes.ok && processData.ok) {
        showToast(`✅ ${processData.sections_created ?? 0} section oluşturuldu, KB güncellendi.`)
      } else {
        showToast(`⚠️ Parse hatası: ${processData.error ?? 'Bilinmeyen'}`, 'error')
      }
      await fetchDocuments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hata oluştu'
      showToast(msg, 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!confirm(`"${doc.title}" silinsin mi? İlgili KB section'ları da pasif olacak.`)) return
    try {
      const res = await fetch(`/api/hotel-admin/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Silme hatası')
      }
      showToast('Belge silindi.')
      await fetchDocuments()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata', 'error')
    }
  }

  const handleReparse = async (docId: string) => {
    setProcessingIds((prev) => new Set(prev).add(docId))
    try {
      const res = await fetch(`/api/hotel-admin/documents/${docId}/reparse`, { method: 'POST' })
      const data = await res.json() as { ok?: boolean; sections_created?: number; error?: string }
      if (res.ok && data.ok) {
        showToast(`✅ Yeniden parse edildi, ${data.sections_created ?? 0} section.`)
      } else {
        showToast(`⚠️ Reparse hatası: ${data.error ?? 'Bilinmeyen'}`, 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata', 'error')
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(docId); return s })
      await fetchDocuments()
    }
  }

  const resetForm = () => {
    setUploadTitle('')
    setUploadType('custom')
    setUploadNotes('')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeCount = documents.filter((d) => d.is_active).length
  const completedCount = documents.filter((d) => d.is_active && d.parse_status === 'completed').length

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '1000px' }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: toast.type === 'success' ? '#059669' : '#dc2626',
            color: '#fff', padding: '14px 20px', borderRadius: '12px',
            fontSize: '14px', fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            maxWidth: '360px',
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
              {departmentLabel} · Belgeler
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
              {activeCount} aktif belge · {completedCount} KB&apos;e işlendi
            </p>
          </div>
          <button
            id="upload-document-btn"
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', padding: '12px 20px',
              borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
              transition: 'opacity 0.2s',
            }}
          >
            📤 Yeni Belge Yükle
          </button>
        </div>

        {/* Table */}
        {documents.length === 0 ? (
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px',
            padding: '64px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📂</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#94a3b8', margin: '0 0 8px' }}>
              Henüz belge yüklenmedi
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0 }}>
              &ldquo;Yeni Belge Yükle&rdquo; butonuyla PDF, Excel veya Word belgesi ekleyin.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Başlık', 'Tip', 'Dosya', 'Boyut', 'Yüklenme', 'Durum', 'İşlemler'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      color: '#64748b', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, idx) => {
                  const isProcessing = processingIds.has(doc.id)
                  const effectiveStatus = isProcessing ? 'processing' : doc.parse_status
                  const isInactive = !doc.is_active
                  return (
                    <tr key={doc.id} style={{
                      borderBottom: idx < documents.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: isInactive ? '#fafafa' : undefined,
                      opacity: isInactive ? 0.6 : 1,
                    }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {doc.title}
                        {!doc.is_active && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Pasif · v{doc.version}
                          </span>
                        )}
                        {doc.is_active && doc.version > 1 && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#6366f1', marginTop: '2px' }}>
                            v{doc.version}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {doc.file_name}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>
                        {formatBytes(doc.file_size_bytes)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(doc.uploaded_at)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={effectiveStatus} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {doc.is_active && doc.parse_status === 'failed' && !isProcessing && (
                            <button
                              onClick={() => handleReparse(doc.id)}
                              title="Yeniden dene"
                              style={{
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                color: '#6366f1', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600,
                              }}
                            >
                              🔄 Yeniden
                            </button>
                          )}
                          {doc.is_active && !isProcessing && (
                            <button
                              onClick={() => handleDelete(doc)}
                              title="Sil"
                              style={{
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                color: '#dc2626', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600,
                              }}
                            >
                              🗑️ Sil
                            </button>
                          )}
                          {isProcessing && (
                            <span style={{ color: '#6366f1', fontSize: '12px', fontWeight: 600 }}>⚙️ İşleniyor…</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !uploading) { setShowModal(false); resetForm() } }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '480px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 24px' }}>
              📤 Yeni Belge Yükle
            </h2>

            {/* Title */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Başlık <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="doc-title-input"
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="ör. SPA Hizmet Fiyat Listesi 2026"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Belge Tipi <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="doc-type-select"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as DocumentType)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
                  background: '#fff', boxSizing: 'border-box',
                }}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* File */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Dosya <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div
                style={{
                  border: '2px dashed #d1d5db', borderRadius: '10px', padding: '20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                  background: selectedFile ? 'rgba(99,102,241,0.04)' : undefined,
                  borderColor: selectedFile ? '#6366f1' : undefined,
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx,.doc"
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile ? (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📄</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{formatBytes(selectedFile.size)}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '4px', opacity: 0.4 }}>📁</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Tıkla veya dosya seç</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>PDF, Excel, Word · max 25 MB</div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Notlar (isteğe bağlı)
              </label>
              <textarea
                id="doc-notes-input"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Ek açıklama…"
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Progress bar */}
            {uploading && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    borderRadius: '999px', transition: 'width 0.4s ease',
                  }} />
                </div>
                <p style={{ fontSize: '12px', color: '#6366f1', marginTop: '6px', textAlign: 'center' }}>
                  Yükleniyor, lütfen bekleyin…
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                disabled={uploading}
                style={{
                  padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', fontSize: '14px', fontWeight: 500,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                İptal
              </button>
              <button
                id="confirm-upload-btn"
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !uploadTitle.trim()}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none',
                  background: uploading || !selectedFile || !uploadTitle.trim()
                    ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: uploading || !selectedFile || !uploadTitle.trim() ? '#94a3b8' : '#fff',
                  fontSize: '14px', fontWeight: 600,
                  cursor: uploading || !selectedFile || !uploadTitle.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? '⚙️ Yükleniyor…' : '📤 Yükle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
