'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface ParseResult {
  headers: string[];
  sample_rows: Record<string, unknown>[];
  total_rows: number;
}

export default function FiyatUploadPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<'pick' | 'preview' | 'done' | 'error'>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sabit kolon eslemesi - sablon basliklarini dayatiyoruz
  const MAPPING = {
    room_type_col: 'Oda Tipi',
    capacity_col: 'Kapasite',
    kind_col: 'Tur',
    period_start_col: 'Periyot Baslangic',
    period_end_col: 'Periyot Bitis',
    price_col: 'Fiyat',
    currency_col: 'Para Birimi',
    board_col: 'Pansiyon',
  };

  async function handleFile(f: File) {
    setErrMsg('');
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrMsg('Lutfen .xlsx veya .xls uzantili bir dosya secin.');
      setStep('error');
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/hotel-admin/${slug}/fiyat/parse-excel`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dosya okunamadi');
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
      const res = await fetch(`/api/hotel-admin/${slug}/fiyat/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: MAPPING, file_base64: base64, file_name: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Yukleme tamamlanamadi');
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

  // --- stil paleti (sidebar koyu temasiyla uyumlu) ---
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
    padding: '12px 26px',
    borderRadius: 12,
    cursor: busy ? 'default' : 'pointer',
    fontWeight: 600,
    fontSize: 14,
    opacity: busy ? 0.6 : 1,
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  };
  const ghostBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '12px 24px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px', width: '100%' }}>
      {/* Baslik */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30 }}>🏷️</span>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
          Konaklama &amp; Rezervasyon Fiyatlari
        </h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 14.5, lineHeight: 1.6, maxWidth: 640 }}>
        Tatil (konaklama) ve gunubirlik fiyatlarinizi tek Excel ile yukleyin; bot aninda yeni listeyi
        okumaya baslar. Yeni yukleme mevcut listenin yerini alir. Tur sutununa &apos;Konaklama&apos;
        veya &apos;Gunubirlik&apos; yazin (bos birakirsaniz konaklama sayilir).
      </p>

      {/* Kolon sablonu rozetleri */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {['Oda Tipi', 'Kapasite', 'Tur', 'Periyot Baslangic', 'Periyot Bitis', 'Fiyat', 'Para Birimi', 'Pansiyon'].map((c) => (
          <span
            key={c}
            style={{
              fontSize: 12.5,
              color: '#a5b4fc',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              padding: '5px 12px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* PICK */}
      {step === 'pick' && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          style={{
            ...card,
            padding: '56px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: dragOver ? '#8b5cf6' : 'rgba(255,255,255,0.14)',
            background: dragOver ? 'rgba(139,92,246,0.08)' : card.background,
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.9 }}>📂</div>
          <p style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>
            {busy ? 'Dosya okunuyor…' : 'Excel dosyasını sürükleyin'}
          </p>
          <p style={{ color: '#64748b', fontSize: 13.5, margin: 0 }}>
            veya tıklayarak seçin · .xlsx / .xls · maks. 10 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            disabled={busy}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* PREVIEW */}
      {step === 'preview' && parsed && (
        <div style={{ ...card, padding: 28 }}>
          <p style={{ color: '#e2e8f0', fontSize: 15, margin: '0 0 18px' }}>
            <b style={{ color: '#a5b4fc' }}>{parsed.total_rows}</b> satır bulundu — ilk 3 satırın önizlemesi:
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h} style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.sample_rows.map((row, i) => (
                  <tr key={i}>
                    {parsed.headers.map((h) => (
                      <td key={h} style={{ padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleImport} disabled={busy} style={primaryBtn}>
              {busy ? 'Yükleniyor…' : 'Listeyi Yükle'}
            </button>
            <button onClick={reset} disabled={busy} style={ghostBtn}>İptal</button>
          </div>
        </div>
      )}

      {/* DONE */}
      {step === 'done' && (
        <div style={{ ...card, padding: 36, textAlign: 'center', borderColor: 'rgba(52,211,153,0.3)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px' }}>Liste yüklendi</p>
          <p style={{ color: '#94a3b8', fontSize: 14.5, margin: '0 0 22px' }}>
            <b style={{ color: '#34d399' }}>{resultCount}</b> fiyat satiri kaydedildi. Bot artık yeni listeyi okuyor.
          </p>
          <button onClick={reset} style={primaryBtn}>Yeni Yükleme</button>
        </div>
      )}

      {/* ERROR */}
      {step === 'error' && (
        <div style={{ ...card, padding: 32, borderColor: 'rgba(248,113,113,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <p style={{ color: '#fca5a5', fontSize: 15, fontWeight: 600, margin: 0 }}>Bir sorun oluştu</p>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: 14, margin: '0 0 22px', lineHeight: 1.6 }}>{errMsg}</p>
          <button onClick={reset} style={ghostBtn}>Tekrar Dene</button>
        </div>
      )}
    </div>
  );
}
