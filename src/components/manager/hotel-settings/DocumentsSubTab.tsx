'use client';

import { useState, useRef, useEffect, useCallback, ChangeEvent, DragEvent } from 'react';

type DocumentType =
  | 'concept' | 'fact_sheet' | 'price_list' | 'day_use' | 'map' | 'iban'
  | 'bar_menu' | 'room_service_menu' | 'spa_services' | 'a_la_carte'
  | 'wifi_info' | 'dnd_list' | 'agency_list' | 'general_rules'
  | 'taxi_info' | 'parking_info' | 'other';

type Language = 'tr' | 'en' | 'ru' | 'de' | 'fr' | 'ar' | 'ja';

type Department =
  | 'front_office' | 'housekeeping' | 'technical' | 'fb'
  | 'guest_relation' | 'spa' | 'animation';

type DeliveryPolicy = 'manual_only' | 'auto_file' | 'auto_text';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  concept: 'Konsept',
  fact_sheet: 'Fact Sheet',
  price_list: 'Fiyat Listesi',
  day_use: 'Day Use',
  map: 'Harita',
  iban: 'IBAN Bilgisi',
  bar_menu: 'Bar Menüsü',
  room_service_menu: 'Oda Servisi Menüsü',
  spa_services: 'SPA Hizmetleri',
  a_la_carte: 'A La Carte Menü',
  wifi_info: 'WiFi Bilgisi',
  dnd_list: 'Rahatsız Etmeyin Listesi',
  agency_list: 'Acente Listesi',
  general_rules: 'Genel Kurallar',
  taxi_info: 'Taksi Bilgisi',
  parking_info: 'Otopark Bilgisi',
  other: 'Diğer',
};

const LANGUAGE_LABELS: Record<Language, string> = {
  tr: 'Türkçe', en: 'İngilizce', ru: 'Rusça', de: 'Almanca',
  fr: 'Fransızca', ar: 'Arapça', ja: 'Japonca',
};

const DEPARTMENT_LABELS: Record<Department, string> = {
  front_office: 'Önbüro',
  housekeeping: 'Kat Hizmetleri',
  technical: 'Teknik Servis',
  fb: 'F&B',
  guest_relation: 'Misafir İlişkileri',
  spa: 'SPA',
  animation: 'Animasyon',
};

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

export default function DocumentsSubTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('concept');
  const [language, setLanguage] = useState<Language>('tr');
  const [department, setDepartment] = useState<Department | ''>('');
  const [deliveryPolicy, setDeliveryPolicy] = useState<DeliveryPolicy>('manual_only');
  const [displayText, setDisplayText] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type DocumentRow = {
    id: string;
    document_type: string;
    language: string;
    department_code: string | null;
    delivery_policy: string;
    display_text: string | null;
    file_url: string | null;
    file_name: string | null;
    file_size_bytes: number | null;
    mime_type: string | null;
    is_active: boolean;
    uploaded_at: string;
  };

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileRequired = deliveryPolicy !== 'auto_text';

  function validateFile(f: File): string | null {
    if (f.size > MAX_SIZE) return 'Dosya 10 MB sınırını aşıyor.';
    if (!ALLOWED_MIME.includes(f.type)) return 'Geçersiz dosya türü (PDF/JPG/PNG/WEBP).';
    return null;
  }

  function handleFileSelect(f: File | null) {
    setError(null);
    setSuccess(null);
    if (!f) { setFile(null); return; }
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFileSelect(e.target.files?.[0] ?? null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  const fetchDocuments = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/manager/documents');
      const data = await res.json();
      if (res.ok) setDocuments(data.documents ?? []);
    } catch {
      // sessiz geç
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleDelete(id: string) {
    if (!confirm('Bu belgeyi silmek istediğine emin misin?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/manager/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Silme hatası: ${data.error ?? 'Bilinmeyen hata'}`);
        return;
      }
      setDocuments(docs => docs.filter(d => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  const POLICY_LABELS: Record<string, string> = {
    manual_only: 'Manuel',
    auto_file: 'Dosya Gönder',
    auto_text: 'Yazılı Cevap',
  };

  function resetForm() {
    setFile(null);
    setDocumentType('concept');
    setLanguage('tr');
    setDepartment('');
    setDeliveryPolicy('manual_only');
    setDisplayText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (fileRequired && !file) {
      setError('Dosya zorunludur (yazılı cevap modu hariç).');
      return;
    }
    if (deliveryPolicy === 'auto_text' && displayText.trim().length === 0) {
      setError('Yazılı cevap modu için metin girilmelidir.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('language', language);
      if (department) formData.append('department_code', department);
      formData.append('delivery_policy', deliveryPolicy);
      if (deliveryPolicy === 'auto_text') formData.append('display_text', displayText);

      const res = await fetch('/api/manager/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Yükleme başarısız');

      setSuccess('Belge başarıyla yüklendi.');
      await fetchDocuments();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-card form-card--wide documents-subtab">
      <h2 className="subtab-title">Belgeler</h2>
      <p className="subtab-description">
        Otel belgelerini yükle ve misafire iletim politikasını belirle.
      </p>

      {/* Drag & Drop */}
      <div
        className={`document-dropzone ${isDragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={onFileInputChange}
          style={{ display: 'none' }}
        />
        {file ? (
          <div className="dropzone-file">
            <strong>{file.name}</strong>
            <span>{(file.size / 1024).toFixed(1)} KB · {file.type}</span>
            <button
              type="button"
              className="btn-text-link"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              Kaldır
            </button>
          </div>
        ) : (
          <div className="dropzone-empty">
            <span className="dropzone-icon">📄</span>
            <strong>Dosyayı buraya sürükle veya tıkla</strong>
            <span className="dropzone-hint">PDF, JPG, PNG, WEBP · Max 10 MB</span>
          </div>
        )}
      </div>

      {/* Form alanları */}
      <div className="document-form-grid">
        <div className="form-field">
          <label>Belge Türü *</label>
          <select
            className="form-select"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          >
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Dil *</label>
          <select
            className="form-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Departman (opsiyonel)</label>
          <select
            className="form-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value as Department | '')}
          >
            <option value="">Belirtilmemiş</option>
            {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* İletim Politikası */}
      <div className="delivery-policy-section">
        <h3>Misafire İletim Politikası</h3>
        <p className="policy-hint">Bu belge sorulduğunda sistem nasıl davransın?</p>

        <div className="policy-options">
          <label className={`policy-option ${deliveryPolicy === 'manual_only' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="delivery_policy"
              value="manual_only"
              checked={deliveryPolicy === 'manual_only'}
              onChange={() => setDeliveryPolicy('manual_only')}
            />
            <div>
              <strong>Manuel</strong>
              <span>Sistem göndermez, &quot;Önbüroya başvurun&quot; der.</span>
            </div>
          </label>

          <label className={`policy-option ${deliveryPolicy === 'auto_file' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="delivery_policy"
              value="auto_file"
              checked={deliveryPolicy === 'auto_file'}
              onChange={() => setDeliveryPolicy('auto_file')}
            />
            <div>
              <strong>Dosya Gönder</strong>
              <span>PDF veya görseli otomatik iletir.</span>
            </div>
          </label>

          <label className={`policy-option ${deliveryPolicy === 'auto_text' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="delivery_policy"
              value="auto_text"
              checked={deliveryPolicy === 'auto_text'}
              onChange={() => setDeliveryPolicy('auto_text')}
            />
            <div>
              <strong>Yazılı Cevap</strong>
              <span>Aşağıdaki metni yazıyla gönderir (dosya opsiyonel).</span>
            </div>
          </label>
        </div>

        {deliveryPolicy === 'auto_text' && (
          <div className="form-field" style={{ marginTop: '1rem' }}>
            <label>Gönderilecek Metin *</label>
            <textarea
              className="form-textarea"
              rows={5}
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder={'Örnek:\nBanka: Ziraat Bankası\nIBAN: TR12 3456 ...\nHesap Sahibi: ABC Otel'}
            />
          </div>
        )}
      </div>

      {/* Hata / Başarı */}
      {error && <div className="form-message form-message-error">{error}</div>}
      {success && <div className="form-message form-message-success">{success}</div>}

      {/* Submit */}
      <div className="form-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Yükleniyor...' : 'Belgeyi Yükle'}
        </button>
      </div>

      {/* Yüklenmiş Belgeler Listesi */}
      <div className="documents-list-section">
        <h3>Yüklenmiş Belgeler ({documents.length})</h3>

        {isLoadingList ? (
          <p className="list-empty-message">Yükleniyor...</p>
        ) : documents.length === 0 ? (
          <p className="list-empty-message">Henüz belge yüklenmemiş.</p>
        ) : (
          <div className="documents-table">
            {documents.map(doc => (
              <div key={doc.id} className="document-row">
                <div className="document-row-main">
                  <div className="document-row-title">
                    <strong>{DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.document_type}</strong>
                    <span className="document-badge">{LANGUAGE_LABELS[doc.language as Language] ?? doc.language}</span>
                    {doc.department_code && (
                      <span className="document-badge">{DEPARTMENT_LABELS[doc.department_code as Department] ?? doc.department_code}</span>
                    )}
                    <span className={`document-badge policy-${doc.delivery_policy}`}>
                      {POLICY_LABELS[doc.delivery_policy] ?? doc.delivery_policy}
                    </span>
                  </div>
                  <div className="document-row-meta">
                    {doc.file_name && <span>{doc.file_name} · {formatBytes(doc.file_size_bytes)}</span>}
                    {!doc.file_name && doc.delivery_policy === 'auto_text' && (
                      <span className="document-text-preview">{doc.display_text?.substring(0, 80)}...</span>
                    )}
                    <span>{formatDate(doc.uploaded_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? 'Siliniyor...' : '🗑️ Sil'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

}
