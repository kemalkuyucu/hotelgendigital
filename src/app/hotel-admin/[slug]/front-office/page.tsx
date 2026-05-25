/**
 * Modul 17b — In-House Ana Sayfa (refactored)
 *
 * Server component: Aktif Misafir + Son Yukleme kartlari
 * Client component: <InhouseListClient /> - tarih filtre, tablo, checkbox, aksiyon
 *
 * Yetki: hotel_owner | front_office_manager
 */

import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import Link from 'next/link'
import InhouseListClient from './_inhouse-list-client'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

export default async function FrontOfficePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = await getHotelAdminFromCookie()

  if (!admin) redirect(`/hotel-admin/${slug}/login`)
  if (!ALLOWED_ROLES.includes(admin.role)) {
    return (
      <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>Yetkiniz Yok</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        </div>
      </div>
    )
  }

  const tenant = await resolveTenantBySlug(slug)

  // Aktif misafir sayisi
  const { count: activeCount } = await tenant.hotelSupabase
    .from('inhouse_guests_v2')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  // Son yukleme bilgisi
  const { data: lastUpload } = await tenant.hotelSupabase
    .from('inhouse_upload_history')
    .select('created_at, inserted_count, updated_count, archived_count, file_name')
    .eq('hotel_slug', slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const guestCount = activeCount ?? 0
  const hasGuests = guestCount > 0

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '960px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏨 In-House Misafir Listesi
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Otelde şu an konaklayan misafirlerin Excel tabanlı yönetimi
          </p>
        </div>
        <Link
          href={`/hotel-admin/${slug}/front-office/upload`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px 22px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(14,165,233,0.35)',
            flexShrink: 0,
          }}
        >
          ↑ Excel Yükle
        </Link>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>

        {/* Aktif Misafir Kartı */}
        <div style={{
          background: hasGuests ? 'rgba(14,165,233,0.12)' : 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: hasGuests ? '1px solid rgba(14,165,233,0.3)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: hasGuests ? '0 8px 32px rgba(14,165,233,0.15)' : 'none',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: hasGuests ? '#7dd3fc' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            Aktif Misafir
          </p>
          <p style={{ fontSize: '48px', fontWeight: 700, color: hasGuests ? '#f0f9ff' : '#e2e8f0', margin: 0, lineHeight: 1 }}>
            {guestCount}
          </p>
          <p style={{ fontSize: '12px', color: hasGuests ? '#93c5fd' : '#64748b', margin: '8px 0 0' }}>
            {hasGuests ? 'kişi konaklamakta' : 'henüz misafir yüklenmedi'}
          </p>
        </div>

        {/* Son Yükleme Kartı */}
        {lastUpload ? (
          <div style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
              Son Yükleme
            </p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 4px' }}>
              {lastUpload.file_name ?? 'Bilinmiyor'}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
              {new Date(lastUpload.created_at).toLocaleString('tr-TR')}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'Eklendi', val: lastUpload.inserted_count, color: '#4ade80' },
                { label: 'Güncellendi', val: lastUpload.updated_count, color: '#60a5fa' },
                { label: 'Arşivlendi', val: lastUpload.archived_count, color: '#fb923c' },
              ].map(({ label, val, color }) => (
                <span key={label} style={{ fontSize: '11px', fontWeight: 600, color, background: color + '22', padding: '2px 8px', borderRadius: '6px' }}>
                  {label}: {val}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', margin: 0 }}>
              Henüz yükleme yapılmadı
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)',
        marginBottom: '32px',
      }} />

      {/* ── In-House List Client Component ─────────────────────────────────── */}
      <InhouseListClient slug={slug} />

      {/* ── Geçmiş linki ───────────────────────────────────────────────────── */}
      <div style={{ marginTop: '32px', textAlign: 'right' }}>
        <Link
          href={`/hotel-admin/${slug}/front-office/history`}
          style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
        >
          📜 Yükleme geçmişini görüntüle →
        </Link>
      </div>
    </div>
  )
}
