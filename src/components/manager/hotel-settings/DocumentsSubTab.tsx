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

type DeliveryPolicy = 'manual' | 'auto_file' | 'auto_text';

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
  const [deliveryPolicy, setDeliveryPolicy] = useState<DeliveryPolicy>('manual');
  const [displayText, setDisplayText] = useState('');

  type IbanAccount = {
    account_holder: string;
    bank_name: string;
    branch: string;
    iban: string;
    currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
    swift: string;
  };

  const EMPTY_IBAN_ACCOUNT: IbanAccount = {
    account_holder: '',
    bank_name: '',
    branch: '',
    iban: '',
    currency: 'TRY',
    swift: '',
  };

  const [ibanAccounts, setIbanAccounts] = useState<IbanAccount[]>([EMPTY_IBAN_ACCOUNT]);

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
    structured_data: unknown | null;
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
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const isEditMode = editingDocId !== null;
  // Edit modunda dosya zorunlu değil; create modunda auto_text harici zorunlu
  const fileRequired = !isEditMode && deliveryPolicy !== 'auto_text';

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

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
    manual: 'Manuel',
    auto_file: 'Dosya Gönder',
    auto_text: 'Yazılı Cevap',
  };

  function resetForm() {
    setFile(null);
    setDocumentType('concept');
    setLanguage('tr');
    setDepartment('');
    setDeliveryPolicy('manual');
    setDisplayText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIbanAccounts([EMPTY_IBAN_ACCOUNT]);
    setEditingDocId(null);
  }

  function handleEditClick(doc: DocumentRow) {
    setEditingDocId(doc.id);
    setDocumentType(doc.document_type as DocumentType);
    setLanguage(doc.language as Language);
    setDepartment((doc.department_code ?? '') as Department | '');
    // DB'de eski kayıtlar 'manual_only' olabilir → 'manual'e normalize et
    const normalizedPolicy = doc.delivery_policy === 'manual_only' ? 'manual' : doc.delivery_policy;
    setDeliveryPolicy(normalizedPolicy as DeliveryPolicy);
    setDisplayText(doc.display_text ?? '');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // IBAN structured_data varsa mevcut hesapları geri yükle
    if (
      doc.document_type === 'iban' &&
      doc.structured_data !== null &&
      typeof doc.structured_data === 'object' &&
      'accounts' in (doc.structured_data as object)
    ) {
      const sd = doc.structured_data as { type: string; accounts: IbanAccount[] };
      setIbanAccounts(sd.accounts.length > 0 ? sd.accounts : [{ ...EMPTY_IBAN_ACCOUNT }]);
    } else {
      setIbanAccounts([{ ...EMPTY_IBAN_ACCOUNT }]);
    }

    clearMessages();
    // Formun görünür olduğu üst kısma scroll
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  /** Aşama 1+2: Presign al → PUT ile Supabase'e yükle → path döndür */
  async function uploadFileToStorage(
    f: File,
  ): Promise<{ file_url: string; file_name: string; file_size_bytes: number; file_mime: string }> {
    // 1) Presign URL al
    const presignRes = await fetch('/api/manager/documents/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: f.name, fileMime: f.type, fileSize: f.size }),
    });
    if (!presignRes.ok) {
      const d = await presignRes.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? 'Signed URL alınamadı');
    }
    const presignJson = await presignRes.json() as {
      signedUrl: string;
      token: string;
      path: string;
      bucket: string;
    };
    const { signedUrl, token, path: storagePath } = presignJson;

    // 2) Supabase signed upload URL'ye PUT
    const putRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': f.type,
        Authorization: `Bearer ${token}`,
      },
      body: f,
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      throw new Error(`Dosya yükleme hatası (${putRes.status}): ${text.substring(0, 120)}`);
    }

    return {
      file_url: storagePath,
      file_name: f.name,
      file_size_bytes: f.size,
      file_mime: f.type,
    };
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    const isIbanStructured = documentType === 'iban' && deliveryPolicy === 'auto_text';

    if (fileRequired && !file) {
      setError('Dosya zorunludur (yazılı cevap modu hariç).');
      return;
    }

    if (isIbanStructured) {
      const hasValid = ibanAccounts.some(
        (acc) => acc.iban.trim() && acc.bank_name.trim() && acc.account_holder.trim(),
      );
      if (!hasValid) {
        setError('En az bir hesap için Banka, IBAN ve Hesap Sahibi alanları zorunlu.');
        return;
      }
    } else if (deliveryPolicy === 'auto_text' && displayText.trim().length === 0) {
      setError('Yazılı cevap modu için metin girilmelidir.');
      return;
    }

    setIsSubmitting(true);
    try {
      // --- Aşama 1+2: Dosya varsa Storage'a yükle ---
      let fileFields: {
        file_url?: string;
        file_name?: string;
        file_size_bytes?: number;
        file_mime?: string;
      } = {};

      if (file) {
        const uploaded = await uploadFileToStorage(file);
        fileFields = {
          file_url: uploaded.file_url,
          file_name: uploaded.file_name,
          file_size_bytes: uploaded.file_size_bytes,
          file_mime: uploaded.file_mime,
        };
      }

      // --- display_text hesapla ---
      let computedDisplayText: string | undefined;
      let computedStructuredData: unknown;

      if (isIbanStructured) {
        const validAccounts = ibanAccounts.filter(
          (acc) => acc.iban.trim() && acc.bank_name.trim(),
        );
        computedStructuredData = { type: 'iban', accounts: validAccounts };
        computedDisplayText = validAccounts
          .map((acc) =>
            `${acc.currency} Hesap:\nHesap Sahibi: ${acc.account_holder}\n` +
            `Banka: ${acc.bank_name}\n` +
            (acc.branch ? `Sube: ${acc.branch}\n` : '') +
            `IBAN: ${acc.iban}\n` +
            (acc.swift ? `SWIFT: ${acc.swift}\n` : '')
          )
          .join('\n---\n');
      } else if (deliveryPolicy === 'auto_text') {
        computedDisplayText = displayText;
      }

      // --- Aşama 3: JSON metadata POST / PATCH ---
      const jsonBody = {
        document_type: documentType,
        language,
        department_code: department || undefined,
        delivery_policy: deliveryPolicy,
        display_text: computedDisplayText,
        structured_data: computedStructuredData,
        ...fileFields,
      };

      const url = isEditMode
        ? `/api/manager/documents/${editingDocId}`
        : '/api/manager/documents';
      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (isEditMode ? 'Güncelleme başarısız' : 'Yükleme başarısız'));

      setSuccess(isEditMode ? 'Belge başarıyla güncellendi.' : 'Belge başarıyla yüklendi.');
      setTimeout(() => setSuccess(null), 4000);
      await fetchDocuments();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-card form-card--wide documents-subtab" ref={formRef}>
      <h2 className="subtab-title">
        {isEditMode ? '✏️ Belgeyi Düzenle' : 'Belgeler'}
      </h2>
      <p className="subtab-description">
        {isEditMode
          ? 'Belge bilgilerini güncelleyin. Dosya yüklemezseniz mevcut dosya korunur.'
          : 'Otel belgelerini yükle ve misafire iletim politikasını belirle.'}
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
            {isEditMode && (
              <span className="dropzone-hint" style={{ color: 'var(--color-warning, #f59e0b)', marginTop: '4px' }}>
                Mevcut dosya korunur. Yeni dosya yüklerseniz eskisi silinir.
              </span>
            )}
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
            onChange={(e) => { setDocumentType(e.target.value as DocumentType); clearMessages(); }}
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
            onChange={(e) => { setLanguage(e.target.value as Language); clearMessages(); }}
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
            onChange={(e) => { setDepartment(e.target.value as Department | ''); clearMessages(); }}
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
          <label className={`policy-option ${deliveryPolicy === 'manual' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="delivery_policy"
              value="manual"
              checked={deliveryPolicy === 'manual'}
              onChange={() => { setDeliveryPolicy('manual'); clearMessages(); }}
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
              onChange={() => { setDeliveryPolicy('auto_file'); clearMessages(); }}
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
              onChange={() => { setDeliveryPolicy('auto_text'); clearMessages(); }}
            />
            <div>
              <strong>Yazılı Cevap</strong>
              <span>Aşağıdaki metni yazıyla gönderir (dosya opsiyonel).</span>
            </div>
          </label>
        </div>

        {deliveryPolicy === 'auto_text' && documentType === 'iban' && (
          <div className="iban-form-section">
            <label>IBAN Hesapları *</label>
            <p className="form-hint">Her döviz cinsi için ayrı hesap ekleyin. Birden fazla hesap eklenebilir.</p>

            {ibanAccounts.map((acc, idx) => (
              <div key={idx} className="iban-account-card">
                <div className="iban-account-header">
                  <strong>Hesap {idx + 1}</strong>
                  {ibanAccounts.length > 1 && (
                    <button
                      type="button"
                      className="btn-text-link"
                      onClick={() => setIbanAccounts(prev => prev.filter((_, i) => i !== idx))}
                    >
                      Kaldır
                    </button>
                  )}
                </div>
                <div className="iban-grid">
                  <div className="form-field">
                    <label>Hesap Sahibi *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={acc.account_holder}
                      placeholder="Demo Hotel Turizm A.Ş."
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], account_holder: e.target.value };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Banka *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={acc.bank_name}
                      placeholder="Ziraat Bankası"
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], bank_name: e.target.value };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Şube</label>
                    <input
                      type="text"
                      className="form-input"
                      value={acc.branch}
                      placeholder="Antalya Lara Şubesi"
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], branch: e.target.value };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Para Birimi *</label>
                    <select
                      className="form-select"
                      value={acc.currency}
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], currency: e.target.value as IbanAccount['currency'] };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    >
                      <option value="TRY">TRY (Türk Lirası)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="USD">USD (Dolar)</option>
                      <option value="GBP">GBP (Sterlin)</option>
                    </select>
                  </div>
                  <div className="form-field form-field-full">
                    <label>IBAN *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={acc.iban}
                      placeholder="TR12 0001 0012 3456 7890 1234 56"
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], iban: e.target.value };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>SWIFT / BIC (opsiyonel)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={acc.swift}
                      placeholder="TCZBTR2A"
                      onChange={(e) => {
                        const next = [...ibanAccounts];
                        next[idx] = { ...next[idx], swift: e.target.value };
                        setIbanAccounts(next);
                        clearMessages();
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIbanAccounts(prev => [...prev, { ...EMPTY_IBAN_ACCOUNT }])}
            >
              + Başka Hesap Ekle
            </button>
          </div>
        )}

        {deliveryPolicy === 'auto_text' && documentType !== 'iban' && (
          <div className="form-field" style={{ marginTop: '1rem' }}>
            <label>Gönderilecek Metin *</label>
            <textarea
              className="form-textarea"
              rows={5}
              value={displayText}
              onChange={(e) => { setDisplayText(e.target.value); clearMessages(); }}
              placeholder="Misafire gönderilecek hazır metin..."
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
          {isSubmitting
            ? (file ? 'Dosya yükleniyor...' : (isEditMode ? 'Güncelleniyor...' : 'Yükleniyor...'))
            : (isEditMode ? 'Belgeyi Güncelle' : 'Belgeyi Yükle')}
        </button>
        {isEditMode && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { resetForm(); clearMessages(); }}
            disabled={isSubmitting}
            style={{ marginLeft: '0.75rem' }}
          >
            İptal
          </button>
        )}
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleEditClick(doc)}
                    disabled={!!deletingId}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    ✏️ Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? 'Siliniyor...' : '🗑️ Sil'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

}
