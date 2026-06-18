'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

interface ParseResult {
  headers: string[];
  sample_rows: Record<string, unknown>[];
  total_rows: number;
}

export default function MenuUploadPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<'pick' | 'preview' | 'done' | 'error'>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [resultCount, setResultCount] = useState(0);

  // Sabit kolon eslemesi - sablon basliklarini dayatiyoruz
  const MAPPING = {
    item_name_col: 'Urun Adi',
    category_col: 'Kategori',
    price_col: 'Fiyat',
    currency_col: 'Para Birimi',
    is_paid_col: 'Ucretli mi',
  };

  async function handleFile(f: File) {
    setErrMsg('');
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrMsg('Lutfen .xlsx veya .xls dosyasi secin.');
      setStep('error');
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/hotel-admin/${slug}/menu/parse-excel`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse hatasi');
      setParsed(data);
      setStep('preview');
    } catch (e) {
      setErrMsg((e as Error).message);
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setErrMsg('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/hotel-admin/${slug}/menu/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: MAPPING, file_base64: base64, file_name: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Yukleme hatasi');
      setResultCount(data.count || 0);
      setStep('done');
    } catch (e) {
      setErrMsg((e as Error).message);
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('pick');
    setFile(null);
    setParsed(null);
    setErrMsg('');
    setResultCount(0);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Room-Service Menu Yukle</h1>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        Excel sablonu kolonlari: <b>Urun Adi</b>, <b>Kategori</b>, <b>Fiyat</b>, <b>Para Birimi</b>, <b>Ucretli mi</b>.
        Yeni yukleme eski menunun TAMAMINI degistirir.
      </p>

      {step === 'pick' && (
        <div
          style={{ border: '2px dashed #ccc', borderRadius: 12, padding: 40, textAlign: 'center' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          <p style={{ marginBottom: 16 }}>Excel dosyasini buraya surukleyin veya secin</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            disabled={busy}
          />
          {busy && <p style={{ marginTop: 12, color: '#888' }}>Okunuyor...</p>}
        </div>
      )}

      {step === 'preview' && parsed && (
        <div>
          <p style={{ marginBottom: 12 }}>
            <b>{parsed.total_rows}</b> satir bulundu. Onizleme (ilk 3 satir):
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h} style={{ border: '1px solid #ddd', padding: 8, background: '#f5f5f5', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.sample_rows.map((row, i) => (
                  <tr key={i}>
                    {parsed.headers.map((h) => (
                      <td key={h} style={{ border: '1px solid #ddd', padding: 8 }}>{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleImport} disabled={busy} style={{ background: '#0a7', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', marginRight: 8 }}>
            {busy ? 'Yukleniyor...' : 'Menuyu Yukle'}
          </button>
          <button onClick={reset} disabled={busy} style={{ background: '#eee', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>
            Iptal
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ background: '#e6f7ef', border: '1px solid #0a7', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Menu basariyla yuklendi.</p>
          <p style={{ color: '#666', marginBottom: 16 }}>{resultCount} urun kaydedildi. Bot artik yeni menuyu okuyor.</p>
          <button onClick={reset} style={{ background: '#0a7', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>
            Yeni Yukleme
          </button>
        </div>
      )}

      {step === 'error' && (
        <div style={{ background: '#fdeaea', border: '1px solid #d33', borderRadius: 12, padding: 24 }}>
          <p style={{ color: '#d33', marginBottom: 16 }}>Hata: {errMsg}</p>
          <button onClick={reset} style={{ background: '#eee', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}
