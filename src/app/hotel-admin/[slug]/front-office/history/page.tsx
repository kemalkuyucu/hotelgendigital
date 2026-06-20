/**
 * Modul 17a — Yukleme Gecmisi Sayfasi (Server Component)
 * inhouse_upload_history tablosundan gecmis yukleme kayitlarini listeler.
 */

import { redirect } from 'next/navigation'
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth'
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant'
import Link from 'next/link'

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager']

interface UploadRecord {
  id: string
  batch_id: string
  uploaded_by: string | null
  file_name: string | null
  inserted_count: number
  updated_count: number
  archived_count: number
  total_rows: number
  status: 'success' | 'partial' | 'failed'
  error_detail: string | null
  created_at: string
}

function statusBadge(status: UploadRecord['status']) {
  const map = {
    success: { label: 'Başarılı', bg: 'rgba(22,163,74,0.1)', color: '#15803d' },
    partial: { label: 'Kısmi', bg: 'rgba(234,179,8,0.1)', color: '#854d0e' },
    failed:  { label: 'Başarısız', bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export default async function HistoryPage({
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
        </div>
      </div>
    )
  }

  const tenant = await resolveTenantBySlug(slug)
  const { data: records } = await tenant.hotelSupabase
    .from('inhouse_upload_history')
    .select('id, batch_id, uploaded_by, file_name, inserted_count, updated_count, archived_count, total_rows, status, error_detail, created_at')
    .eq('hotel_slug', slug)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = (records ?? []) as UploadRecord[]

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ marginBottom: '6px' }}>
            <Link href={`/hotel-admin/${slug}/front-office`} style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>
              ← Geri
            </Link>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
            📜 Yükleme Geçmişi
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            Son 50 Excel yükleme işlemi
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
            padding: '11px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
          }}
        >
          ↑ Yeni Yükleme
        </Link>
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Henüz yükleme yapılmamış.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Tarih', 'Dosya', 'Yükleyen', 'Eklendi', 'Güncellendi', 'Arşivlendi', 'Durum'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < list.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500 }}>
                    {r.file_name ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {r.uploaded_by ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 700 }}>{r.inserted_count}</td>
                  <td style={{ padding: '12px 16px', color: '#0369a1', fontWeight: 700 }}>{r.updated_count}</td>
                  <td style={{ padding: '12px 16px', color: '#92400e', fontWeight: 700 }}>{r.archived_count}</td>
                  <td style={{ padding: '12px 16px' }}>{statusBadge(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
