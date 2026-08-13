'use client'

/**
 * Kalici silme geri sayimi — PANEL SUNUMUNUN TEK KAYNAGI.
 *
 * KOK SORUN (31. otu, CANLI olculdu): ayni geri sayim IKI panelde ayri ayri
 * yazilmisti (`/admin/hotels` ve `/admin/migrations`). Otomatik silme
 * kapatilinca yalniz biri duzeltildi -> Oteller sayfasi "30 gun sonra kalici
 * silinebilir" derken Migrations sayfasi hala "30 gun kaldi" diyordu.
 * Ayni gercek icin iki panel FARKLI konusuyordu ve ikincisi bir VAAT uretiyordu
 * (CLAUDE.md §3 SAHTE VAAT YASAGI). Ucuncu bir kopya yazilirsa defekt yeniden
 * dogar -> metin/ton karari BURADA yasar, cagri yerinde YAZILMAZ.
 *
 * NE YAPMAZ: gun HESAPLAMAZ. Gun sayisi SUNUCUDAN gelir (`retention.ts`
 * `purgeInfo`) — istemci saati degistirilebilir ve cron'un esigiyle ayrisirsa
 * panel yalan soyler.
 *
 * Renk esikleri GORSEL, karar DEGIL: silme kararini `isPurgeDue` verir.
 */

const TONE_NEUTRAL = { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' }
const TONE_URGENT = { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' }
const TONE_SOON = { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' }

export interface PurgeCountdownProps {
  /** SUNUCUDA hesaplandi (`purgeInfo`). null -> otel silinmemis / tarih bozuk. */
  daysLeft: number | null
  /** ISO. Yalniz ipucu (title) metninde kullanilir. */
  purgeAt: string | null
  /** `hotels.purge_hold` — otomatik yol bu otel icin atlanir. */
  purgeHold: boolean
  /** `PURGE_AUTO_ENABLED` (SUNUCUDAN gelir). false -> kimse otomatik silmeyecek. */
  autoEnabled: boolean
}

export default function PurgeCountdown({
  daysLeft,
  purgeAt,
  purgeHold,
  autoEnabled,
}: PurgeCountdownProps) {
  if (daysLeft === null) return <span style={{ color: '#475569' }}>—</span>

  // Renk ACILIYET bildirir — aciliyet yoksa NOTR kalmak ZORUNDA:
  //  - otomatik silme GLOBAL kapaliysa kimse silmeyecek,
  //  - purge_hold ACIKSA cron o oteli atlar (gun sayisi yine isler).
  const tone =
    !autoEnabled || purgeHold
      ? TONE_NEUTRAL
      : daysLeft <= 1
        ? TONE_URGENT
        : daysLeft <= 7
          ? TONE_SOON
          : TONE_NEUTRAL

  // "silinecek" bir VAATtir; otomatik silme kapaliyken YALAN olur -> "silinebilir".
  const label = autoEnabled
    ? daysLeft === 0
      ? 'bugün silinecek'
      : `${daysLeft} gün kaldı`
    : daysLeft === 0
      ? 'kalıcı silinebilir'
      : `${daysLeft} gün sonra kalıcı silinebilir`

  const exact = purgeAt ? new Date(purgeAt).toLocaleString('tr-TR') : ''
  const hint = autoEnabled
    ? exact
      ? `Kalıcı silme: ${exact}`
      : undefined
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
      {autoEnabled && purgeHold && (
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
