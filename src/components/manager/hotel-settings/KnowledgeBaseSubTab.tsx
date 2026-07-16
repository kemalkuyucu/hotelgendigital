'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Toast, { ToastItem, useToast } from '../Toast';
import { EditIcon, DeleteIcon, PlusIcon } from '../icons';
import {
  ConceptType,
  PriorityTier,
  FactCategory,
  FactTemplate,
  getTemplatesForConcept,
} from '@/data/factTemplates';
import { categoryLabel } from '@/lib/knowledge/format-category';
import { normalizeTr } from '@/lib/utils/normalize-tr';

// (MeetingRoomsCard taşındı → MeetingRoomsSubTab.tsx)

interface HotelFact {
  id: string;
  fact_key: string;
  fact_label: string;
  fact_value: string;
  category: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

type MergedFactStatus = 'filled' | 'empty' | 'inactive' | 'custom';
type FilterStatus = 'all' | 'empty' | 'filled' | 'inactive';

interface MergedFact {
  status: MergedFactStatus;
  fact_key: string;
  fact_label: string;
  fact_value: string | null;
  category: string;
  tier: PriorityTier | null;
  is_active: boolean;
  placeholder?: string;
  hint?: string;
  display_order: number;
  db_id: string | null;
  applies_to_concepts: ConceptType[] | 'all' | null;
}

interface ProgressStats {
  critical:    { filled: number; total: number };
  recommended: { filled: number; total: number };
  detailed:    { filled: number; total: number };
  total:       { filled: number; total: number };
}

interface FormState {
  fact_label: string;
  fact_key: string;
  fact_value: string;
  category: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { fact_label: '', fact_key: '', fact_value: '', category: 'general', is_active: true };

const CATEGORY_LABELS: Record<FactCategory, string> = {
  general:            'Genel',
  food_beverage:      'Yiyecek-İçecek',
  pool_beach:         'Havuz & Plaj',
  spa_wellness:       'SPA & Wellness',
  activity_animation: 'Aktivite',
  rooms:              'Odalar',
  transport:          'Ulaşım',
  children:           'Çocuklar',
  policies:           'Politikalar',
  laundry_ironing:    'Çamaşır & Ütü',
};

const ALL_FACT_CATEGORIES: FactCategory[] = [
  'general','food_beverage','pool_beach','spa_wellness',
  'activity_animation','rooms','transport','children','policies','laundry_ironing',
];

const STATUS_CHIPS: { id: FilterStatus; label: string }[] = [
  { id: 'empty',    label: 'Doldurulması Gereken' },
  { id: 'filled',   label: 'Dolu' },
  { id: 'inactive', label: 'Yok Sayılan' },
  { id: 'all',      label: 'Tümü' },
];

const TIER_ORDER: Record<PriorityTier, number> = { critical: 0, recommended: 1, detailed: 2 };
const STATUS_ORDER: Record<MergedFactStatus, number> = { empty: 0, filled: 1, custom: 2, inactive: 3 };

const TIER_META: Record<PriorityTier, { emoji: string; label: string; cls: string; fill: string }> = {
  critical:    { emoji: '🔴', label: 'Kritik',    cls: 'critical',    fill: 'knowledge-progress-fill--critical' },
  recommended: { emoji: '🟡', label: 'Önerilen',  cls: 'recommended', fill: 'knowledge-progress-fill--recommended' },
  detailed:    { emoji: '🟢', label: 'Detaylı',   cls: 'detailed',    fill: 'knowledge-progress-fill--detailed' },
};

function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function mergeFactsWithTemplates(templates: FactTemplate[], dbFacts: HotelFact[]): MergedFact[] {
  const dbMap = new Map(dbFacts.map((f) => [f.fact_key, f]));
  const usedKeys = new Set<string>();
  const fromTemplates: MergedFact[] = templates.map((tmpl) => {
    const db = dbMap.get(tmpl.fact_key);
    usedKeys.add(tmpl.fact_key);
    if (db) {
      return {
        status: db.is_active ? 'filled' : 'inactive',
        fact_key: tmpl.fact_key, fact_label: tmpl.fact_label, fact_value: db.fact_value,
        category: tmpl.category, tier: tmpl.tier, is_active: db.is_active,
        placeholder: tmpl.placeholder, hint: tmpl.hint, display_order: tmpl.display_order,
        db_id: db.id, applies_to_concepts: tmpl.applies_to_concepts,
      };
    }
    return {
      status: 'empty', fact_key: tmpl.fact_key, fact_label: tmpl.fact_label, fact_value: null,
      category: tmpl.category, tier: tmpl.tier, is_active: true,
      placeholder: tmpl.placeholder, hint: tmpl.hint, display_order: tmpl.display_order,
      db_id: null, applies_to_concepts: tmpl.applies_to_concepts,
    };
  });
  const fromCustom: MergedFact[] = dbFacts
    .filter((f) => !usedKeys.has(f.fact_key))
    .map((f) => ({
      status: 'custom' as MergedFactStatus, fact_key: f.fact_key, fact_label: f.fact_label,
      fact_value: f.fact_value, category: f.category, tier: null, is_active: f.is_active,
      display_order: f.display_order, db_id: f.id, applies_to_concepts: null,
    }));
  return [...fromTemplates, ...fromCustom];
}

function computeProgress(merged: MergedFact[]): ProgressStats {
  const isFilled = (m: MergedFact) => m.status === 'filled' || m.status === 'inactive';
  const templateFacts = merged.filter((m) => m.tier !== null);
  const make = (tier: PriorityTier) => {
    const s = templateFacts.filter((m) => m.tier === tier);
    return { filled: s.filter(isFilled).length, total: s.length };
  };
  const critical = make('critical'), recommended = make('recommended'), detailed = make('detailed');
  return { critical, recommended, detailed, total: { filled: critical.filled+recommended.filled+detailed.filled, total: critical.total+recommended.total+detailed.total } };
}

function sortMerged(list: MergedFact[], filterStatus: FilterStatus): MergedFact[] {
  return [...list].sort((a, b) => {
    if (filterStatus === 'empty') {
      const ta = a.tier ? TIER_ORDER[a.tier] : 99;
      const tb = b.tier ? TIER_ORDER[b.tier] : 99;
      if (ta !== tb) return ta - tb;
      return a.display_order - b.display_order;
    }
    if (filterStatus === 'filled') {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.display_order - b.display_order;
    }
    // 'all' and 'inactive'
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sd !== 0) return sd;
    const ta = a.tier ? TIER_ORDER[a.tier] : 99;
    const tb = b.tier ? TIER_ORDER[b.tier] : 99;
    if (ta !== tb) return ta - tb;
    return a.display_order - b.display_order;
  });
}

function pct(filled: number, total: number) {
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

export default function KnowledgeBaseSubTab() {
  const [facts, setFacts] = useState<HotelFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('empty');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [search, setSearch] = useState(''); // client-side arama (debounce YOK — 134 kayit)
  const [panelMode, setPanelMode] = useState<'new' | 'fill' | 'edit' | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fillMf, setFillMf] = useState<MergedFact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmIgnoreMf, setConfirmIgnoreMf] = useState<MergedFact | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { addToast } = useToast(setToasts);
  const [conceptType, setConceptType] = useState<ConceptType>('all_inclusive');

  const factTemplates = useMemo<FactTemplate[]>(() => getTemplatesForConcept(conceptType), [conceptType]);
  const mergedFacts = useMemo<MergedFact[]>(() => mergeFactsWithTemplates(factTemplates, facts), [factTemplates, facts]);
  const progressStats = useMemo<ProgressStats>(() => computeProgress(mergedFacts), [mergedFacts]);

  // Kategori filtre chip'leri CANLI veriden turer — panelde gorunen kategoriler kadar.
  // ALL_FACT_CATEGORIES sirasini korur; sablonda olmayan (custom) kategoriler sona alfabetik.
  const availableCategories = useMemo<string[]>(() => {
    const seen = new Set(mergedFacts.map((m) => m.category));
    const known = new Set<string>(ALL_FACT_CATEGORIES);
    const ordered = ALL_FACT_CATEGORIES.filter((c) => seen.has(c));
    const extra = [...seen].filter((c) => !known.has(c)).sort();
    return [...ordered, ...extra];
  }, [mergedFacts]);

  // Form dropdown kategorileri: TUM sablon kategorileri + canli DB'de gecen ekstralar.
  // Ekstralar HAM `facts`'ten turer (mergedFacts DEGIL): mergeFactsWithTemplates template
  // fact'lerde db.category'yi tmpl.category ile MASKELER; ham facts, duzenlenen fact'in
  // MEVCUT db kategorisinin (edit'te form.category=dbFact.category) HER ZAMAN listede olmasini garanti eder.
  const dropdownCategories = useMemo<string[]>(() => {
    const known = new Set<string>(ALL_FACT_CATEGORIES);
    const extra = [...new Set(facts.map((f) => f.category))].filter((c) => !known.has(c)).sort();
    return [...ALL_FACT_CATEGORIES, ...extra];
  }, [facts]);

  const fetchFacts = useCallback(async () => {
    try {
      const res = await fetch('/api/manager/knowledge', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setFacts(json.facts ?? []);
      else addToast(json.error ?? 'Veriler getirilemedi', 'error');
    } catch { addToast('Sunucuya bağlanılamadı', 'error'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manager/hotel-settings', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json.settings?.concept_type) setConceptType(json.settings.concept_type as ConceptType);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { fetchFacts(); }, [fetchFacts]);

  // Panel (edit/fill/new) listenin ÜSTÜNDE render edildiği için, aşağıdaki bir karta
  // basıldığında panel görünür alana kaydırılır. Render'dan SONRA çalışmalı → useEffect.
  useEffect(() => {
    if (panelMode !== null) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [panelMode, editingId, fillMf]);

  // ── Search (client-side, UC alan: label/key/value; normalizeTr ile TR-toleransli) ──
  // Bos arama -> mergedFacts aynen doner. Paylasimli normalizeTr (src/lib/utils) kullanilir.
  const searchHits = useMemo<MergedFact[]>(() => {
    const q = normalizeTr(search.trim());
    if (!q) return mergedFacts;
    return mergedFacts.filter((m) =>
      normalizeTr(m.fact_label ?? '').includes(q) ||
      normalizeTr(m.fact_key ?? '').includes(q) ||
      normalizeTr(m.fact_value ?? '').includes(q)
    );
  }, [mergedFacts, search]);

  // ── Filtered + sorted list ──────────────────────────────────────────────────
  const filteredSorted = useMemo<MergedFact[]>(() => {
    let list = searchHits;
    // status filter
    if (filterStatus === 'empty')    list = list.filter((m) => m.status === 'empty');
    else if (filterStatus === 'filled') list = list.filter((m) => m.status === 'filled' || m.status === 'custom');
    else if (filterStatus === 'inactive') list = list.filter((m) => m.status === 'inactive');
    // category filter
    if (filterCategory) list = list.filter((m) => m.category === filterCategory);
    return sortMerged(list, filterStatus);
  }, [searchHits, filterStatus, filterCategory]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleLabelChange = (val: string) => {
    setForm((p) => { const n = { ...p, fact_label: val }; if (!keyManuallyEdited) n.fact_key = labelToKey(val); return n; });
    setFieldError(null);
  };
  const handleKeyChange = (val: string) => {
    setKeyManuallyEdited(true);
    setForm((p) => ({ ...p, fact_key: val.toLowerCase().replace(/[^a-z0-9_]/g, '') }));
    setFieldError(null);
  };
  const openNew = () => { setEditingId(null); setFillMf(null); setForm(EMPTY_FORM); setKeyManuallyEdited(false); setFieldError(null); setPanelMode('new'); };
  const openFill = (mf: MergedFact) => {
    setFillMf(mf); setEditingId(null);
    setForm({ fact_key: mf.fact_key, fact_label: mf.fact_label, fact_value: '', category: mf.category, is_active: true });
    setKeyManuallyEdited(true); setFieldError(null); setPanelMode('fill');
  };
  const openEdit = (mf: MergedFact) => {
    const dbFact = facts.find((f) => f.id === mf.db_id);
    if (!dbFact) {
      // SESSIZ RETURN YASAK: kullanici kaleme basiyor ama hicbir sey olmuyordu.
      console.error('[KnowledgeBase] openEdit: DB kaydi bulunamadi', { fact_key: mf.fact_key, db_id: mf.db_id });
      addToast('Bu kaydı düzenleyemedim, lütfen sayfayı yenileyip tekrar deneyin.', 'error');
      return;
    }
    setEditingId(dbFact.id); setFillMf(mf);
    setForm({ fact_label: dbFact.fact_label, fact_key: dbFact.fact_key, fact_value: dbFact.fact_value, category: dbFact.category, is_active: dbFact.is_active });
    setKeyManuallyEdited(true); setFieldError(null); setPanelMode('edit');
  };
  const closePanel = () => { setPanelMode(null); setEditingId(null); setFillMf(null); setFieldError(null); setForm(EMPTY_FORM); };
  const canSave = !saving && form.fact_label.trim().length > 0 && form.fact_value.trim().length > 0 && form.fact_key.trim().length > 0;
  const panelTitle = panelMode === 'edit' ? 'Bilgiyi Düzenle' : panelMode === 'fill' ? `${fillMf?.fact_label ?? ''} Doldur` : 'Yeni Bilgi Ekle';
  const isReadOnly = panelMode === 'fill';

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true); setFieldError(null);
    const payload = { fact_key: form.fact_key.trim(), fact_label: form.fact_label.trim(), fact_value: form.fact_value.trim(), category: form.category, is_active: form.is_active };
    try {
      const isEdit = panelMode === 'edit' && editingId;
      const url = isEdit ? `/api/manager/knowledge/${editingId}` : '/api/manager/knowledge';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { if (res.status === 409) setFieldError('Bu fact_key zaten kullanımda.'); else addToast(json.error ?? 'Bir hata oluştu', 'error'); return; }
      addToast(isEdit ? 'Bilgi güncellendi' : 'Yeni bilgi eklendi', 'success');
      closePanel(); await fetchFacts();
    } catch { addToast('Sunucuya bağlanılamadı', 'error'); }
    finally { setSaving(false); }
  }, [canSave, panelMode, editingId, form, addToast, fetchFacts]);

  const handleDelete = useCallback(async (mf: MergedFact) => {
    if (!mf.db_id) return;
    try {
      if (mf.tier !== null) {
        const res = await fetch(`/api/manager/knowledge/${mf.db_id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) });
        if (!res.ok) { const json = await res.json(); addToast(json.error ?? 'İşlem başarısız', 'error'); return; }
        addToast('Yok sayıldı', 'success');
      } else {
        const res = await fetch(`/api/manager/knowledge/${mf.db_id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) { const json = await res.json(); addToast(json.error ?? 'Silinemedi', 'error'); return; }
        addToast('Bilgi silindi', 'success');
      }
      await fetchFacts();
    } catch { addToast('Sunucuya bağlanılamadı', 'error'); }
    finally { setConfirmDeleteId(null); setConfirmIgnoreMf(null); }
  }, [addToast, fetchFacts]);

  const handleIgnore = useCallback(async (mf: MergedFact) => {
    try {
      const payload = { fact_key: mf.fact_key, fact_label: mf.fact_label, fact_value: '—', category: mf.category, is_active: false, display_order: mf.display_order };
      const res = await fetch('/api/manager/knowledge', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const json = await res.json(); addToast(json.error ?? 'İşlem başarısız', 'error'); return; }
      addToast('Yok sayıldı', 'success');
      await fetchFacts();
    } catch { addToast('Sunucuya bağlanılamadı', 'error'); }
    finally { setConfirmIgnoreMf(null); }
  }, [addToast, fetchFacts]);

  const handleReactivate = useCallback(async (mf: MergedFact) => {
    if (!mf.db_id) return;
    try {
      const prevValue = mf.fact_value && mf.fact_value !== '—' ? mf.fact_value : '';
      const res = await fetch(`/api/manager/knowledge/${mf.db_id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true, fact_value: prevValue }) });
      if (!res.ok) { const json = await res.json(); addToast(json.error ?? 'İşlem başarısız', 'error'); return; }
      addToast('Geri etkinleştirildi', 'success');
      await fetchFacts();
    } catch { addToast('Sunucuya bağlanılamadı', 'error'); }
  }, [addToast, fetchFacts]);

  // Suppress unused variable warning for confirmDeleteId
  void confirmDeleteId;

  return (
    <div className="knowledge-root">
      <Toast toasts={toasts} />

      {/* ── Header: Başlık ── */}
      <div className="knowledge-header">
        <h2 className="knowledge-title">Bilgi Tabanı</h2>
      </div>

      {/* ── Progress Bar ── */}
      <div className="knowledge-progress">
        {(['critical','recommended','detailed'] as PriorityTier[]).map((tier) => {
          const meta = TIER_META[tier];
          const s = progressStats[tier];
          const p = pct(s.filled, s.total);
          return (
            <div key={tier} className="knowledge-progress-row">
              <span className="knowledge-progress-label">{meta.emoji} {meta.label}</span>
              <span className="knowledge-progress-count">{s.filled}/{s.total}</span>
              <div className="knowledge-progress-bar">
                <div className={`knowledge-progress-fill ${meta.fill}`} style={{ width: `${p}%` }} />
              </div>
              <span className="knowledge-progress-pct">%{p}</span>
            </div>
          );
        })}
        <div className="knowledge-progress-divider" />
        <div className="knowledge-progress-row">
          <span className="knowledge-progress-label">⚪ Toplam</span>
          <span className="knowledge-progress-count">{progressStats.total.filled}/{progressStats.total.total}</span>
          <div className="knowledge-progress-bar">
            <div className="knowledge-progress-fill knowledge-progress-fill--total" style={{ width: `${pct(progressStats.total.filled, progressStats.total.total)}%` }} />
          </div>
          <span className="knowledge-progress-pct">%{pct(progressStats.total.filled, progressStats.total.total)}</span>
        </div>
      </div>

      {/* ── Yeni Bilgi Ekle Butonu ── */}
      <div className="knowledge-add-row">
        <button id="knowledge-add-btn" className="knowledge-add-btn" onClick={openNew}>
          <PlusIcon size={14} /> Yeni Bilgi Ekle
        </button>
      </div>

      {/* ── Slide-down panel ── */}
      {panelMode !== null && (
        <div className="knowledge-panel" id="knowledge-panel" ref={panelRef}>
          <div className="knowledge-panel-header">
            <span className="knowledge-panel-title">{panelTitle}</span>
          </div>
          <div className="knowledge-panel-body">
            {isReadOnly && fillMf?.placeholder && (
              <div className="knowledge-fill-hint">
                <span>💡 Örnek: <em>{fillMf.placeholder}</em></span>
                {fillMf.hint && <span className="knowledge-fill-hint-info" title={fillMf.hint}> ℹ️</span>}
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="kb-fact-label">Başlık <span className="knowledge-required">*</span></label>
              <input id="kb-fact-label" type="text" className={`form-input knowledge-form-input${isReadOnly ? ' form-input--readonly' : ''}`} value={form.fact_label} onChange={(e) => !isReadOnly && handleLabelChange(e.target.value)} readOnly={isReadOnly} title={isReadOnly ? 'Bu alan şablondan geliyor' : undefined} placeholder="örn. Havuz Açılış Saatleri" maxLength={120} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="kb-fact-key">Anahtar (fact_key) <span className="knowledge-required">*</span></label>
              <input id="kb-fact-key" type="text" className={`form-input knowledge-form-input${fieldError ? ' form-input--error' : ''}${isReadOnly ? ' form-input--readonly' : ''}`} value={form.fact_key} onChange={(e) => !isReadOnly && handleKeyChange(e.target.value)} readOnly={isReadOnly} title={isReadOnly ? 'Bu alan şablondan geliyor' : undefined} placeholder="örn. pool_open_hours" maxLength={80} />
              {fieldError && <span className="knowledge-field-error">{fieldError}</span>}
              {!isReadOnly && <span className="knowledge-key-hint">Sadece küçük harf ve alt çizgi kullanın</span>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="kb-fact-value">Değer <span className="knowledge-required">*</span></label>
              <textarea id="kb-fact-value" className="form-input form-textarea knowledge-form-input" value={form.fact_value} onChange={(e) => setForm((p) => ({ ...p, fact_value: e.target.value }))} placeholder={isReadOnly && fillMf?.placeholder ? fillMf.placeholder : 'örn. 08:00 - 20:00'} maxLength={500} rows={3} />
              <span className="hotel-info-char-count">{form.fact_value.length} / 500</span>
            </div>
            <div className="knowledge-panel-row">
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" htmlFor="kb-category">Kategori</label>
                {isReadOnly ? (
                  <input id="kb-category" type="text" className="form-input knowledge-form-input form-input--readonly" value={categoryLabel(form.category, CATEGORY_LABELS)} readOnly title="Bu alan şablondan geliyor" />
                ) : (
                  <select id="kb-category" className="form-input knowledge-form-input knowledge-select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                    {dropdownCategories.map((c) => <option key={c} value={c}>{categoryLabel(c, CATEGORY_LABELS)}</option>)}
                  </select>
                )}
              </div>
              <div className="knowledge-toggle-group">
                <span className="form-label" style={{ marginBottom: 0 }}>Aktif</span>
                <button id="kb-is-active-toggle" type="button" className={`knowledge-toggle${form.is_active ? ' knowledge-toggle--on' : ''}`} onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))} aria-pressed={form.is_active}>
                  <span className="knowledge-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
          <div className="form-card-actions" style={{ padding: '0 20px 18px' }}>
            <button type="button" className="btn-form-cancel btn-form-cancel--sm" onClick={closePanel} disabled={saving}>İptal</button>
            <button id="kb-save-btn" type="button" className="btn-form-save btn-form-save--sm" onClick={handleSave} disabled={!canSave}>
              {saving ? (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hotel-info-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Kaydediliyor...</>) : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* ── Search box ── */}
      <div className="knowledge-search-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="form-input knowledge-form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Başlık, anahtar veya metin içinde ara..."
            aria-label="Bilgi tabanında ara"
            style={{ width: '100%', paddingRight: search ? 30 : undefined }}
          />
          {search && (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
          {filteredSorted.length} / {mergedFacts.length}
        </span>
      </div>

      {/* ── Status filter ── */}
      <div className="knowledge-status-filter" role="group" aria-label="Durum filtresi">
        {STATUS_CHIPS.map((chip) => (
          <button key={chip.id} className={`knowledge-status-chip${filterStatus === chip.id ? ' knowledge-status-chip--active' : ''}`} onClick={() => setFilterStatus(chip.id)} aria-pressed={filterStatus === chip.id}>
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── Category filter ── */}
      <div className="knowledge-filter-bar" role="group" aria-label="Kategori filtresi">
        <button className={`knowledge-chip${filterCategory === null ? ' knowledge-chip--active' : ''}`} onClick={() => setFilterCategory(null)} aria-pressed={filterCategory === null}>Tümü</button>
        {availableCategories.map((cat) => (
          <button key={cat} className={`knowledge-chip${filterCategory === cat ? ' knowledge-chip--active' : ''}`} onClick={() => setFilterCategory(cat)} aria-pressed={filterCategory === cat}>
            {categoryLabel(cat, CATEGORY_LABELS)}
          </button>
        ))}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="knowledge-skeleton-list">
          {[1,2,3,4].map((i) => <div key={i} className="knowledge-skeleton-card" />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filteredSorted.length === 0 && (
        <div className="knowledge-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(168,85,247,0.4)' }}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          {searchHits.length > 0 ? (
            <>
              {/* SESSIZ YUTMA YASAGI: eslesme VAR ama status/kategori filtresi gizliyor
                  (varsayilan 'empty' status filtresi dolu fact'leri saklar → "arama bozuk" yanilgisi) */}
              <p className="knowledge-empty-text">Bu aramada {searchHits.length} sonuç var ama filtreler gizliyor.</p>
              <button
                type="button"
                onClick={() => { setFilterCategory(null); setFilterStatus('all'); }}
                style={{ marginTop: 8, padding: '6px 14px', fontSize: 13, borderRadius: 8, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)', color: 'rgba(196,181,253,0.95)', cursor: 'pointer' }}
              >
                Filtreleri temizle
              </button>
            </>
          ) : (
            <p className="knowledge-empty-text">Bu filtrede kayıt bulunamadı.</p>
          )}
        </div>
      )}

      {/* ── Facts list ── */}
      {!loading && filteredSorted.length > 0 && (
        <ul className="knowledge-list" role="list">
          {filteredSorted.map((mf) => {
            const catLabel = categoryLabel(mf.category, CATEGORY_LABELS);

            // ── Empty placeholder card ──
            if (mf.status === 'empty') {
              return (
                <li key={mf.fact_key} className="knowledge-empty-card" role="listitem">
                  <div>
                    <div className="knowledge-empty-card-label">{mf.fact_label}</div>
                    <div className="knowledge-empty-card-hint">⚪ Henüz doldurulmadı</div>
                  </div>
                  <div className="knowledge-empty-card-right">
                    {mf.tier && (
                      <span className={`knowledge-tier-badge knowledge-tier-badge--${mf.tier}`}>
                        {TIER_META[mf.tier].emoji} {TIER_META[mf.tier].label}
                      </span>
                    )}
                    <div className="knowledge-card-actions" style={{ opacity: 1 }}>
                      <button className="knowledge-empty-card-add" title="Doldur" aria-label={`${mf.fact_label} doldur`} onClick={() => openFill(mf)}>+</button>
                      <button className="knowledge-btn-yoksay" title="Yok Say" aria-label={`${mf.fact_label} yok say`} onClick={() => setConfirmIgnoreMf(mf)}>🚫</button>
                    </div>
                  </div>
                </li>
              );
            }

            // ── Filled / custom / inactive card ──
            const isInactive = mf.status === 'inactive';
            const isCustom = mf.status === 'custom';
            return (
              <li key={mf.db_id ?? mf.fact_key}
                className={`knowledge-card${isInactive ? ' knowledge-card--inactive' : ''}${isCustom ? ' knowledge-card--custom' : ''}`}
                role="listitem">
                <div className="knowledge-card-left">
                  <span className="knowledge-card-label">{mf.fact_label}</span>
                  <span className="knowledge-card-value">{mf.fact_value ?? ''}</span>
                </div>
                <div className="knowledge-card-right">
                  <div className="knowledge-card-badges">
                    <span className="knowledge-badge" style={{ color: 'rgba(196,181,253,0.9)', background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.25)' }}>
                      {catLabel}
                    </span>
                    {mf.tier && (
                      <span className={`knowledge-tier-badge knowledge-tier-badge--${mf.tier}`}>
                        {TIER_META[mf.tier].emoji}
                      </span>
                    )}
                    {isCustom && <span className="knowledge-badge knowledge-badge--custom">Şablon Dışı</span>}
                    <span className="knowledge-status-dot" title={mf.is_active ? 'Aktif' : 'Pasif'} style={{ background: mf.is_active ? '#4ade80' : 'rgba(255,255,255,0.2)', boxShadow: mf.is_active ? '0 0 6px rgba(74,222,128,0.6)' : 'none' }} />
                  </div>
                  <div className="knowledge-card-actions">
                    {isInactive ? (
                      <button className="knowledge-btn-reactivate" title="Geri Etkinleştir" aria-label={`${mf.fact_label} geri etkinleştir`} onClick={() => handleReactivate(mf)}>↻ Geri Etkinleştir</button>
                    ) : (
                      <>
                        <button className="knowledge-action-btn knowledge-action-btn--edit" title="Düzenle" onClick={() => openEdit(mf)} aria-label={`${mf.fact_label} düzenle`}><EditIcon size={14} /></button>
                        <button className="knowledge-action-btn knowledge-action-btn--delete" title={mf.tier !== null ? 'Yok Say' : 'Sil'} onClick={() => setConfirmIgnoreMf(mf)} aria-label={`${mf.fact_label} ${mf.tier !== null ? 'yok say' : 'sil'}`}><DeleteIcon size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Confirm Delete/Ignore ── */}
      {confirmIgnoreMf && (
        <div className="knowledge-overlay" role="dialog" aria-modal="true" aria-label="Onay">
          <div className="knowledge-confirm">
            <div className="knowledge-confirm-icon" style={{ background: 'rgba(107,114,128,0.15)', borderColor: 'rgba(107,114,128,0.3)', color: '#9ca3af' }}>🚫</div>
            <h3 className="knowledge-confirm-title">{confirmIgnoreMf.status === 'empty' ? 'Yok Say' : (confirmIgnoreMf.tier !== null ? 'Yok Say' : 'Sil')}</h3>
            <p className="knowledge-confirm-text">
              {confirmIgnoreMf.status === 'empty'
                ? 'Bu bilgi otelinizde mevcut değil olarak işaretlenecek. Onaylıyor musunuz?'
                : confirmIgnoreMf.tier !== null
                  ? "Bu bilgi 'yok sayıldı' olarak işaretlenecek. Onaylıyor musunuz?"
                  : 'Bu bilgiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'}
            </p>
            <div className="knowledge-confirm-actions">
              <button className="btn-form-cancel btn-form-cancel--sm" onClick={() => setConfirmIgnoreMf(null)}>İptal</button>
              <button id="kb-confirm-action-btn" className="knowledge-btn-delete" style={{ background: confirmIgnoreMf.status !== 'empty' && confirmIgnoreMf.tier === null ? undefined : 'linear-gradient(135deg,#4b5563 0%,#1f2937 100%)' }} onClick={() => confirmIgnoreMf.status === 'empty' ? handleIgnore(confirmIgnoreMf) : handleDelete(confirmIgnoreMf)}>
                {confirmIgnoreMf.status !== 'empty' && confirmIgnoreMf.tier === null ? 'Evet, Sil' : 'Evet, Yok Say'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
