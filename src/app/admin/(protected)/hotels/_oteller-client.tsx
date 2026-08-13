'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type PackageRef = { display_name: string }

interface Hotel {
  id: string
  name: string
  slug: string
  status: string
  is_demo: boolean
  package_id: string | null
  packages: unknown
  deleted_at: string | null
  deleted_by: string | null
  /** true -> otomatik purge ATLANIR (geri sayim isler ama silme olmaz) */
  purge_hold?: boolean | null
  /** SUNUCUDA hesaplandi (retention.ts). Silinmemis otelde null. */
  purge_days_left: number | null
  purge_at: string | null
  purge_due: boolean
}

function getPackageName(packages: unknown): string | null {
  if (!packages) return null
  if (Array.isArray(packages)) return (packages as PackageRef[])[0]?.display_name ?? null
  return (packages as PackageRef).display_name ?? null
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-600',
    deleted: 'bg-red-200 text-red-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

// ─── Kalici silme geri sayimi ───────────────────────────────────────────────
// Renk esikleri GORSEL, karar DEGIL: silme kararini cron `isPurgeDue` ile verir.
// Gun sayisi burada HESAPLANMAZ, sunucudan gelir (retention.ts tek kaynak).

const TONE_NEUTRAL = { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' }

function PurgeCountdown({ hotel, autoEnabled }: { hotel: Hotel; autoEnabled: boolean }) {
  const d = hotel.purge_days_left
  if (d === null) return <span style={{ color: '#475569' }}>—</span>

  // Renk aciliyet BILDIRIR — aciliyet yoksa NOTR kalmak ZORUNDA:
  //  - otomatik silme GLOBAL kapaliysa kimse silmeyecek,
  //  - purge_hold ACIKSA cron o oteli atlar (gun sayisi yine isler).
  // Karar `purgeInfo`da DEGIL; esik/gun tek kaynakta kalir, yalniz SUNUM dallanir.
  const tone =
    !autoEnabled || hotel.purge_hold === true ? TONE_NEUTRAL
      : d <= 1 ? { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' }
        : d <= 7 ? { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' }
          : TONE_NEUTRAL

  // "silinecek" bir VAATtir; otomatik silme kapaliyken YALAN olur -> "silinebilir".
  const label = autoEnabled
    ? (d === 0 ? 'bugün silinecek' : `${d} gün kaldı`)
    : (d === 0 ? 'kalıcı silinebilir' : `${d} gün sonra kalıcı silinebilir`)

  const exact = hotel.purge_at ? new Date(hotel.purge_at).toLocaleString('tr-TR') : ''
  const hint = autoEnabled
    ? (exact ? `Kalıcı silme: ${exact}` : undefined)
    : `Otomatik kalıcı silme KAPALI — silme yalnız "Kalıcı Sil" ile yapılır${exact ? ` (eşik: ${exact})` : ''}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span
        title={hint}
        style={{
          display: 'inline-block',
          background: tone.bg,
          color: tone.fg,
          borderRadius: '999px',
          padding: '2px 9px',
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {/* Per-otel kilit rozeti YALNIZ otomatik silme ACIKKEN anlamlidir; global
          olarak kapaliyken "bu otel icin kapali" demek digerleri ACIK izlenimi
          verirdi. Bayrak DB'de KALIR, otomatik yol acilinca yeniden gorunur. */}
      {autoEnabled && hotel.purge_hold === true && (
        <span
          title="purge_hold açık: otomatik kalıcı silme bu otel için atlanır"
          style={{ fontSize: '11px', color: '#60a5fa', whiteSpace: 'nowrap' }}
        >
          ⏸ otomatik silme kapalı
        </span>
      )}
    </div>
  )
}

// ─── Delete Confirmation Modal ──────────────────────────────────────────────

interface DeleteModalProps {
  hotel: Hotel
  onClose: () => void
  onDeleted: () => void
}

function DeleteModal({ hotel, onClose, onDeleted }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const isMatch = confirmText === hotel.name

  async function handleDelete() {
    setError('')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotels/${hotel.id}/delete`, { method: 'POST' })
        const data = await res.json() as { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Silme işlemi başarısız')
          return
        }
        onDeleted()
      } catch {
        setError('Ağ hatası, lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        border: '1px solid #fee2e2',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            background: '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>⚠️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Otel Silinecek
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Bu işlem 30 gün içinde geri alınabilir
            </p>
          </div>
        </div>

        {/* Hotel name highlight */}
        <div style={{
          background: '#fef3f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#9ca3af' }}>Silinecek otel</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#dc2626', letterSpacing: '-0.5px' }}>
            {hotel.name}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>
            /{hotel.slug}
          </p>
        </div>

        {/* Warning */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#92400e',
          lineHeight: 1.5,
        }}>
          🕐 Bu işlem 30 gün içinde <strong>Silinmiş Oteller</strong> sekmesinden geri alınabilir.
          30 günü geçen silmeler kalıcı hale gelir.
        </div>

        {/* Confirm input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Onaylamak için otel ismini AYNEN yazın:
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={hotel.name}
            autoComplete="off"
            style={{
              width: '100%',
              border: `2px solid ${isMatch ? '#22c55e' : confirmText.length > 0 ? '#f87171' : '#d1d5db'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          {confirmText.length > 0 && !isMatch && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ef4444' }}>
              ✗ Otel ismiyle eşleşmiyor
            </p>
          )}
          {isMatch && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#22c55e' }}>
              ✓ Eşleşti
            </p>
          )}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#dc2626', marginBottom: '16px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            İptal
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || isPending}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '8px',
              border: 'none',
              background: isMatch && !isPending ? '#dc2626' : '#d1d5db',
              color: isMatch && !isPending ? '#fff' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isMatch && !isPending ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isPending ? 'Siliniyor...' : '🗑 Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Restore / Hard Delete buttons ─────────────────────────────────────────

function RestoreButton({ hotelId, onDone }: { hotelId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    startTransition(async () => {
      await fetch(`/api/admin/hotels/${hotelId}/restore`, { method: 'POST' })
      onDone()
    })
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      // Geri yukleme deleted_at'i NULL'lar -> retention saati SIFIRLANIR ve
      // planlanmis kalici silme kendiliginden IPTAL olur (ayri bir iptal yolu YOK).
      title="Geri yükleme kalıcı silmeyi de iptal eder"
      className="text-green-600 hover:text-green-700 font-medium text-sm disabled:opacity-50"
    >
      {isPending ? '...' : '↩ Geri Yükle'}
    </button>
  )
}

// ─── purge_hold toggle (otomatik silmeyi duraklat / devam ettir) ────────────
// Geri sayimi DURDURMAZ (deleted_at'e dokunmaz) — yalniz CRON'un o oteli
// atlamasini saglar. Manuel "Kalici Sil" bu kilidi ASAR (note'a yazilir).
// Islem GERI ALINABILIR oldugu icin onay modali YOKTUR.

function PurgeHoldToggle({ hotel, onDone }: { hotel: Hotel; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const held = hotel.purge_hold === true

  function handleToggle() {
    setError('')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotels/${hotel.id}/purge-hold`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hold: !held }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'İşlem başarısız')
          return
        }
        onDone()
      } catch {
        setError('Ağ hatası, lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <div style={{ marginTop: '5px' }}>
      <button
        id={`purge-hold-btn-${hotel.id}`}
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        title={
          held
            ? 'Otomatik kalıcı silmeyi yeniden etkinleştirir'
            : 'Otomatik kalıcı silmeyi duraklatır (geri sayım işlemeye devam eder)'
        }
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: '11px',
          fontWeight: 600,
          color: held ? '#34d399' : '#60a5fa',
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.5 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {isPending ? '...' : held ? '▶ Devam ettir' : '⏸ Otomatik silmeyi duraklat'}
      </button>
      {error && (
        <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>{error}</div>
      )}
    </div>
  )
}

// ─── Kalici Silme (purge) Modal ─────────────────────────────────────────────
// Onay metni SLUG'dir (soft-delete modalinda otel ADI istenir). Bilincli fark:
// slug teknik ve tekildir; "ayni isimli iki otel" karisikligi burada olmaz.

function PurgeModal({
  hotel,
  onClose,
  onPurged,
}: {
  hotel: Hotel
  onClose: () => void
  onPurged: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const isMatch = confirmText === hotel.slug

  function handlePurge() {
    setError('')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hotels/${hotel.id}/purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmSlug: confirmText }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Kalıcı silme başarısız')
          return
        }
        onPurged()
      } catch {
        setError('Ağ hatası, lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        border: '1px solid #fecaca',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            background: '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>🔥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Kalıcı Silme
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
              Bu işlem GERİ ALINAMAZ
            </p>
          </div>
        </div>

        <div style={{
          background: '#fef3f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#9ca3af' }}>Kalıcı silinecek otel</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#dc2626', letterSpacing: '-0.5px' }}>
            {hotel.name}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', fontFamily: 'monospace', color: '#6b7280' }}>
            {hotel.slug}
          </p>
        </div>

        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#92400e',
          lineHeight: 1.6,
        }}>
          Merkezi kayıtlar silinir: bridge bilgileri, kanal yönlendirmeleri, grup bağları.
          Denetim kaydı korunur.
          <br />
          <strong>⚠️ Otelin Supabase projesi elle silinecek</strong> — bu ekran onu silmez,
          proje referansı silme kaydına yazılır.
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Onaylamak için slug&apos;ı AYNEN yazın:
          </label>
          <input
            id="purge-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={hotel.slug}
            autoComplete="off"
            style={{
              width: '100%',
              border: `2px solid ${isMatch ? '#22c55e' : confirmText.length > 0 ? '#f87171' : '#d1d5db'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '14px',
              fontFamily: 'monospace',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {confirmText.length > 0 && !isMatch && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ef4444' }}>✗ Slug ile eşleşmiyor</p>
          )}
          {isMatch && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#22c55e' }}>✓ Eşleşti</p>}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#dc2626', marginBottom: '16px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px',
              border: '1px solid #d1d5db', background: '#fff', color: '#374151',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            İptal
          </button>
          <button
            id="confirm-purge-btn"
            type="button"
            onClick={handlePurge}
            disabled={!isMatch || isPending}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
              background: isMatch && !isPending ? '#b91c1c' : '#d1d5db',
              color: isMatch && !isPending ? '#fff' : '#9ca3af',
              fontSize: '14px', fontWeight: 600,
              cursor: isMatch && !isPending ? 'pointer' : 'not-allowed',
            }}
          >
            {isPending ? 'Siliniyor...' : '🔥 Kalıcı Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Client Component ──────────────────────────────────────────────────

interface OtellerClientProps {
  hotels: Hotel[]
  /** SUNUCUDAN gelir (`PURGE_AUTO_ENABLED`). Panel metni buna gore dallanir. */
  autoPurgeEnabled: boolean
}

export default function OtellerClient({ hotels, autoPurgeEnabled }: OtellerClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'active' | 'deleted'>('active')
  const [deleteTarget, setDeleteTarget] = useState<Hotel | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<Hotel | null>(null)

  const activeHotels = hotels.filter((h) => !h.deleted_at)
  const deletedHotels = hotels.filter((h) => !!h.deleted_at)

  const displayed = tab === 'active' ? activeHotels : deletedHotels

  function refresh() {
    setDeleteTarget(null)
    setPurgeTarget(null)
    router.refresh()
  }

  const tabBtn = (active: boolean) => ({
    padding: '8px 20px',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#1e40af' : 'transparent',
    color: active ? '#fff' : '#6b7280',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#f8fafc' }}>Oteller</h1>
          <p className="mt-1" style={{ color: '#94a3b8' }}>
            {activeHotels.length} aktif
            {deletedHotels.length > 0 && ` · ${deletedHotels.length} silinmiş`}
          </p>
        </div>
        <Link
          href="/admin/hotels/onboarding"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Yeni Otel
        </Link>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'inline-flex',
        background: '#f3f4f6',
        borderRadius: '10px',
        padding: '4px',
        gap: '2px',
      }}>
        <button id="tab-active-hotels" style={tabBtn(tab === 'active')} onClick={() => setTab('active')}>
          🏨 Aktif
          <span style={{
            marginLeft: '6px',
            background: tab === 'active' ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
            color: tab === 'active' ? '#fff' : '#6b7280',
            borderRadius: '999px',
            padding: '1px 7px',
            fontSize: '12px',
          }}>{activeHotels.length}</span>
        </button>
        <button id="tab-deleted-hotels" style={tabBtn(tab === 'deleted')} onClick={() => setTab('deleted')}>
          🗑 Silinmiş
          {deletedHotels.length > 0 && (
            <span style={{
              marginLeft: '6px',
              background: tab === 'deleted' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
              color: tab === 'deleted' ? '#fff' : '#dc2626',
              borderRadius: '999px',
              padding: '1px 7px',
              fontSize: '12px',
              fontWeight: 600,
            }}>{deletedHotels.length}</span>
          )}
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Otel</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Slug</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Paket</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Durum</th>
              {tab === 'deleted' && (
                <>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Silinme</th>
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Kalıcı Silme</th>
                </>
              )}
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length > 0 ? (
              displayed.map((h) => (
                <tr key={h.id} className={`transition-colors ${h.deleted_at ? 'opacity-60' : ''}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: '#f1f5f9' }}>{h.name}</span>
                      {h.is_demo && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          DEMO
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm" style={{ color: '#64748b' }}>{h.slug}</td>
                  <td className="p-4 text-sm" style={{ color: '#cbd5e1' }}>
                    {getPackageName(h.packages) ?? <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  {tab === 'deleted' && (
                    <>
                      <td className="p-4 text-xs" style={{ color: '#64748b' }}>
                        {h.deleted_at ? (
                          <div>
                            <div>{new Date(h.deleted_at).toLocaleDateString('tr-TR')}</div>
                            {h.deleted_by && <div style={{ color: '#475569' }}>@{h.deleted_by}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4">
                        <PurgeCountdown hotel={h} autoEnabled={autoPurgeEnabled} />
                        {/* Otomatik silme kapaliyken hold ANLAMSIZ -> toggle
                            RENDER EDILMEZ. API route ve kolon YERINDE DURUR. */}
                        {autoPurgeEnabled && <PurgeHoldToggle hotel={h} onDone={refresh} />}
                      </td>
                    </>
                  )}
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-sm">
                      {tab === 'active' ? (
                        <>
                          <Link href={`/admin/hotels/${h.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                            Düzenle
                          </Link>
                          <Link href={`/admin/hotels/${h.id}/credentials`} className="text-purple-600 hover:text-purple-700 font-medium">
                            Bridge
                          </Link>
                          <Link href={`/admin/hotels/${h.id}/vip-managers`} className="text-green-600 hover:text-green-700 font-medium">
                            VIP
                          </Link>
                          <button
                            id={`delete-btn-${h.id}`}
                            type="button"
                            onClick={() => setDeleteTarget(h)}
                            className="text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Sil
                          </button>
                        </>
                      ) : (
                        <>
                          <RestoreButton hotelId={h.id} onDone={refresh} />
                          <button
                            id={`purge-btn-${h.id}`}
                            type="button"
                            onClick={() => setPurgeTarget(h)}
                            className="text-red-600 hover:text-red-800 font-semibold transition-colors"
                            title="Merkezi kayıtları kalıcı olarak siler — geri alınamaz"
                          >
                            🔥 Kalıcı Sil
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tab === 'deleted' ? 7 : 5} className="p-8 text-center text-sm" style={{ color: '#64748b' }}>
                  {tab === 'active' ? (
                    <>
                      Henüz otel eklenmemiş.{' '}
                      <Link href="/admin/hotels/onboarding" style={{ color: '#60a5fa' }} className="hover:underline">
                        İlk oteli ekle →
                      </Link>
                    </>
                  ) : (
                    'Silinmiş otel yok.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

        {/* Delete modal */}
        {deleteTarget && (
          <DeleteModal
            hotel={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={refresh}
          />
        )}

        {/* Purge (kalici silme) modal */}
        {purgeTarget && (
          <PurgeModal
            hotel={purgeTarget}
            onClose={() => setPurgeTarget(null)}
            onPurged={refresh}
          />
        )}
    </div>
  )
}
