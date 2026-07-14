'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface MenuItem {
  id: string;
  item_name: string;
  category: string | null;
  price: number;
  currency: string;
  is_paid: boolean;
  is_active: boolean;
  display_order: number;
  item_code?: string | null;
  image_url?: string | null;
}

const NO_CATEGORY = '__none__';
const NEW_CATEGORY = '__new__';
const CURRENCIES = ['TRY', 'EUR', 'USD'];
const CUR_SYMBOL: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$' };

// --- stil paleti (menu-yukle ile ayni) ---
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
};
const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: '#fff',
  border: 'none',
  padding: '9px 18px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13.5,
  boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
};
const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '9px 16px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 13.5,
};
const dangerBtn: React.CSSProperties = {
  background: 'rgba(248,113,113,0.12)',
  color: '#fca5a5',
  border: '1px solid rgba(248,113,113,0.28)',
  padding: '7px 14px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 12.5,
};
const smallBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '7px 14px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 12.5,
};
const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 9,
  color: '#f1f5f9',
  padding: '8px 11px',
  fontSize: 13.5,
  outline: 'none',
};

export default function MenuManager({ slug }: { slug: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // default: hepsi acik => collapsed bos. Kullanici kapattikca buraya eklenir.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // yeni urun formu
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addNewCategory, setAddNewCategory] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addCurrency, setAddCurrency] = useState('TRY');
  const [addIsPaid, setAddIsPaid] = useState(true);
  const [addCode, setAddCode] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [addUploading, setAddUploading] = useState(false);

  // room-service menu gorseli (fiyat listesi) — hotel_settings.menu_image_urls
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [menuImgUploading, setMenuImgUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Liste alinamadi');
      setItems(data.items || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMenuImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/image`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Menü görseli alinamadi');
      setMenuImages(Array.isArray(data.menu_image_urls) ? data.menu_image_urls : []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    loadMenuImages();
  }, [loadMenuImages]);

  // menu gorsel listesini kaydet (PUT tum diziyi degistirir)
  async function saveMenuImages(next: string[]) {
    const res = await fetch(`/api/hotel-admin/${slug}/menu/image`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_image_urls: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Menü görseli kaydedilemedi');
  }

  async function uploadMenuImage(file: File) {
    setMenuImgUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/hotel-admin/${slug}/menu/upload-image`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Görsel yüklenemedi');

      const next = [...menuImages, data.image_url as string];
      await saveMenuImages(next);
      setMenuImages(next);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setMenuImgUploading(false);
    }
  }

  async function removeMenuImage(url: string) {
    const next = menuImages.filter((u) => u !== url);
    try {
      await saveMenuImages(next);
      setMenuImages(next);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // category'e gore grupla (server zaten category + display_order sirali dondurur)
  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const key = it.category && it.category.trim() !== '' ? it.category : NO_CATEGORY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  // mevcut kategoriler (dropdown icin)
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category && it.category.trim() !== '') set.add(it.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [items]);

  function toggleCategory(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startEdit(it: MenuItem) {
    setEditingId(it.id);
    setEditName(it.item_name);
    setEditPrice(String(it.price ?? ''));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditPrice('');
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, item_name: editName.trim(), price: editPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Guncellenemedi');
      cancelEdit();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm('Bu ürün menüden kaldırılsın mı? Emin misiniz?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Silinemedi');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restoreItem(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Geri getirilemedi');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function purgeItem(id: string) {
    if (!window.confirm('Bu ürün KALICI olarak silinecek. Geri alınamaz. Emin misiniz?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hard: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kalıcı silinemedi');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setAddUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/hotel-admin/${slug}/menu/upload-image`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Görsel yüklenemedi');
      setAddImageUrl(data.image_url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAddUploading(false);
    }
  }

  async function addItem() {
    if (!addName.trim()) {
      setError('Ürün adı zorunlu');
      return;
    }
    const category =
      addCategory === NEW_CATEGORY ? addNewCategory.trim() : addCategory.trim();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/menu/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: addName.trim(),
          category: category || null,
          price: addPrice,
          currency: addCurrency,
          is_paid: addIsPaid,
          item_code: addCode,
          image_url: addImageUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eklenemedi');
      // formu sifirla
      setAddName('');
      setAddCategory('');
      setAddNewCategory('');
      setAddPrice('');
      setAddCurrency('TRY');
      setAddIsPaid(true);
      setAddCode('');
      setAddImageUrl('');
      setShowAdd(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function fmtPrice(it: MenuItem) {
    if (!it.is_paid) return 'Ücretsiz';
    const sym = CUR_SYMBOL[it.currency] || it.currency;
    return `${it.price} ${sym}`;
  }

  return (
    <div style={{ marginTop: 40 }}>
      {/* Room-Service Menu Gorseli */}
      <div style={{ ...card, padding: 22, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🖼</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
            Room-Service Menü Görseli
          </h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 16px' }}>
          Misafir “menü” veya “room service” dediğinde bot bu görseli gönderir. Fiyat listesini buraya yükleyin.
          Çok sayfalı menüler için birden fazla görsel ekleyebilirsiniz.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 240px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Görsel ekle (PNG/JPEG/WebP, maks. 5 MB)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={menuImgUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMenuImage(f);
                e.target.value = '';
              }}
              style={{ ...inputStyle, padding: '7px 9px', fontSize: 12.5 }}
            />
          </label>
          {menuImgUploading && <span style={{ color: '#a5b4fc', fontSize: 13 }}>Yükleniyor…</span>}
        </div>

        <div style={{ marginTop: 16 }}>
          {menuImages.length === 0 ? (
            <span style={{ color: '#64748b', fontSize: 13 }}>Henüz menü görseli yüklenmedi</span>
          ) : (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {menuImages.map((url) => (
                <div key={url} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Menü görseli"
                    style={{ maxWidth: 120, maxHeight: 120, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                  <button onClick={() => removeMenuImage(url)} disabled={menuImgUploading} style={dangerBtn}>
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Baslik + Yeni Urun */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
            Mevcut Menü
          </h2>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} style={primaryBtn}>
          {showAdd ? '× Kapat' : '+ Yeni Ürün Ekle'}
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div style={{ ...card, padding: 14, marginBottom: 16, borderColor: 'rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ color: '#fca5a5', fontSize: 13.5 }}>{error}</span>
        </div>
      )}

      {/* Yeni Urun Formu */}
      {showAdd && (
        <div style={{ ...card, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 200px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Ürün adı</span>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} placeholder="Örn. Klasik Burger" />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 1 120px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Ürün Kodu</span>
              <input value={addCode} onChange={(e) => setAddCode(e.target.value)} style={inputStyle} placeholder="ör. 101" />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 170px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Kategori</span>
              <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)} style={inputStyle}>
                <option value="">— Kategorisiz —</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value={NEW_CATEGORY}>+ Yeni kategori…</option>
              </select>
            </label>

            {addCategory === NEW_CATEGORY && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 170px' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Yeni kategori adı</span>
                <input value={addNewCategory} onChange={(e) => setAddNewCategory(e.target.value)} style={inputStyle} placeholder="Örn. Tatlılar" />
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 1 110px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Fiyat</span>
              <input
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                style={{ ...inputStyle, opacity: addIsPaid ? 1 : 0.5 }}
                disabled={!addIsPaid}
                inputMode="decimal"
                placeholder="0"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 1 90px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Birim</span>
              <select value={addCurrency} onChange={(e) => setAddCurrency(e.target.value)} style={inputStyle} disabled={!addIsPaid}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto', color: '#cbd5e1', fontSize: 13, cursor: 'pointer', paddingBottom: 9 }}>
              <input type="checkbox" checked={addIsPaid} onChange={(e) => setAddIsPaid(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Ücretli
            </label>
          </div>

          {/* Gorsel yukleme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 240px' }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Görsel (PNG/JPEG/WebP, maks. 5 MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={addUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                }}
                style={{ ...inputStyle, padding: '7px 9px', fontSize: 12.5 }}
              />
            </label>

            {addUploading && (
              <span style={{ color: '#a5b4fc', fontSize: 13 }}>Yükleniyor…</span>
            )}

            {!addUploading && addImageUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={addImageUrl}
                  alt="Ürün görseli önizleme"
                  style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <span style={{ color: '#86efac', fontSize: 13 }}>Görsel yüklendi ✓</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={addItem} disabled={busy || addUploading} style={{ ...primaryBtn, opacity: busy || addUploading ? 0.6 : 1 }}>
              {busy ? 'Ekleniyor…' : 'Ekle'}
            </button>
            <button onClick={() => setShowAdd(false)} disabled={busy} style={ghostBtn}>İptal</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          Henüz menü ürünü yok. Yukarıdan Excel yükleyebilir veya “+ Yeni Ürün Ekle” ile tek tek ekleyebilirsiniz.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(([key, list]) => {
            const isOpen = !collapsed.has(key);
            const label = key === NO_CATEGORY ? 'Kategorisiz' : key;
            const activeCount = list.filter((i) => i.is_active).length;
            return (
              <div key={key} style={{ ...card, overflow: 'hidden' }}>
                {/* Akordiyon basligi */}
                <button
                  onClick={() => toggleCategory(key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '15px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    border: 'none',
                    borderBottom: isOpen ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    cursor: 'pointer',
                    color: '#f1f5f9',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#a5b4fc', width: 14 }}>{isOpen ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 600, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: 999 }}>
                    {activeCount} ürün
                  </span>
                </button>

                {/* Urunler */}
                {isOpen && (
                  <div>
                    {list.map((it) => {
                      const editing = editingId === it.id;
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 20px',
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            opacity: it.is_active ? 1 : 0.5,
                            flexWrap: 'wrap',
                          }}
                        >
                          {editing ? (
                            <>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ ...inputStyle, flex: '1 1 200px' }}
                              />
                              <input
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                style={{ ...inputStyle, flex: '0 1 110px' }}
                                inputMode="decimal"
                                placeholder="Fiyat"
                                disabled={!it.is_paid}
                              />
                              <span style={{ color: '#64748b', fontSize: 12 }}>{CUR_SYMBOL[it.currency] || it.currency}</span>
                              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                <button onClick={() => saveEdit(it.id)} disabled={busy} style={{ ...primaryBtn, padding: '7px 14px', fontSize: 12.5 }}>Kaydet</button>
                                <button onClick={cancelEdit} disabled={busy} style={smallBtn}>İptal</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={{ color: '#e2e8f0', fontSize: 14.5, fontWeight: 500, flex: '1 1 180px' }}>
                                {it.item_name}
                                {!it.is_active && (
                                  <span style={{ marginLeft: 10, fontSize: 11, color: '#fca5a5', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', padding: '2px 8px', borderRadius: 999 }}>
                                    Kaldırıldı
                                  </span>
                                )}
                              </span>

                              <span style={{ color: '#cbd5e1', fontSize: 13.5, minWidth: 70 }}>{fmtPrice(it)}</span>

                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  padding: '3px 10px',
                                  borderRadius: 999,
                                  color: it.is_paid ? '#fcd34d' : '#34d399',
                                  background: it.is_paid ? 'rgba(252,211,77,0.12)' : 'rgba(52,211,153,0.12)',
                                  border: `1px solid ${it.is_paid ? 'rgba(252,211,77,0.25)' : 'rgba(52,211,153,0.25)'}`,
                                }}
                              >
                                {it.is_paid ? 'Ücretli' : 'Ücretsiz'}
                              </span>

                              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                {it.is_active ? (
                                  <>
                                    <button onClick={() => startEdit(it)} disabled={busy} style={smallBtn}>Düzenle</button>
                                    <button onClick={() => removeItem(it.id)} disabled={busy} style={dangerBtn}>Menüden Kaldır</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => restoreItem(it.id)} disabled={busy} style={{ ...smallBtn, color: '#86efac', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)' }}>
                                      Geri Getir
                                    </button>
                                    <button onClick={() => purgeItem(it.id)} disabled={busy} style={dangerBtn}>Sil</button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
