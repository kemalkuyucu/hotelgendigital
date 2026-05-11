'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px',
}

export default function NewGuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // params resolve (use effect pattern for client component)
  if (!slug) {
    params.then((p) => setSlug(p.slug))
    return null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const body = {
      room_no: fd.get('room_no'),
      first_name: fd.get('first_name') || null,
      last_name: fd.get('last_name'),
      phone: fd.get('phone') || null,
      email: fd.get('email') || null,
      language: fd.get('language'),
      gender: fd.get('gender') || null,
      package: fd.get('package') || null,
      check_in_date: fd.get('check_in_date'),
      check_out_date: fd.get('check_out_date'),
      status: fd.get('status'),
      notes: fd.get('notes') || null,
    }

    try {
      const res = await fetch(`/api/hotel-admin/${slug}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Hata oluştu.')
      router.push(`/hotel-admin/${slug}/guests`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '40px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '700px' }}>
      <div style={{ marginBottom: '28px' }}>
        <a href={`/hotel-admin/${slug}/guests`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: '13px' }}>← Misafir Listesine Dön</a>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '12px 0 4px' }}>Yeni Misafir Ekle</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>In-house misafir kaydı oluşturun.</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#dc2626', fontSize: '13.5px' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Oda No *</label>
            <input name="room_no" required placeholder="215" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Durum</label>
            <select name="status" defaultValue="active" style={inputStyle}>
              <option value="active">Aktif</option>
              <option value="checked_out">Check-out</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ad</label>
            <input name="first_name" placeholder="Özgür" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Soyad *</label>
            <input name="last_name" required placeholder="Özen" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input name="phone" type="tel" placeholder="+905551112233" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>E-posta</label>
            <input name="email" type="email" placeholder="ozgur@ornek.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Dil</label>
            <select name="language" defaultValue="tr" style={inputStyle}>
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
            <label style={labelStyle}>Cinsiyet</label>
            <select name="gender" style={inputStyle}>
              <option value="">— Belirtilmedi —</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Paket</label>
            <select name="package" style={inputStyle}>
              <option value="">— Seçiniz —</option>
              <option value="basic">Basic</option>
              <option value="full">Full</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Giriş Tarihi *</label>
            <input name="check_in_date" type="date" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Çıkış Tarihi *</label>
            <input name="check_out_date" type="date" required style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notlar</label>
          <textarea name="notes" rows={3} placeholder="Opsiyonel notlar..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
              background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
            }}
          >
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
          <a
            href={`/hotel-admin/${slug}/guests`}
            style={{
              padding: '12px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
              background: '#f1f5f9', color: '#475569', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            İptal
          </a>
        </div>
      </form>
    </div>
  )
}
