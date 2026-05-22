'use client';

// =============================================================================
// src/app/admin/(protected)/migrations/MigrationsClient.tsx
// Client Component — Migration yönetim UI (glassmorphism dark theme)
// =============================================================================

import { useState, useCallback } from 'react';
import type { MigrationStatusReport } from '@/lib/migrations';

type StatusWithName = MigrationStatusReport & { hotel_name: string };

interface Props {
  initialStatuses: StatusWithName[];
  adminUsername: string;
}

// ─── Ortak glassmorphism kart stili ─────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Yardımcı: Durum badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ applied, total }: { applied: number; total: number }) {
  if (applied === total) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
      >
        ✅ Güncel ({applied}/{total})
      </span>
    );
  }
  const pending = total - applied;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
    >
      ⚠️ {pending} güncelleme bekliyor ({applied}/{total})
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detay Modal
// ─────────────────────────────────────────────────────────────────────────────
function DetailModal({
  status,
  onClose,
}: {
  status: StatusWithName;
  onClose: () => void;
}) {
  const allVersions = ['001', '002', '003', '004', '005', '006', '008'];
  const appliedVersions = new Set(status.applied.map((a) => a.version));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        style={{
          background: 'rgba(10,15,30,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#f8fafc' }}>🏨 {status.hotel_name}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>Migration detayları</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.06)' }}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-3">
          {allVersions.map((version) => {
            const appliedRow = status.applied.find((a) => a.version === version);
            const isApplied = appliedVersions.has(version);

            return (
              <div
                key={version}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={
                  isApplied
                    ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }
                    : { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }
                }
              >
                <span className="text-lg mt-0.5">{isApplied ? '✅' : '⏳'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold" style={{ color: '#94a3b8' }}>{version}</span>
                    <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
                      {appliedRow?.name ?? getPendingName(version)}
                    </span>
                  </div>
                  {isApplied && appliedRow && (
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                      {new Date(appliedRow.appliedAt).toLocaleString('tr-TR')}
                    </p>
                  )}
                  {!isApplied && (
                    <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>Henüz uygulanmadı</p>
                  )}
                </div>
              </div>
            );
          })}

          {status.last_error && (
            <div
              className="mt-4 p-4 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#fca5a5' }}>
                🔴 Son Hata — v{status.last_error.version}
              </p>
              <p className="text-xs font-mono break-all" style={{ color: '#f87171' }}>
                {status.last_error.message}
              </p>
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                {new Date(status.last_error.at).toLocaleString('tr-TR')}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// Bekleyen versiyonların adları
function getPendingName(version: string) {
  const names: Record<string, string> = {
    '001': 'initial_schema',
    '002': 'perplexity',
    '003': 'sla_events',
    '004': 'module15_iban',
    '005': 'module17_inhouse',
    '006': 'module17_notifications',
    '008': 'module17_7_multi_match_flag',
  };
  return names[version] ?? 'bilinmeyen';
}

// ─────────────────────────────────────────────────────────────────────────────
// Güncelleme Onay Modalı
// ─────────────────────────────────────────────────────────────────────────────
function UpdateModal({
  status,
  onConfirm,
  onCancel,
  isLoading,
  result,
}: {
  status: StatusWithName;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  result: { success: boolean; appliedCount: number; error?: string } | null;
}) {
  const modalStyle: React.CSSProperties = {
    background: 'rgba(10,15,30,0.95)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.12)',
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}>
        <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={modalStyle}>
          <div className="text-center">
            <div className="text-5xl mb-4">{result.success ? '🎉' : '❌'}</div>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#f8fafc' }}>
              {result.success ? 'Güncelleme Tamamlandı' : 'Hata Oluştu'}
            </h2>
            {result.success ? (
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                {result.appliedCount} migration başarıyla uygulandı.
              </p>
            ) : (
              <p className="text-sm font-mono break-all" style={{ color: '#f87171' }}>{result.error}</p>
            )}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#e2e8f0' }}
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={modalStyle}>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#f8fafc' }}>
          🔄 Güncelleme Onayı
        </h2>
        <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
          <strong style={{ color: '#e2e8f0' }}>{status.hotel_name}</strong> oteli için{' '}
          <strong style={{ color: '#e2e8f0' }}>{status.pending.length}</strong> bekleyen migration uygulanacak.
        </p>
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <p className="text-xs font-medium" style={{ color: '#fbbf24' }}>Uygulanacak versiyonlar:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {status.pending.map((p) => (
              <span
                key={p.version}
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }}
              >
                {p.version}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs mb-6" style={{ color: '#64748b' }}>
          Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uygulanıyor...
              </>
            ) : (
              'Güncelle'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ana Component
// ─────────────────────────────────────────────────────────────────────────────
export default function MigrationsClient({ initialStatuses, adminUsername }: Props) {
  const [statuses, setStatuses] = useState<StatusWithName[]>(initialStatuses);
  const [detailModal, setDetailModal] = useState<StatusWithName | null>(null);
  const [updateModal, setUpdateModal] = useState<StatusWithName | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    success: boolean;
    appliedCount: number;
    error?: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Tüm durumları yenile
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/admin/migrations/status');
      const json = await res.json() as { statuses?: unknown[]; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Bilinmeyen hata');
      const newStatuses = (json.statuses as MigrationStatusReport[]).map((s) => {
        const prev = statuses.find((p) => p.hotel_slug === s.hotel_slug);
        return { ...s, hotel_name: prev?.hotel_name ?? s.hotel_slug };
      });
      setStatuses(newStatuses);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Yenileme hatası.');
    } finally {
      setRefreshing(false);
    }
  }, [statuses]);

  // Migration çalıştır
  const handleRunMigration = useCallback(async () => {
    if (!updateModal) return;
    setUpdateLoading(true);
    try {
      const res = await fetch('/api/admin/migrations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelSlug: updateModal.hotel_slug }),
      });
      const json = await res.json() as {
        success?: boolean;
        result?: { applied?: { version: string }[]; failed?: { errorMessage: string } };
        error?: string;
      };

      if (!res.ok || json.error) {
        setUpdateResult({ success: false, appliedCount: 0, error: json.error ?? 'API hatası.' });
      } else if (json.result?.failed) {
        setUpdateResult({
          success: false,
          appliedCount: json.result?.applied?.length ?? 0,
          error: json.result.failed.errorMessage,
        });
      } else {
        setUpdateResult({
          success: true,
          appliedCount: json.result?.applied?.length ?? 0,
        });
        await refreshAll();
      }
    } catch (err) {
      setUpdateResult({
        success: false,
        appliedCount: 0,
        error: err instanceof Error ? err.message : 'Bağlantı hatası.',
      });
    } finally {
      setUpdateLoading(false);
    }
  }, [updateModal, refreshAll]);

  const totalHotels = statuses.length;
  const upToDateCount = statuses.filter((s) => s.pending.length === 0).length;
  const pendingCount = totalHotels - upToDateCount;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Başlık */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#f8fafc' }}>Veritabanı Sürümleri</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
            Her otelin veritabanının güncel olup olmadığını buradan kontrol edebilirsiniz.
            Eksik güncellemeler varsa <strong style={{ color: '#e2e8f0' }}>&ldquo;Güncelle&rdquo;</strong> butonuna basın.
          </p>
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl p-4" style={glassCard}>
            <div className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>{totalHotels}</div>
            <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>Toplam Otel</div>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(34,197,94,0.10)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(34,197,94,0.25)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div className="text-2xl font-bold text-green-400">{upToDateCount}</div>
            <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>Güncel</div>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(245,158,11,0.10)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(245,158,11,0.25)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>Güncelleme Bekliyor</div>
          </div>
        </div>

        {/* Yenile butonu */}
        <div className="flex justify-between items-center mb-4">
          {refreshError && (
            <p className="text-sm" style={{ color: '#f87171' }}>⚠️ {refreshError}</p>
          )}
          <div className="ml-auto">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0',
              }}
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Yenileniyor...
                </>
              ) : (
                <>🔄 Yenile</>
              )}
            </button>
          </div>
        </div>

        {/* Otel kartları */}
        {statuses.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={glassCard}>
            <p className="text-sm" style={{ color: '#64748b' }}>Kayıtlı otel bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((status) => {
              const appliedCount = status.applied.length;
              const total = status.total_available;
              const isPending = status.pending.length > 0;

              return (
                <div
                  key={status.hotel_slug}
                  className="rounded-2xl p-5 transition-all"
                  style={{
                    background: isPending ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isPending
                      ? '1px solid rgba(245,158,11,0.25)'
                      : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🏨</span>
                        <h3 className="font-semibold truncate" style={{ color: '#f1f5f9' }}>
                          {status.hotel_name}
                        </h3>
                        <span className="font-mono text-xs shrink-0" style={{ color: '#64748b' }}>
                          ({status.hotel_slug})
                        </span>
                      </div>
                      <StatusBadge applied={appliedCount} total={total} />
                      {status.last_error && (
                        <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                          🔴 Son hata: v{status.last_error.version} —{' '}
                          {status.last_error.message.slice(0, 80)}
                          {status.last_error.message.length > 80 ? '...' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDetailModal(status)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#94a3b8',
                        }}
                      >
                        Detay
                      </button>
                      {isPending && (
                        <button
                          onClick={() => {
                            setUpdateModal(status);
                            setUpdateResult(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }}
                        >
                          Güncelle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Alt bilgi */}
        <p className="text-xs text-center mt-8" style={{ color: '#475569' }}>
          Giriş yapan: <strong style={{ color: '#64748b' }}>{adminUsername}</strong> · Sayfa yüklenme zamanı:{' '}
          {new Date().toLocaleString('tr-TR')}
        </p>
      </div>

      {/* Detay Modal */}
      {detailModal && (
        <DetailModal status={detailModal} onClose={() => setDetailModal(null)} />
      )}

      {/* Güncelleme Modal */}
      {updateModal && (
        <UpdateModal
          status={updateModal}
          onConfirm={handleRunMigration}
          onCancel={() => {
            if (!updateLoading) {
              setUpdateModal(null);
              setUpdateResult(null);
            }
          }}
          isLoading={updateLoading}
          result={updateResult}
        />
      )}
    </div>
  );
}
