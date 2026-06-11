'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type Row = {
  id: string;
  department_code: string;
  room_number: string | null;
  guest_full_name: string | null;
  request_text: string | null;
  created_at: string | null;
  forwarded_at: string | null;
  escalated_at: string | null;
  reception_responded_at: string | null;
  final_status: string | null;
  closed_at: string | null;
  reason: 'no_response' | 'sla_exceeded';
  elapsed_minutes: number;
  still_open: boolean;
};

const DEPT_LABELS: Record<string, string> = {
  front_office: 'On Buro',
  housekeeping: 'Kat Hizmetleri',
  technical: 'Teknik Servis',
  fb: 'F&B',
  guest_relation: 'Misafir Iliskileri',
  spa: 'Spa',
  animation: 'Animasyon',
};

const DEPT_OPTIONS = ['all', ...Object.keys(DEPT_LABELS)];

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function fmtElapsed(min: number): string {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}
function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

export default function EskalasyonClient() {
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const [department, setDepartment] = useState('all');
  const [start, setStart] = useState(daysAgoIso(7));
  const [end, setEnd] = useState(todayIso());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ department, start, end }).toString();
      const res = await fetch(`/api/hotel-admin/${slug}/eskalasyon?${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setRows(j.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [slug, department, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Eskalasyon</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
          SLA suresinde yanitlanmayan veya resepsiyonda yanitsiz kalan talepler. Tamamlananlar burada gorunmez.
        </p>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', margin: '16px 0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#cbd5e1' }}>
          Departman
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', fontSize: 14, background: '#1e293b', color: '#e2e8f0' }}
          >
            {DEPT_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'Hepsi' : DEPT_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#cbd5e1' }}>
          Baslangic
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', fontSize: 14, background: '#1e293b', color: '#e2e8f0', colorScheme: 'dark' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#cbd5e1' }}>
          Bitis
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', fontSize: 14, background: '#1e293b', color: '#e2e8f0', colorScheme: 'dark' }}
          />
        </label>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontSize: 14,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Yukleniyor...' : 'Yenile'}
        </button>
      </div>

      {/* Ozet */}
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        {loading ? 'Yukleniyor...' : `${rows.length} kayit`}
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
          Hata: {error}
        </div>
      )}

      {/* Tablo */}
      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          Bu araliki icin eskalasyon kaydi yok.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 10, background: 'rgba(15,23,42,0.6)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(30,41,59,0.9)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Departman</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Oda / Misafir</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Talep</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Saat</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Neden</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#cbd5e1' }}>Gecen sure</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {DEPT_LABELS[r.department_code] || r.department_code}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <strong>{r.room_number || '-'}</strong>
                    {r.guest_full_name ? ` / ${r.guest_full_name}` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 320 }}>{r.request_text || '-'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                    {fmtTime(r.escalated_at || r.forwarded_at || r.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {r.reason === 'no_response' ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        Resepsiyon yanit vermedi
                      </span>
                    ) : (
                      <span style={{ background: '#ffedd5', color: '#9a3412', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        SLA asildi
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {fmtElapsed(r.elapsed_minutes)}
                    {r.still_open ? <span style={{ color: '#dc2626', marginLeft: 6, fontSize: 12 }}>(acik)</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
