import AdminLoginBackground from './_bg-client'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0a0f1e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Particle background layer */}
      <AdminLoginBackground />

      {/* Login card layer */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
