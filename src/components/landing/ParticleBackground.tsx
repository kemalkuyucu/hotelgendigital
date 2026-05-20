'use client';

import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

interface ParticleBackgroundProps {
  /** Unique DOM id — change when using multiple instances on the same page */
  particleId?: string;
  /** Max particle opacity (min is half of this). Default: 0.55 */
  opacity?: number;
  /** Number of particles. Default: 70 */
  particleCount?: number;
  /** Movement speed. Default: 0.55 */
  speed?: number;
  /** Link line opacity. Default: 0.14 */
  linkOpacity?: number;
  /** FPS cap. Default: 60 */
  fpsLimit?: number;
  /** When true, renders nothing on small screens (≤768 px). Default: false */
  disableOnMobile?: boolean;
}

export default function ParticleBackground({
  particleId = 'landing-particles',
  opacity = 0.55,
  particleCount = 70,
  speed = 0.55,
  linkOpacity = 0.14,
  fpsLimit = 60,
  disableOnMobile = false,
}: ParticleBackgroundProps) {
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (disableOnMobile) {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    }
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, [disableOnMobile]);

  if (!ready) return null;
  if (disableOnMobile && isMobile) return null;

  return (
    <Particles
      id={particleId}
      className="landing-particles"
      options={{
        fpsLimit,
        particles: {
          number: { value: particleCount, density: { enable: true, width: 900, height: 900 } },
          color: { value: ['#5b9eff', '#8b5cf6', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: opacity * 0.27, max: opacity },
            animation: { enable: true, speed: 0.8, sync: false },
          },
          size: { value: { min: 1, max: 2.3 } },
          links: {
            enable: true,
            distance: 145,
            color: '#5b9eff',
            opacity: linkOpacity,
            width: 1,
          },
          move: {
            enable: true,
            speed,
            direction: 'none',
            random: true,
            straight: false,
            outModes: 'out',
          },
        },
        interactivity: {
          events: { onHover: { enable: true, mode: 'grab' }, resize: { enable: true } },
          modes: { grab: { distance: 180, links: { opacity: 0.45 } } },
        },
        detectRetina: true,
        background: { color: 'transparent' },
      }}
    />
  );
}
