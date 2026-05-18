'use client'

/**
 * Modul 17a — Excel Yukleme Sayfasi (Client Component)
 * 1. Surukle-birak veya dosya sec ile .xlsx / .xls kabul eder
 * 2. /api/hotel-admin/[slug]/inhouse/parse-excel'e POST eder
 * 3. Kullanici Mapping Onay ekranini gorur, mapping'i onayla veya degistir
 * 4. /api/hotel-admin/[slug]/inhouse/import'a POST eder
 * 5. Sonucu gosterir
 */

import { useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParseResult {
  headers: string[]
  sample_rows: Record<string, unknown>[]
  suggested_mapping: ColumnMapping
  saved_mapping: ColumnMapping | null
}

interface ColumnMapping {
  room_number: string | null
  agency: string | null
  guest_name: string | null
  guest_count: string | null
  check_in: string | null
  check_out: string | null
}

interface ImportResult {
  inserted: number
  updated: number
  archived: number
  batch_id: string
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  room_number: 'Oda Numarası',
  agency: 'Acenta',
  guest_name: 'Misafir Adı Soyadı',
  guest_count: 'Kişi Sayısı',
  check_in: 'Giriş Tarihi',
  check_out: 'Çıkış Tarihi',
}

const FIELD_REQUIRED: Record<keyof ColumnMapping, boolean> = {
  room_number: true,
  agency: false,
  guest_name: true,
  guest_count: false,
  check_in: true,
  check_out: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'pick' | 'parsing' | 'mapping' | 'importing' | 'done' | 'error'>('pick')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({
    room_number: null,
    agency: null,
    guest_name: null,
    guest_count: null,
    check_in: null,
    check_out: null,
  })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------- Dosya secimi ----------

  const handleFile = useCallback(async (f: File) => {
    // Boyut kontrolu (10 MB)
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('Dosya boyutu 10 MB sınırını aşıyor.')
      setStep('error')
      return
    }
    // Uzanti kontrolu
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      setErrorMsg('Yalnızca .xlsx veya .xls dosyaları kabul edilmektedir.')
      setStep('error')
      return
    }

    setFile(f)
    setStep('parsing')
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('file', f)

      const res = await fetch(`/api/hotel-admin/${slug}/inhouse/parse-excel`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Parse hatası.')

      const pr = json as ParseResult
      setParseResult(pr)

      // Mapping'i yerleştir: saved_mapping > suggested_mapping
      const base = pr.saved_mapping ?? pr.suggested_mapping
      setMapping({
        room_number: base.room_number ?? null,
        agency: base.agency ?? null,
        guest_name: base.guest_name ?? null,
        guest_count: base.guest_count ?? null,
        check_in: base.check_in ?? null,
        check_out: base.check_out ?? null,
      })

      setStep('mapping')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.')
      setStep('error')
    }
  }, [slug])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  // ---------- Import ----------

  const handleImport = async () => {
    if (!file || !parseResult) return

    // Zorunlu alanlar kontrolu
    for (const [key, required] of Object.entries(FIELD_REQUIRED)) {
      if (required && !mapping[key as keyof ColumnMapping]) {
        setErrorMsg(`"${FIELD_LABELS[key as keyof ColumnMapping]}" alanı zorunludur, lütfen bir kolon seçin.`)
        return
      }
    }

    setStep('importing')
    setErrorMsg('')

    try {
      // Dosyayi base64'e cevir
      const arrayBuf = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)
      let binary = ''
      uint8.forEach(b => { binary += String.fromCharCode(b) })
      const file_base64 = btoa(binary)

      const res = await fetch(`/api/hotel-admin/${slug}/inhouse/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping, file_base64, file_name: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import hatası.')

      setImportResult(json as ImportResult)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.')
      setStep('error')
    }
  }

  const reset = () => {
    setFile(null)
    setStep('pick')
    setParseResult(null)
    setMapping({ room_number: null, agency: null, guest_name: null, guest_count: null, check_in: null, check_out: null })
    setImportResult(null)
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const container: React.CSSProperties = {
    padding: '40px',
    fontFamily: "'Inter', system-ui, sans-serif",
    maxWidth: '760px',
  }

  return (
    <div style={container}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Link
            href={`/hotel-admin/${slug}/front-office`}
            style={{ color: '#64748b', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ← Geri
          </Link>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          ↑ Excel Yükle
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Günlük in-house misafir listesini Excel dosyası olarak yükleyin. Sistem otomatik eşleştirir.
        </p>
      </div>

      {/* ---- STEP: PICK ---- */}
      {step === 'pick' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? '#0ea5e9' : '#cbd5e1'}`,
            borderRadius: '20px',
            padding: '60px 40px',
            textAlign: 'center',
            background: dragOver ? 'rgba(14,165,233,0.05)' : '#f8fafc',
            transition: 'all 0.2s',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>📂</div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>
            Excel dosyasını buraya sürükleyin
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px' }}>
            veya aşağıdaki butona tıklayın • .xlsx / .xls • Maks 10 MB
          </p>
          <button
            id="fo-upload-browse-btn"
            type="button"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
            }}
          >
            Dosya Seç
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={onInputChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* ---- STEP: PARSING ---- */}
      {step === 'parsing' && (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>Dosya analiz ediliyor...</p>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Haiku AI kolon başlıklarını eşleştiriyor</p>
        </div>
      )}

      {/* ---- STEP: MAPPING ---- */}
      {step === 'mapping' && parseResult && (
        <div>
          {/* Onay Banner */}
          {parseResult.saved_mapping ? (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              padding: '16px 20px', marginBottom: '20px',
              background: 'rgba(16,185,129,0.07)',
              border: '1.5px solid rgba(16,185,129,0.3)',
              borderRadius: '14px',
            }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>💾</span>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#065f46' }}>
                  Kayıtlı eşleştirme yüklendi
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#047857' }}>
                  Bu otel için daha önce onaylanmış bir kolon eşleştirmesi bulundu ve otomatik seçildi.
                  Gerekirse aşağıdan değiştirebilirsiniz.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              padding: '16px 20px', marginBottom: '20px',
              background: 'rgba(139,92,246,0.07)',
              border: '1.5px solid rgba(139,92,246,0.25)',
              borderRadius: '14px',
            }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>🤖</span>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#5b21b6' }}>
                  Haiku AI önerisi — lütfen kontrol edin
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6d28d9' }}>
                  Bu otelden ilk yükleme yapılıyor. Yapay zeka kolon eşleştirmesi yaptı;
                  onbüro lütfen aşağıdaki tabloyu doğrulayın.
                </p>
              </div>
            </div>
          )}

          {/* Dosya bilgisi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 16px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '12px' }}>
            <span style={{ fontSize: '22px' }}>📄</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{file?.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{parseResult.headers.length} kolon • {parseResult.sample_rows.length} örnek satır</p>
            </div>
          </div>

          {/* ---- Mapping Onay Tablosu ---- */}
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
            {/* Tablo başlığı */}
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
                📋 Mapping Onay
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Sistemin hangi Excel kolonunu hangi alana eşleştirdiğini kontrol edin. Yıldız (*) ile işaretli alanlar zorunludur.
              </p>
            </div>

            {/* Tablo */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', width: '35%' }}>Bizim Alan</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Excel Kolonu</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', width: '80px' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(FIELD_LABELS) as Array<keyof ColumnMapping>).map((field, idx) => {
                  const isRequired = FIELD_REQUIRED[field]
                  const selectedCol = mapping[field]
                  const isMatched = !!selectedCol

                  return (
                    <tr
                      key={field}
                      style={{
                        borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                        background: isMatched ? 'rgba(16,185,129,0.025)' : isRequired ? 'rgba(239,68,68,0.025)' : '#fff',
                      }}
                    >
                      {/* Alan adı */}
                      <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                          {FIELD_LABELS[field]}
                        </span>
                        {isRequired && (
                          <span style={{ marginLeft: '4px', fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>*</span>
                        )}
                        {!isRequired && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>(opsiyonel)</span>
                        )}
                      </td>

                      {/* Dropdown */}
                      <td style={{ padding: '10px 20px', verticalAlign: 'middle' }}>
                        <select
                          value={selectedCol ?? ''}
                          onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value || null }))}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${
                              isMatched
                                ? 'rgba(16,185,129,0.4)'
                                : isRequired
                                ? 'rgba(239,68,68,0.3)'
                                : '#e2e8f0'
                            }`,
                            fontSize: '13px',
                            color: isMatched ? '#065f46' : isRequired ? '#b91c1c' : '#94a3b8',
                            background: '#fff',
                            outline: 'none',
                            cursor: 'pointer',
                            fontWeight: isMatched ? 600 : 400,
                          }}
                        >
                          <option value="">{isRequired ? '— Seçilmedi (zorunlu) —' : '— Eşleştirme yok —'}</option>
                          {parseResult.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>

                      {/* Durum ikonu */}
                      <td style={{ padding: '12px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {isMatched ? (
                          <span title="Eşleşti" style={{ fontSize: '18px' }}>✅</span>
                        ) : isRequired ? (
                          <span title="Zorunlu alan eşleştirilmedi" style={{ fontSize: '18px' }}>⚠️</span>
                        ) : (
                          <span title="Opsiyonel, boş bırakılabilir" style={{ fontSize: '16px', opacity: 0.4 }}>➖</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Örnek Veri Önizleme */}
          {parseResult.sample_rows.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '24px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>
                🔍 İlk {parseResult.sample_rows.length} Satır Önizleme
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {parseResult.headers.map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.sample_rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {parseResult.headers.map((h) => (
                        <td key={h} style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {String(row[h] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hata mesaji */}
          {errorMsg && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              id="fo-import-btn"
              type="button"
              onClick={handleImport}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
              }}
            >
              ✅ Onayla ve Yükle
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '14px 24px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP: IMPORTING ---- */}
      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⬆️</div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>Misafirler yükleniyor...</p>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Lütfen bekleyin</p>
        </div>
      )}

      {/* ---- STEP: DONE ---- */}
      {step === 'done' && importResult && (
        <div style={{ textAlign: 'center', padding: '50px 40px', background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#065f46', margin: '0 0 16px' }}>
            Yükleme Başarılı!
          </h2>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
            {[
              { label: 'Eklendi', val: importResult.inserted, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
              { label: 'Güncellendi', val: importResult.updated, color: '#0369a1', bg: 'rgba(3,105,161,0.1)' },
              { label: 'Arşivlendi', val: importResult.archived, color: '#92400e', bg: 'rgba(146,64,14,0.1)' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: '12px', padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', fontWeight: 700, color, margin: 0 }}>{val}</p>
                <p style={{ fontSize: '12px', color, fontWeight: 600, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href={`/hotel-admin/${slug}/front-office`}
              style={{
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                color: '#fff',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              📋 Misafir Listesi
            </Link>
            <button
              type="button"
              onClick={reset}
              style={{ padding: '12px 24px', background: '#fff', border: '1px solid #d1fae5', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#065f46', cursor: 'pointer' }}
            >
              Yeni Yükleme
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP: ERROR ---- */}
      {step === 'error' && (
        <div style={{ textAlign: 'center', padding: '50px 40px', background: 'rgba(239,68,68,0.04)', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>Bir Hata Oluştu</h2>
          <p style={{ color: '#ef4444', fontSize: '14px', margin: '0 0 24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#fff',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#dc2626',
              cursor: 'pointer',
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  )
}
