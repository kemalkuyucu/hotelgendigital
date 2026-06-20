'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERPLEXITY_CATEGORIES } from '@/lib/perplexity/categories';
import type { InterestTag, PerplexityPlace } from '@/lib/perplexity/types';

type DiscoveryRow = {
  id: string;
  interest_tag: string;
  query_text: string;
  results: PerplexityPlace[];
  raw_response: string | null;
  sources: string[];
  model_used: string | null;
  tokens_used: number | null;
  is_pinned: boolean;
  created_at: string;
  expires_at: string | null;  // FIX 1c: NULL = süresiz, asla "süresi doldu" sayma
};

export default function PerplexityDiscoverySubTab() {
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedTag, setSelectedTag] = useState<InterestTag | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  const fetchDiscoveries = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/manager/perplexity/discover');
      const data = await res.json();
      if (res.ok) setDiscoveries(data.discoveries ?? []);
    } catch {
      // sessiz geç
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscoveries();
  }, [fetchDiscoveries]);

  // Seçili kategori için en son sonucu bul (expire olmuş olabilir)
  const currentDiscovery = selectedTag
    ? discoveries.find((d) => d.interest_tag === selectedTag) ?? null
    : null;

  async function handleQuery(forceRefresh = false) {
    if (!selectedTag) return;
    clearMessages();
    setIsQuerying(true);
    try {
      const res = await fetch('/api/manager/perplexity/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: selectedTag, force_refresh: forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sorgu başarısız');

      setSuccess(
        data.cache_hit
          ? 'Önbellekten yüklendi (eski sorgu).'
          : 'Yeni sorgu başarıyla tamamlandı.',
      );
      setTimeout(() => setSuccess(null), 4000);
      await fetchDiscoveries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu keşif sonucunu silmek istediğine emin misin?')) return;
    clearMessages();
    try {
      const res = await fetch(`/api/manager/perplexity/discover/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Silme hatası: ${data.error ?? 'Bilinmeyen hata'}`);
        return;
      }
      setDiscoveries((rows) => rows.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  }

  async function handleTogglePin(row: DiscoveryRow) {
    clearMessages();
    try {
      const res = await fetch(`/api/manager/perplexity/discover/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !row.is_pinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Güncelleme başarısız');
      setDiscoveries((rows) =>
        rows.map((r) => (r.id === row.id ? data.discovery : r)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  }

  function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  }

  // FIX 1c: NULL ise expired SAYMA — eski kayıtlar expires_at=NULL ile yazıldı
  function isExpired(iso: string | null): boolean {
    if (!iso) return false;  // NULL = süresiz
    return new Date(iso).getTime() < Date.now();
  }

  return (
    <div className="form-card form-card--wide perplexity-subtab">
      <h2 className="subtab-title" style={{ color: '#f1f5f9' }}>Çevre Keşfi</h2>
      <p className="subtab-description" style={{ color: '#9ca3af' }}>
        Otel adresine göre çevredeki mekanları otomatik bul. Sonuçlar 7 gün
        önbelleklenir; gerektiğinde sabitleyebilir veya yeniden sorgulayabilirsin.
      </p>

      {/* Kategori grid */}
      <div className="perplexity-categories">
        {PERPLEXITY_CATEGORIES.map((cat) => {
          const discovery = discoveries.find((d) => d.interest_tag === cat.tag);
          const isSelected = selectedTag === cat.tag;
          return (
            <button
              key={cat.tag}
              type="button"
              className={`perplexity-category ${isSelected ? 'is-selected' : ''} ${
                discovery ? 'has-data' : ''
              }`}
              onClick={() => {
                setSelectedTag(cat.tag);
                clearMessages();
              }}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-label">{cat.label_tr}</span>
              {discovery && (
                <span className="category-meta">
                  {discovery.results.length} mekan
                  {discovery.is_pinned && ' · 📌'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Seçili kategori detayı */}
      {selectedTag && (
        <div className="perplexity-detail">
          <div className="detail-header">
            <h3>
              {PERPLEXITY_CATEGORIES.find((c) => c.tag === selectedTag)?.icon}{' '}
              {PERPLEXITY_CATEGORIES.find((c) => c.tag === selectedTag)?.label_tr}
            </h3>
            {currentDiscovery && (
              <div className="detail-meta">
                <span>
                  {formatRelativeTime(currentDiscovery.created_at)} sorguladı
                </span>
                {currentDiscovery.is_pinned && <span className="badge-pinned">📌 Sabit</span>}
                {isExpired(currentDiscovery.expires_at) && !currentDiscovery.is_pinned && (
                  <span className="badge-expired">⚠️ Süresi doldu</span>
                )}
              </div>
            )}
          </div>

          <div className="detail-actions">
            {!currentDiscovery ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleQuery(false)}
                disabled={isQuerying}
              >
                {isQuerying ? 'Sorgulanıyor...' : '🔍 Sorguyu Çalıştır'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleQuery(true)}
                  disabled={isQuerying}
                >
                  {isQuerying ? 'Sorgulanıyor...' : '🔄 Yeniden Sorgula'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTogglePin(currentDiscovery)}
                >
                  {currentDiscovery.is_pinned ? '📌 Sabit Kaldır' : '📌 Sabitle'}
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => handleDelete(currentDiscovery.id)}
                >
                  🗑️ Sil
                </button>
              </>
            )}
          </div>

          {error && <div className="form-message form-message-error">{error}</div>}
          {success && <div className="form-message form-message-success">{success}</div>}

          {/* Mekan listesi */}
          {currentDiscovery && currentDiscovery.results.length > 0 && (
            <div className="places-list">
              <h4>Bulunan Mekanlar ({currentDiscovery.results.length})</h4>
              {currentDiscovery.results.map((place, idx) => (
                <div key={idx} className="place-card">
                  <div className="place-header">
                    <strong>{place.name}</strong>
                    {place.rating && (
                      <span className="place-rating">⭐ {place.rating}</span>
                    )}
                  </div>
                  {place.address && (
                    <div className="place-address">📍 {place.address}</div>
                  )}
                  <div className="place-meta">
                    {place.distance && <span>{place.distance}</span>}
                    {place.phone && <span>📞 {place.phone}</span>}
                    {place.hours && <span>🕐 {place.hours}</span>}
                  </div>
                  {place.description && (
                    <p className="place-description">{place.description}</p>
                  )}
                </div>
              ))}

              {currentDiscovery.sources.length > 0 && (
                <div className="places-sources">
                  <strong>Kaynaklar:</strong>{' '}
                  {currentDiscovery.sources.slice(0, 5).map((src, idx) => (
                    <a key={idx} href={src} target="_blank" rel="noopener noreferrer">
                      [{idx + 1}]
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentDiscovery && currentDiscovery.results.length === 0 && (
            <p className="list-empty-message">
              Sorgu sonucu boş geldi. Yeniden sorgulamayı dene.
            </p>
          )}
        </div>
      )}

      {!selectedTag && !isLoadingList && (
        <p className="list-empty-message">
          Yukarıdan bir kategori seçerek başla.
        </p>
      )}
    </div>
  );
}
