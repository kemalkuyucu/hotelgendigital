'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
  borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px',
}

interface Guest {
  id: string; room_number: string; first_name: string | null; last_name: string
  phone: string | null; email: string | null; language: string; package: string | null
  check_in_date: string; check_out_date: string; is_active: boolean; notes: string | null
}

export default function EditGuestPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState(''); const [id, setId] = useState('')
  const [guest, setGuest] = useState<Guest | null>(null)
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => {
      setSlug(p.slug); setId(p.id)
      fetch(`/api/hotel-admin/${p.slug}/guests/${p.id}`)
        .then((r) => r.json())
        .then((json: { guest?: Guest; error?: string }) => {
          if (json.guest) setGuest(json.guest); else setError(json.error ?? 'Yüklenemedi.')
        })
        .catch(() => setError('Yüklenemedi.'))
        .finally(() => setLoading(false))
    })
  }, [params])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    const firstName = (fd.get('first_name') as string | null) ?? ''
    const lastName = (fd.get('last_name') as string | null) ?? ''
    const isActive = fd.get('is_active') === 'on'
    const body: Record<string, unknown> = {
      room_number: fd.get('room_number'), first_name: firstName || null, last_name: lastName,
      full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
      phone: fd.get('phone') || null, email: fd.get('email') || null,
      language: fd.get('language'), package: fd.get('package') || null,
      check_in_date: fd.get('check_in_date'), check_out_date: fd.get('check_out_date'),
      is_active: isActive, notes: fd.get('notes') || null,
    }
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/guests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Hata oluştu.')
      setSuccess('Misafir bilgileri güncellendi.')
      setTimeout(() => router.push(`/hotel-admin/${slug}/guests`), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", color: '#64748b' }}>Yükleniyor...</div>
  if (!guest) return <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}><div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '12px', padding: '24px', color: '#dc2626' }}>{error ?? 'Misafir bulunamadı.'}</div></div>

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '700px' }}>
      <div style={{ marginBottom: '28px' }}>
        <a href={`/hotel-admin/${slug}/guests`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: '13px' }}>← Misafir Listesine Dön</a>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '12px 0 4px' }}>Misafir Düzenle</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Oda {guest.room_number} — {guest.last_name}</p>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#dc2626', fontSize: '13.5px' }}>⚠️ {error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#16a34a', fontSize: '13.5px' }}>✓ {success}</div>}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Oda No *</label>
            <input name="room_number" required defaultValue={guest.room_number} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              <input name="is_active" type="checkbox" defaultChecked={guest.is_active} style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }} />
              Aktif (in-house)
            </label>
          </div>
          <div>
            <label style={labelStyle}>Ad</label>
            <input name="first_name" defaultValue={guest.first_name ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Soyad *</label>
            <input name="last_name" required defaultValue={guest.last_name} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input name="phone" type="tel" defaultValue={guest.phone ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>E-posta</label>
            <input name="email" type="email" defaultValue={guest.email ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Dil</label>
            <select name="language" defaultValue={guest.language} style={inputStyle}>
              <option value="tr">Türkçe (tr)</option>
              <option value="en">English (en)</option>
              <option value="de">Deutsch (de)</option>
              <option value="ru">Русский (ru)</option>
              <option value="ar">العربية (ar)</option>
              <option value="fr">Français (fr)</option>
              <option value="it">Italiano (it)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Paket</label>
            <select name="package" defaultValue={guest.package ?? ''} style={inputStyle}>
              <option value="">— Seçiniz —</option>
              <option value="basic">Basic</option>
              <option value="full">Full</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Giriş Tarihi *</label>
            <input name="check_in_date" type="date" required defaultValue={guest.check_in_date} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Çıkış Tarihi *</label>
            <input name="check_out_date" type="date" required defaultValue={guest.check_out_date} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notlar</label>
          <textarea name="notes" rows={3} defaultValue={guest.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
          <button type="submit" disabled={saving} style={{ padding: '12px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
          <a href={`/hotel-admin/${slug}/guests`} style={{ padding: '12px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 500, background: '#f1f5f9', color: '#475569', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            İptal
          </a>
        </div>
      </form>
    </div>
  )
}
