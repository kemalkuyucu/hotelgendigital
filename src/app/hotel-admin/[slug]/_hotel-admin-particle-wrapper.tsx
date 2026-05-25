'use client'

import dynamic from 'next/dynamic'

const ParticleBackground = dynamic(
  () => import('@/components/landing/ParticleBackground'),
  { ssr: false }
)

export default function HotelAdminParticleWrapper() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <ParticleBackground
        particleId="hotel-admin-panel-particles"
        opacity={0.3}
        particleCount={40}
        speed={0.35}
        linkOpacity={0.08}
        fpsLimit={30}
        disableOnMobile={true}
      />
    </div>
  )
}
