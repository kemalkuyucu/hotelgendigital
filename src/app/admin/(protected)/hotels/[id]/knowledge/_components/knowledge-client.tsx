'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PREDEFINED_FACTS } from '@/lib/knowledge/predefined-facts';
import { FACT_CATEGORIES, FACT_CATEGORY_LABELS } from '@/lib/knowledge/types';
import type { HotelFact, KnowledgeSection, FactCategory } from '@/lib/knowledge/types';
import { prettify } from '@/lib/knowledge/format-category';

interface Props {
  hotelId: string;
  hotelName: string;
}

type Tab = 'facts' | 'sections';

export function KnowledgeClient({ hotelId, hotelName: _hotelName }: Props) {
  const [tab, setTab] = useState<Tab>('facts');
  const [facts, setFacts] = useState<HotelFact[]>([]);
  const [sections, setSections] = useState<KnowledgeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FactCategory | 'all'>('all');

  // Modals
  const [factModal, setFactModal] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'fact' | 'section'; id: string } | null>(null);
  const [editingFact, setEditingFact] = useState<HotelFact | null>(null);
  const [editingSection, setEditingSection] = useState<KnowledgeSection | null>(null);

  // Fact form
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState('');
  const [factForm, setFactForm] = useState({ fact_key: '', fact_value: '', fact_label: '', category: 'general' });

  // Section form
  const [sectionForm, setSectionForm] = useState({ title: '', content: '', category: '', display_order: 0 });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadFacts = useCallback(async () => {
    const res = await fetch(`/api/admin/hotels/${hotelId}/knowledge/facts`);
    const data = await res.json() as { ok: boolean; facts: HotelFact[] };
    if (data.ok) setFacts(data.facts);
  }, [hotelId]);

  const loadSections = useCallback(async () => {
    const res = await fetch(`/api/admin/hotels/${hotelId}/knowledge/sections`);
    const data = await res.json() as { ok: boolean; sections: KnowledgeSection[] };
    if (data.ok) setSections(data.sections);
  }, [hotelId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFacts(), loadSections()]).finally(() => setLoading(false));
  }, [loadFacts, loadSections]);

  // Predefined seçilince form alanları dolar
  const handlePredefinedChange = (key: string) => {
    setSelectedPredefined(key);
    const p = PREDEFINED_FACTS.find((f) => f.key === key);
    if (p) setFactForm(prev => ({ ...prev, fact_key: p.key, fact_label: p.label, category: p.category }));
  };

  const openAddFact = () => {
    setEditingFact(null);
    setUseCustomKey(false);
    setSelectedPredefined('');
    setFactForm({ fact_key: '', fact_value: '', fact_label: '', category: 'general' });
    setFactModal(true);
  };

  const openEditFact = (fact: HotelFact) => {
    setEditingFact(fact);
    setUseCustomKey(true);
    setFactForm({ fact_key: fact.fact_key, fact_value: fact.fact_value, fact_label: fact.fact_label, category: fact.category });
    setFactModal(true);
  };

  const saveFact = async () => {
    if (!factForm.fact_key || !factForm.fact_value || !factForm.fact_label) {
      showToast('❌ Tüm alanları doldurun');
      return;
    }
    try {
      if (editingFact) {
        await fetch(`/api/admin/hotels/${hotelId}/knowledge/facts/${editingFact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fact_value: factForm.fact_value, fact_label: factForm.fact_label, category: factForm.category }),
        });
      } else {
        await fetch(`/api/admin/hotels/${hotelId}/knowledge/facts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factForm),
        });
      }
      await loadFacts();
      setFactModal(false);
      showToast('✅ Kaydedildi');
    } catch {
      showToast('❌ Kayıt hatası');
    }
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionForm({ title: '', content: '', category: '', display_order: 0 });
    setSectionModal(true);
  };

  const openEditSection = (s: KnowledgeSection) => {
    setEditingSection(s);
    setSectionForm({ title: s.title, content: s.content, category: s.category ?? '', display_order: s.display_order });
    setSectionModal(true);
  };

  const saveSection = async () => {
    if (!sectionForm.title || !sectionForm.content) {
      showToast('❌ Başlık ve içerik zorunlu');
      return;
    }
    try {
      if (editingSection) {
        await fetch(`/api/admin/hotels/${hotelId}/knowledge/sections/${editingSection.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sectionForm),
        });
      } else {
        await fetch(`/api/admin/hotels/${hotelId}/knowledge/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sectionForm),
        });
      }
      await loadSections();
      setSectionModal(false);
      showToast('✅ Kaydedildi');
    } catch {
      showToast('❌ Kayıt hatası');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const url = deleteTarget.type === 'fact'
        ? `/api/admin/hotels/${hotelId}/knowledge/facts/${deleteTarget.id}`
        : `/api/admin/hotels/${hotelId}/knowledge/sections/${deleteTarget.id}`;
      await fetch(url, { method: 'DELETE' });
      if (deleteTarget.type === 'fact') await loadFacts();
      else await loadSections();
      showToast('✅ Silindi');
    } catch {
      showToast('❌ Silme hatası');
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredFacts = categoryFilter === 'all'
    ? facts
    : facts.filter((f) => f.category === categoryFilter);

  // Filtre chip'leri: bilinen kategoriler (veride olanlar) once, canli ekstralar alfabetik sonda.
  const availableCategories = useMemo<FactCategory[]>(() => {
    const seen = new Set(facts.map((f) => f.category));
    const known = new Set<string>(FACT_CATEGORIES);
    const ordered = FACT_CATEGORIES.filter((c) => seen.has(c));
    const extra = [...seen].filter((c) => !known.has(c)).sort();
    return [...ordered, ...extra];
  }, [facts]);

  // Edit dropdown: TUM bilinen kategoriler + canli ekstralar (fact'in mevcut kategorisi hep listede).
  const dropdownCategories = useMemo<FactCategory[]>(() => {
    const known = new Set<string>(FACT_CATEGORIES);
    const extra = [...new Set(facts.map((f) => f.category))].filter((c) => !known.has(c)).sort();
    return [...FACT_CATEGORIES, ...extra];
  }, [facts]);

  if (loading) return <div className="text-gray-500 p-4">Yükleniyor...</div>;

  return (
    <div className="max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['facts', 'sections'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'facts' ? '⚡ Hızlı Bilgiler' : '📄 Detaylı Bölümler'}
          </button>
        ))}
      </div>

      {/* ─── FACTS ─── */}
      {tab === 'facts' && (
        <div>
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Tümü ({facts.length})
            </button>
            {availableCategories.map((cat) => {
              const count = facts.filter((f) => f.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {FACT_CATEGORY_LABELS[cat] ?? prettify(cat)} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-500">{filteredFacts.length} kayıt</p>
            <button
              onClick={openAddFact}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Yeni Bilgi Ekle
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredFacts.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Henüz bilgi girilmemiş.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Etiket</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Değer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFacts.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{f.fact_label}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{f.fact_value}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          {FACT_CATEGORY_LABELS[f.category] ?? prettify(f.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditFact(f)} className="text-indigo-600 hover:underline mr-3 text-xs">Düzenle</button>
                        <button onClick={() => setDeleteTarget({ type: 'fact', id: f.id })} className="text-red-500 hover:underline text-xs">Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── SECTIONS ─── */}
      {tab === 'sections' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{sections.length} bölüm</p>
            <button
              onClick={openAddSection}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Yeni Bölüm Ekle
            </button>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Henüz bölüm girilmemiş.</p>
          ) : (
            <div className="space-y-3">
              {sections.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-1">{s.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{s.content.slice(0, 200)}{s.content.length > 200 ? '...' : ''}</p>
                      {s.category && (
                        <span className="mt-2 inline-block bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{s.category}</span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditSection(s)} className="text-xs text-indigo-600 border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-50">Düzenle</button>
                      <button onClick={() => setDeleteTarget({ type: 'section', id: s.id })} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Sil</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── FACT MODAL ─── */}
      {factModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editingFact ? 'Bilgiyi Düzenle' : 'Yeni Bilgi Ekle'}</h2>

            {!editingFact && (
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setUseCustomKey(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!useCustomKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  Hazır Liste
                </button>
                <button
                  onClick={() => setUseCustomKey(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${useCustomKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  Özel Key
                </button>
              </div>
            )}

            {!editingFact && !useCustomKey && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Hazır Anahtar</label>
                <select
                  value={selectedPredefined}
                  onChange={(e) => handlePredefinedChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seçin...</option>
                  {PREDEFINED_FACTS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label} ({FACT_CATEGORY_LABELS[p.category]})</option>
                  ))}
                </select>
              </div>
            )}

            {(useCustomKey || editingFact) && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Anahtar (fact_key)</label>
                <input
                  value={factForm.fact_key}
                  onChange={(e) => setFactForm(p => ({ ...p, fact_key: e.target.value }))}
                  disabled={!!editingFact}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="pool_open_time"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Etiket</label>
              <input
                value={factForm.fact_label}
                onChange={(e) => setFactForm(p => ({ ...p, fact_label: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Havuz Açılış Saati"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Değer</label>
              <input
                value={factForm.fact_value}
                onChange={(e) => setFactForm(p => ({ ...p, fact_value: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="09:00"
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={factForm.category}
                onChange={(e) => setFactForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {dropdownCategories.map((c) => (
                  <option key={c} value={c}>{FACT_CATEGORY_LABELS[c] ?? prettify(c)}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setFactModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={saveFact} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION MODAL ─── */}
      {sectionModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editingSection ? 'Bölümü Düzenle' : 'Yeni Bölüm Ekle'}</h2>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Başlık *</label>
              <input
                value={sectionForm.title}
                onChange={(e) => setSectionForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Otelimiz Hakkında"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">İçerik *</label>
              <textarea
                value={sectionForm.content}
                onChange={(e) => setSectionForm(p => ({ ...p, content: e.target.value }))}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Bölüm içeriğini buraya yazın..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kategori (opsiyonel)</label>
                <input
                  value={sectionForm.category}
                  onChange={(e) => setSectionForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="general"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sıra</label>
                <input
                  type="number"
                  value={sectionForm.display_order}
                  onChange={(e) => setSectionForm(p => ({ ...p, display_order: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setSectionModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={saveSection} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Silmek istediğinizden emin misiniz?</h2>
            <p className="text-sm text-gray-500 mb-5">Bu işlem geri alınamaz.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
