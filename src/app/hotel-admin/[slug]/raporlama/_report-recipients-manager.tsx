'use client';

import { useState, useEffect, useCallback } from 'react';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  platform: 'telegram' | 'whatsapp';
  platform_id: string;
  email: string | null;
  created_at: string;
}

const PLATFORMS: { value: 'telegram' | 'whatsapp'; label: string }[] = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const PLATFORM_LABEL: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

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
const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 9,
  color: '#f1f5f9',
  padding: '8px 11px',
  fontSize: 13.5,
  outline: 'none',
};

export default function ReportRecipientsManager({ slug }: { slug: string }) {
  const [items, setItems] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ekleme formu
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addPlatform, setAddPlatform] = useState<'telegram' | 'whatsapp'>('telegram');
  const [addPlatformId, setAddPlatformId] = useState('');
  const [addEmail, setAddEmail] = useState('');

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/report-recipients`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Liste alınamadı');
      setItems(data.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRecipient() {
    if (!addFirstName.trim()) {
      setError('Ad zorunlu');
      return;
    }
    if (!addLastName.trim()) {
      setError('Soyad zorunlu');
      return;
    }
    if (!addPlatformId.trim()) {
      setError('Platform ID zorunlu');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/report-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: addFirstName.trim(),
          last_name: addLastName.trim(),
          platform: addPlatform,
          platform_id: addPlatformId.trim(),
          email: addEmail.trim(),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError('Bu kişi zaten ekli');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Eklenemedi');
      // formu sıfırla
      setAddFirstName('');
      setAddLastName('');
      setAddPlatform('telegram');
      setAddPlatformId('');
      setAddEmail('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(id: string) {
    if (!window.confirm('Bu kişi raporlama listesinden silinsin mi? Emin misiniz?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hotel-admin/${slug}/report-recipients`, {
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

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '22px 14px' : '40px 24px', width: '100%' }}>
      {/* Baslik */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30 }}>📨</span>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
          Raporlama Kısmına Eklenecek Kişi
        </h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 14.5, lineHeight: 1.6, maxWidth: 620 }}>
        Otel raporlarının iletileceği kişileri buradan yönetebilirsiniz. Telegram veya WhatsApp
        platform kimliğiyle yeni kişi ekleyin, gerektiğinde listeden çıkarın.
      </p>

      {/* Hata */}
      {error && (
        <div style={{ ...card, padding: 14, marginBottom: 16, borderColor: 'rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ color: '#fca5a5', fontSize: 13.5 }}>{error}</span>
        </div>
      )}

      {/* Ekleme Formu */}
      <div style={{ ...card, padding: 22, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 12, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 160px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Ad</span>
            <input value={addFirstName} onChange={(e) => setAddFirstName(e.target.value)} style={inputStyle} placeholder="Örn. Ahmet" />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 160px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Soyad</span>
            <input value={addLastName} onChange={(e) => setAddLastName(e.target.value)} style={inputStyle} placeholder="Örn. Yılmaz" />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 1 150px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Platform</span>
            <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value as 'telegram' | 'whatsapp')} style={inputStyle}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 180px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Platform ID</span>
            <input value={addPlatformId} onChange={(e) => setAddPlatformId(e.target.value)} style={inputStyle} placeholder="Örn. 123456789" />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 220px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>E-posta (opsiyonel)</span>
            <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={inputStyle} placeholder="Örn. mudur@otel.com" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={addRecipient} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          Henüz kişi eklenmemiş. Yukarıdaki formdan rapor alıcısı ekleyebilirsiniz.
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((r) => (
            <div key={r.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                    {r.first_name} {r.last_name}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 11px', borderRadius: 999, fontWeight: 500 }}>
                      {PLATFORM_LABEL[r.platform] || r.platform}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13, wordBreak: 'break-all' }}>
                    ID: {r.platform_id}
                  </div>
                  {r.email && (
                    <div style={{ color: '#94a3b8', fontSize: 13, wordBreak: 'break-all', marginTop: 4 }}>
                      ✉️ {r.email}
                    </div>
                  )}
                </div>
                <button onClick={() => removeRecipient(r.id)} disabled={busy} style={{ ...dangerBtn, flexShrink: 0 }}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Ad Soyad</th>
                  <th style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Platform</th>
                  <th style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>ID</th>
                  <th style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>E-posta</th>
                  <th style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: '12px 18px', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 500 }}>
                      {r.first_name} {r.last_name}
                    </td>
                    <td style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 12, color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 11px', borderRadius: 999, fontWeight: 500 }}>
                        {PLATFORM_LABEL[r.platform] || r.platform}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.platform_id}</td>
                    <td style={{ padding: '12px 18px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.email || '—'}</td>
                    <td style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                      <button onClick={() => removeRecipient(r.id)} disabled={busy} style={dangerBtn}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
