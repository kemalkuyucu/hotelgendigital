'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// =============================================================================
// Onboarding Wizard — Client Component
// Adım 1: Otel Bilgileri + Supabase Bağlantısı
// Adım 2: Bootstrap → Migration Runner → İlk Admin → Tamamlandı
// =============================================================================

interface Package {
  id: string
  code: string
  display_name: string
}

interface ResumeHotel {
  id: string
  name: string
  slug: string
  package_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  is_demo: boolean
  is_healthy: boolean
  has_credentials: boolean
}

interface Props {
  packages: Package[]
  bootstrapSql: string
  resumeHotel: ResumeHotel | null
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error'
type MigrationStep = { version: string; status: 'pending' | 'ok' | 'error'; error?: string }

// ─── Utility ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Otel Bilgileri' },
    { n: 2, label: 'Sistem Kurulumu' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '32px' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: step >= s.n ? '#1d4ed8' : '#e5e7eb',
              color: step >= s.n ? '#fff' : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700,
              transition: 'all 0.3s',
              boxShadow: step === s.n ? '0 0 0 4px rgba(29,78,216,0.15)' : 'none',
            }}>
              {step > s.n ? '✓' : s.n}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: step === s.n ? 600 : 400,
              color: step >= s.n ? '#1d4ed8' : '#9ca3af',
              whiteSpace: 'nowrap',
            }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: '2px',
              background: step > s.n ? '#1d4ed8' : '#e5e7eb',
              margin: '0 12px', marginBottom: '22px',
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Input Component ─────────────────────────────────────────────────────────

function Field({
  label, required, children, hint,
}: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{hint}</p>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#fff',
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      style={{
        ...inputStyle,
        borderColor: focused ? '#3b82f6' : '#d1d5db',
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
        ...(props.style ?? {}),
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export default function OnboardingWizard({ packages, bootstrapSql, resumeHotel }: Props) {
  const router = useRouter()

  // State
  const [step, setStep] = useState<1 | 2>(resumeHotel?.has_credentials ? 2 : 1)
  const [hotelId, setHotelId] = useState<string>(resumeHotel?.id ?? '')
  const [hotelSlug, setHotelSlug] = useState<string>(resumeHotel?.slug ?? '')
  const [globalError, setGlobalError] = useState('')

  // Step 1 form
  const [name, setName] = useState(resumeHotel?.name ?? '')
  const [slug, setSlug] = useState(resumeHotel?.slug ?? '')
  const [packageId, setPackageId] = useState(resumeHotel?.package_id ?? '')
  const [contactName, setContactName] = useState(resumeHotel?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(resumeHotel?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(resumeHotel?.contact_email ?? '')
  const [address, setAddress] = useState(resumeHotel?.address ?? '')
  const [isDemo, setIsDemo] = useState(resumeHotel?.is_demo ?? false)

  // Supabase credentials
  const [supaUrl, setSupaUrl] = useState('')
  const [supaAnon, setSupaAnon] = useState('')
  const [supaServiceKey, setSupaServiceKey] = useState('')

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle')
  const [connMessage, setConnMessage] = useState('')
  const [step1Saving, setStep1Saving] = useState(false)
  const [step1Error, setStep1Error] = useState('')
  const [hotelCreated, setHotelCreated] = useState(!!resumeHotel?.id)
  const [isCreating, setIsCreating] = useState(false)

  // Step 2 state
  const [bootstrapChecked, setBootstrapChecked] = useState(false)
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([])
  const [migrationRunning, setMigrationRunning] = useState(false)
  const [migrationsDone, setMigrationsDone] = useState(resumeHotel?.is_healthy ?? false)
  const [migrationError, setMigrationError] = useState('')

  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [completed, setCompleted] = useState(resumeHotel?.is_healthy ?? false)

  const [copied, setCopied] = useState(false)
  const [loginLinkCopied, setLoginLinkCopied] = useState(false)

  const slugManuallyEdited = useRef(false)

  // Auto-slug from name
  useEffect(() => {
    if (!slugManuallyEdited.current && name) {
      setSlug(slugify(name))
    }
  }, [name])

  // ── Step 1: Create hotel ──────────────────────────────────────────────────

  async function handleCreateHotel() {
    setStep1Error('')
    setStep1Saving(true)
    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, slug, package_id: packageId,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          address: address || null,
          is_demo: isDemo,
        }),
      })
      const data = await res.json() as { id?: string; slug?: string; error?: string }
      if (!res.ok) {
        setStep1Error(data.error ?? 'Otel oluşturulamadı')
        return false
      }
      setHotelId(data.id!)
      setHotelSlug(data.slug!)
      setHotelCreated(true)
      return true
    } catch {
      setStep1Error('Ağ hatası, lütfen tekrar deneyin')
      return false
    } finally {
      setStep1Saving(false)
      setIsCreating(false)
    }
  }

  // ── Step 1: Test connection ───────────────────────────────────────────────

  async function handleTestConnection() {
    if (!supaUrl || !supaAnon || !supaServiceKey) {
      setConnMessage('Lütfen tüm Supabase alanlarını doldurun')
      setConnStatus('error')
      return
    }
    setConnStatus('testing')
    setConnMessage('')
    try {
      // hotelId must exist first
      const id = hotelId || (hotelCreated ? hotelId : null)
      if (!id) {
        setConnStatus('error')
        setConnMessage('Önce otel bilgilerini kaydedin')
        return
      }
      const res = await fetch(`/api/admin/hotels/${id}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supaUrl, anon: supaAnon, service_key: supaServiceKey }),
      })
      const data = await res.json() as { ok: boolean; message?: string; error?: string }
      if (data.ok) {
        setConnStatus('ok')
        setConnMessage(data.message ?? 'Bağlantı başarılı')
      } else {
        setConnStatus('error')
        setConnMessage(data.error ?? 'Bağlantı başarısız')
      }
    } catch {
      setConnStatus('error')
      setConnMessage('Ağ hatası')
    }
  }

  // ── Step 1: Save credentials + go to Step 2 ──────────────────────────────

  async function handleStep1Submit() {
    setStep1Error('')
    setGlobalError('')

    // 1) If hotel not created, create it first
    let currentHotelId = hotelId
    if (!hotelCreated) {
      if (!name || !slug || !packageId) {
        setStep1Error('Otel adı, slug ve paket zorunludur')
        return
      }
      setStep1Saving(true)
      const ok = await handleCreateHotel()
      setStep1Saving(false)
      if (!ok) return
      currentHotelId = hotelId
    }

    if (!supaUrl || !supaAnon || !supaServiceKey) {
      setStep1Error('Supabase bağlantı bilgilerini doldurun')
      return
    }

    if (connStatus !== 'ok') {
      setStep1Error('Devam etmek için bağlantıyı test edin ve başarılı olduğunu doğrulayın')
      return
    }

    // 2) Save credentials
    setStep1Saving(true)
    try {
      const res = await fetch(`/api/admin/hotels/${currentHotelId}/save-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supaUrl, anon: supaAnon, service_key: supaServiceKey }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (!data.ok) {
        setStep1Error(data.error ?? 'Credentials kaydedilemedi')
        return
      }
    } catch {
      setStep1Error('Ağ hatası')
      return
    } finally {
      setStep1Saving(false)
    }

    // Adım 2'ye geç
    setStep(2)
    // URL'i güncelle (resume desteği)
    window.history.replaceState(null, '', `/admin/hotels/onboarding?id=${currentHotelId}`)
  }

  // ── Step 2: Run migrations ────────────────────────────────────────────────

  async function handleRunMigrations() {
    setMigrationRunning(true)
    setMigrationError('')
    setMigrationSteps([])

    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/run-migrations`, {
        method: 'POST',
      })
      const data = await res.json() as {
        success: string[]
        failed: string | null
        error?: string
      }

      // Build step display
      const steps: MigrationStep[] = data.success.map((v) => ({
        version: v,
        status: 'ok',
      }))
      if (data.failed) {
        steps.push({ version: data.failed, status: 'error', error: data.error })
        setMigrationError(`${data.failed} migration'ı başarısız: ${data.error}`)
      } else {
        setMigrationsDone(true)
      }
      setMigrationSteps(steps)
    } catch (e) {
      setMigrationError(`Ağ hatası: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setMigrationRunning(false)
    }
  }

  // ── Step 2: Create first admin ────────────────────────────────────────────

  async function handleCreateAdmin() {
    if (!adminUsername || !adminPassword || !adminEmail) {
      setAdminError('Tüm alanlar zorunludur')
      return
    }
    setAdminSaving(true)
    setAdminError('')
    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/create-first-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword, email: adminEmail }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (!data.ok) {
        setAdminError(data.error ?? 'Kullanıcı oluşturulamadı')
        return
      }
      setCompleted(true)
    } catch {
      setAdminError('Ağ hatası')
    } finally {
      setAdminSaving(false)
    }
  }

  // ── Copy helpers ──────────────────────────────────────────────────────────

  const copyBootstrap = useCallback(() => {
    navigator.clipboard.writeText(bootstrapSql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [bootstrapSql])

  const loginLink = typeof window !== 'undefined'
    ? `${window.location.origin}/hotel-admin/${hotelSlug}/login`
    : `/hotel-admin/${hotelSlug}/login`

  function copyLoginLink() {
    navigator.clipboard.writeText(loginLink)
    setLoginLinkCopied(true)
    setTimeout(() => setLoginLinkCopied(false), 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
      padding: '40px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <a
            href="/admin/hotels"
            style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}
          >
            ← Oteller
          </a>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            Yeni Otel Kurulumu
          </h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Oteli sisteme ekle, Supabase bağlantısını kur ve migration'ları uygula.
          </p>
        </div>

        <StepIndicator step={step} />

        {globalError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px 16px', color: '#dc2626', fontSize: '13px', marginBottom: '20px',
          }}>
            ⚠️ {globalError}
          </div>
        )}

        {/* ─── STEP 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            {/* Section: Otel Bilgileri */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                🏨 Otel Bilgileri
              </h2>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Field label="Otel İsmi" required>
                  <Inp
                    id="hotel-name"
                    placeholder="Örn: Grand Palace Hotel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={hotelCreated}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="Slug" required hint="Küçük harf, rakam ve tire. URL'de görünür.">
                    <Inp
                      id="hotel-slug"
                      placeholder="grand-palace-hotel"
                      value={slug}
                      onChange={(e) => {
                        slugManuallyEdited.current = true
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      }}
                      style={{ fontFamily: 'monospace', fontSize: '13px' }}
                      disabled={hotelCreated}
                    />
                  </Field>
                  <Field label="Paket" required>
                    <select
                      id="hotel-package"
                      value={packageId}
                      onChange={(e) => setPackageId(e.target.value)}
                      disabled={hotelCreated}
                      style={{ ...inputStyle, background: hotelCreated ? '#f9fafb' : '#fff' }}
                    >
                      <option value="">Paket seçin...</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="İletişim Adı">
                    <Inp
                      placeholder="Ad Soyad"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      disabled={hotelCreated}
                    />
                  </Field>
                  <Field label="Telefon">
                    <Inp
                      placeholder="+90 500 000 00 00"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={hotelCreated}
                    />
                  </Field>
                </div>

                <Field label="E-posta">
                  <Inp
                    type="email"
                    placeholder="iletisim@otel.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={hotelCreated}
                  />
                </Field>

                <Field label="Adres">
                  <Inp
                    placeholder="Otel adresi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={hotelCreated}
                  />
                </Field>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isDemo}
                    onChange={(e) => setIsDemo(e.target.checked)}
                    disabled={hotelCreated}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Demo otel</span>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                      Demo oteller sunum amaçlıdır; gerçek müşteri verisi içermez ve istenildiğinde silinebilir.
                    </p>
                  </div>
                </label>

                {hotelCreated && (
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
                    padding: '10px 14px', fontSize: '13px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    ✅ Otel oluşturuldu → <code style={{ fontFamily: 'monospace' }}>{hotelId}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Supabase Bağlantısı */}
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                🔗 Supabase Bağlantısı
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280' }}>
                Bu otelin Supabase project bilgilerini girin. Bilgiler AES-256-GCM ile şifrelenip saklanır.
              </p>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Field label="Project URL" required hint="Örn: https://xxxxxxxxxxxx.supabase.co">
                  <Inp
                    id="supa-url"
                    name="sb_project_url_field"
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    value={supaUrl}
                    onChange={(e) => { setSupaUrl(e.target.value); setConnStatus('idle') }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    data-form-type="other"
                  />
                </Field>

                <Field label="anon (public) key" required>
                  <Inp
                    id="supa-anon"
                    name="sb_anon_key_field"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supaAnon}
                    onChange={(e) => { setSupaAnon(e.target.value); setConnStatus('idle') }}
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    data-form-type="other"
                  />
                </Field>

                <Field label="service_role key" required hint="Gizli tutulur, UI'da masked gösterilir.">
                  <Inp
                    id="supa-service-key"
                    name="sb_service_role_field"
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={supaServiceKey}
                    onChange={(e) => { setSupaServiceKey(e.target.value); setConnStatus('idle') }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    data-form-type="other"
                  />
                </Field>

                {/* Test Connection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    id="btn-test-connection"
                    type="button"
                    onClick={async () => {
                      // If hotel not yet created, create it first silently
                      if (!hotelCreated) {
                        if (!name || !slug || !packageId) {
                          setStep1Error('Önce otel adı, slug ve paket alanlarını doldurun')
                          return
                        }
                        setStep1Saving(true)
                        const ok = await handleCreateHotel()
                        setStep1Saving(false)
                        if (!ok) return
                      }
                      await handleTestConnection()
                    }}
                    disabled={connStatus === 'testing' || step1Saving}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: connStatus === 'testing' ? '#f3f4f6' : '#fff',
                      color: '#374151',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: connStatus === 'testing' ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {connStatus === 'testing' ? (
                      <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Test Ediliyor...</>
                    ) : '🔌 Test Bağlantı'}
                  </button>

                  {connStatus === 'ok' && (
                    <div style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: '#f0fdf4', border: '1px solid #bbf7d0',
                      color: '#15803d', fontSize: '13px', fontWeight: 600,
                    }}>
                      ✅ {connMessage}
                    </div>
                  )}
                  {connStatus === 'error' && (
                    <div style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: '#fef2f2', border: '1px solid #fecaca',
                      color: '#dc2626', fontSize: '13px',
                    }}>
                      ❌ {connMessage}
                    </div>
                  )}
                </div>
              </div>

              {step1Error && (
                <div style={{
                  marginTop: '16px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '8px', padding: '10px 14px',
                  fontSize: '13px', color: '#dc2626',
                }}>
                  ⚠️ {step1Error}
                </div>
              )}

              {/* Submit */}
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                <button
                  id="btn-step1-submit"
                  type="button"
                  onClick={handleStep1Submit}
                  disabled={step1Saving || isCreating || connStatus === 'testing'}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    background: (step1Saving || isCreating) ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: (step1Saving || isCreating) ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {isCreating ? '⏳ Oluşturuluyor...' : step1Saving ? '⏳ Kaydediliyor...' : 'Devam → Sistem Kurulumu'}
                </button>
                <a
                  href="/admin/hotels"
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    color: '#6b7280',
                    fontSize: '14px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  İptal
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 2a: Bootstrap SQL */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>🗃️</div>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                      Adım 1: Bootstrap SQL
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                      Otelin Supabase Dashboard → SQL Editor'a gidin ve aşağıdaki SQL'i çalıştırın.
                      Bu, migration runner'ın ihtiyaç duyduğu <code>exec_sql</code> fonksiyonunu oluşturur.
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '20px 28px' }}>
                <div style={{ position: 'relative' }}>
                  <pre style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: '10px',
                    padding: '20px',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    margin: 0,
                    fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
                  }}>
                    {bootstrapSql}
                  </pre>
                  <button
                    id="btn-copy-bootstrap"
                    onClick={copyBootstrap}
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      padding: '6px 12px', borderRadius: '6px',
                      border: 'none',
                      background: copied ? '#22c55e' : '#334155',
                      color: '#fff',
                      fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    {copied ? '✓ Kopyalandı' : 'Kopyala'}
                  </button>
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  marginTop: '16px', cursor: 'pointer',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: `2px solid ${bootstrapChecked ? '#22c55e' : '#e5e7eb'}`,
                  background: bootstrapChecked ? '#f0fdf4' : '#fafafa',
                  transition: 'all 0.2s',
                }}>
                  <input
                    id="bootstrap-check"
                    type="checkbox"
                    checked={bootstrapChecked}
                    onChange={(e) => setBootstrapChecked(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: bootstrapChecked ? '#15803d' : '#374151' }}>
                    {bootstrapChecked ? '✅ SQL Editor\'da çalıştırdım' : '☑ SQL Editor\'da çalıştırdım'}
                  </span>
                </label>
              </div>
            </div>

            {/* 2b: Migration Runner */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>⚙️</div>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                      Adım 2: Migration&apos;ları Uygula
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                      001–008 arası migration dosyaları sırayla tenant veritabanına uygulanacak.
                      Zaten uygulanmışlar atlanır (idempotent).
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '20px 28px' }}>
                {/* Migration steps progress */}
                {migrationSteps.length > 0 && (
                  <div style={{
                    marginBottom: '16px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                  }}>
                    {migrationSteps.map((ms) => (
                      <div key={ms.version} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '13px',
                      }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: ms.status === 'ok' ? '#15803d' : '#dc2626',
                        }}>
                          {ms.status === 'ok' ? '✅' : '❌'} {ms.version}
                        </span>
                        {ms.error && (
                          <span style={{ color: '#dc2626', fontSize: '12px' }}>— {ms.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {migrationsDone && (
                  <div style={{
                    marginBottom: '16px',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: '10px', padding: '12px 16px',
                    color: '#15803d', fontSize: '13px', fontWeight: 600,
                  }}>
                    ✅ Tüm migration&apos;lar başarıyla uygulandı!
                  </div>
                )}

                {migrationError && (
                  <div style={{
                    marginBottom: '16px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: '10px', padding: '12px 16px',
                    color: '#dc2626', fontSize: '13px',
                  }}>
                    ❌ {migrationError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    id="btn-run-migrations"
                    type="button"
                    onClick={handleRunMigrations}
                    disabled={!bootstrapChecked || migrationRunning || migrationsDone}
                    style={{
                      padding: '11px 24px',
                      borderRadius: '9px',
                      border: 'none',
                      background: !bootstrapChecked || migrationsDone ? '#e5e7eb'
                        : migrationRunning ? '#93c5fd'
                        : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                      color: !bootstrapChecked || migrationsDone ? '#9ca3af' : '#fff',
                      fontSize: '13px', fontWeight: 700,
                      cursor: !bootstrapChecked || migrationRunning || migrationsDone ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: !bootstrapChecked || migrationsDone ? 'none' : '0 4px 12px rgba(29,78,216,0.3)',
                    }}
                  >
                    {migrationRunning ? '⏳ Çalışıyor...' : migrationsDone ? '✅ Tamamlandı' : '▶ Migration\'ları Uygula'}
                  </button>

                  {migrationError && (
                    <button
                      id="btn-retry-migrations"
                      type="button"
                      onClick={handleRunMigrations}
                      disabled={migrationRunning}
                      style={{
                        padding: '11px 20px',
                        borderRadius: '9px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Tekrar Dene
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2c: İlk Yönetici */}
            {migrationsDone && !completed && (
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                overflow: 'hidden',
                animation: 'fadeIn 0.4s ease',
              }}>
                <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', flexShrink: 0,
                    }}>👤</div>
                    <div>
                      <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                        Adım 3: İlk Yönetici Kullanıcısı
                      </h2>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                        Otelin hotel-admin paneline giriş yapacak ilk kullanıcıyı oluşturun. Rol: <strong>owner</strong>.
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '24px 28px' }}>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <Field label="Kullanıcı Adı" required>
                      <Inp
                        id="admin-username"
                        placeholder="hotel_admin"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                      />
                    </Field>
                    <Field label="E-posta" required>
                      <Inp
                        id="admin-email"
                        type="email"
                        placeholder="admin@otel.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                      />
                    </Field>
                    <Field label="Şifre" required hint="En az 6 karakter.">
                      <Inp
                        id="admin-password"
                        type="password"
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                      />
                    </Field>
                  </div>

                  {adminError && (
                    <div style={{
                      marginTop: '12px',
                      background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '8px', padding: '10px 14px',
                      fontSize: '13px', color: '#dc2626',
                    }}>
                      ⚠️ {adminError}
                    </div>
                  )}

                  <button
                    id="btn-create-admin"
                    type="button"
                    onClick={handleCreateAdmin}
                    disabled={adminSaving}
                    style={{
                      marginTop: '20px',
                      padding: '12px 28px',
                      borderRadius: '10px', border: 'none',
                      background: adminSaving ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                      color: '#fff', fontSize: '14px', fontWeight: 700,
                      cursor: adminSaving ? 'wait' : 'pointer',
                      boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
                    }}
                  >
                    {adminSaving ? '⏳ Oluşturuluyor...' : '👤 Yönetici Oluştur'}
                  </button>
                </div>
              </div>
            )}

            {/* 2d: Tamamlandı */}
            {completed && (
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                borderRadius: '16px',
                border: '2px solid #86efac',
                boxShadow: '0 8px 32px rgba(34,197,94,0.15)',
                padding: '40px 32px',
                textAlign: 'center',
                animation: 'fadeIn 0.5s ease',
              }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', margin: '0 auto 20px',
                  boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
                }}>
                  🎉
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800, color: '#15803d' }}>
                  Kurulum Tamamlandı!
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#16a34a' }}>
                  <strong>{name}</strong> sisteme başarıyla eklendi ve hazır.
                </p>

                {/* Login link */}
                <div style={{
                  background: '#fff', borderRadius: '12px', border: '1px solid #bbf7d0',
                  padding: '16px 20px', marginBottom: '24px',
                  display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                  justifyContent: 'center',
                }}>
                  <code style={{
                    fontSize: '13px', fontFamily: 'monospace', color: '#1d4ed8',
                    background: '#eff6ff', padding: '6px 12px', borderRadius: '6px',
                    wordBreak: 'break-all',
                  }}>
                    {loginLink}
                  </code>
                  <button
                    id="btn-copy-login-link"
                    onClick={copyLoginLink}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: loginLinkCopied ? '#22c55e' : '#1d4ed8',
                      color: '#fff', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    {loginLinkCopied ? '✓ Kopyalandı' : '📋 Kopyala'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    id="btn-goto-hotel"
                    href={loginLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '12px 28px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #15803d, #22c55e)',
                      color: '#fff', fontSize: '14px', fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
                    }}
                  >
                    🏨 Otele Git
                  </a>
                  <button
                    onClick={() => router.push('/admin/hotels')}
                    style={{
                      padding: '12px 24px', borderRadius: '10px',
                      border: '1px solid #e5e7eb', background: '#fff',
                      color: '#374151', fontSize: '14px', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ← Oteller Listesi
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
