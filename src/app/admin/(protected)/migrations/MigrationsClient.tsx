'use client';

// =============================================================================
// src/app/admin/(protected)/migrations/MigrationsClient.tsx
// Client Component — Migration yönetim UI
// =============================================================================

import { useState, useCallback } from 'react';
import type { MigrationStatusReport } from '@/lib/migrations';

type StatusWithName = MigrationStatusReport & { hotel_name: string };

interface Props {
  initialStatuses: StatusWithName[];
  adminUsername: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yardımcı: Durum badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ applied, total }: { applied: number; total: number }) {
  if (applied === total) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
        ✅ Güncel ({applied}/{total})
      </span>
    );
  }
  const pending = total - applied;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
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
  const allVersions = ['001', '002', '003', '004', '005', '006'];
  const appliedVersions = new Set(status.applied.map((a) => a.version));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🏨 {status.hotel_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Migration detayları</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
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
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isApplied
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <span className="text-lg mt-0.5">{isApplied ? '✅' : '⏳'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-700">{version}</span>
                    <span className="text-sm font-medium text-gray-800">
                      {appliedRow?.name ?? getPendingName(version)}
                    </span>
                  </div>
                  {isApplied && appliedRow && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(appliedRow.appliedAt).toLocaleString('tr-TR')}
                    </p>
                  )}
                  {!isApplied && (
                    <p className="text-xs text-amber-700 mt-0.5">Henüz uygulanmadı</p>
                  )}
                </div>
              </div>
            );
          })}

          {status.last_error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-semibold text-red-800 mb-1">
                🔴 Son Hata — v{status.last_error.version}
              </p>
              <p className="text-xs text-red-700 font-mono break-all">
                {status.last_error.message}
              </p>
              <p className="text-xs text-red-500 mt-1">
                {new Date(status.last_error.at).toLocaleString('tr-TR')}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
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
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="text-5xl mb-4">{result.success ? '🎉' : '❌'}</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {result.success ? 'Güncelleme Tamamlandı' : 'Hata Oluştu'}
            </h2>
            {result.success ? (
              <p className="text-sm text-gray-600">
                {result.appliedCount} migration başarıyla uygulandı.
              </p>
            ) : (
              <p className="text-sm text-red-600 font-mono break-all">{result.error}</p>
            )}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          🔄 Güncelleme Onayı
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{status.hotel_name}</strong> oteli için{' '}
          <strong>{status.pending.length}</strong> bekleyen migration uygulanacak.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700 font-medium">Uygulanacak versiyonlar:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {status.pending.map((p) => (
              <span key={p.version} className="font-mono text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                {p.version}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
      // Hotel adlarını koru
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
        // Durumu yenile
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Üst başlık */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Veritabanı Sürümleri</h1>
          <p className="text-gray-600 mt-2 text-sm leading-relaxed">
            Her otelin veritabanının güncel olup olmadığını buradan kontrol edebilirsiniz.
            Eksik güncellemeler varsa <strong>&ldquo;Güncelle&rdquo;</strong> butonuna basın.
          </p>
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{totalHotels}</div>
            <div className="text-xs text-gray-500 mt-1">Toplam Otel</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-green-200 shadow-sm">
            <div className="text-2xl font-bold text-green-700">{upToDateCount}</div>
            <div className="text-xs text-gray-500 mt-1">Güncel</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
            <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-xs text-gray-500 mt-1">Güncelleme Bekliyor</div>
          </div>
        </div>

        {/* Yenile butonu */}
        <div className="flex justify-between items-center mb-4">
          {refreshError && (
            <p className="text-sm text-red-600">⚠️ {refreshError}</p>
          )}
          <div className="ml-auto">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
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
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">Kayıtlı otel bulunamadı.</p>
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
                  className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                    isPending
                      ? 'border-amber-200 hover:border-amber-300'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🏨</span>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {status.hotel_name}
                        </h3>
                        <span className="font-mono text-xs text-gray-400 shrink-0">
                          ({status.hotel_slug})
                        </span>
                      </div>
                      <StatusBadge applied={appliedCount} total={total} />
                      {status.last_error && (
                        <p className="text-xs text-red-600 mt-2">
                          🔴 Son hata: v{status.last_error.version} —{' '}
                          {status.last_error.message.slice(0, 80)}
                          {status.last_error.message.length > 80 ? '...' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDetailModal(status)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        Detay
                      </button>
                      {isPending && (
                        <button
                          onClick={() => {
                            setUpdateModal(status);
                            setUpdateResult(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
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
        <p className="text-xs text-gray-400 text-center mt-8">
          Giriş yapan: <strong>{adminUsername}</strong> · Sayfa yüklenme zamanı:{' '}
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
