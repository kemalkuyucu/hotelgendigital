'use client';

import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticleBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Particles
      id="landing-particles"
      className="landing-particles"
      options={{
        fpsLimit: 60,
        particles: {
          number: { value: 70, density: { enable: true, width: 900, height: 900 } },
          color: { value: ['#5b9eff', '#8b5cf6', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.15, max: 0.55 },
            animation: { enable: true, speed: 1, sync: false }
          },
          size: { value: { min: 1, max: 2.3 } },
          links: {
            enable: true,
            distance: 145,
            color: '#5b9eff',
            opacity: 0.14,
            width: 1
          },
          move: {
            enable: true,
            speed: 0.55,
            direction: 'none',
            random: true,
            straight: false,
            outModes: 'out'
          }
        },
        interactivity: {
          events: { onHover: { enable: true, mode: 'grab' }, resize: { enable: true } },
          modes: { grab: { distance: 180, links: { opacity: 0.45 } } }
        },
        detectRetina: true,
        background: { color: 'transparent' }
      }}
    />
  );
}
