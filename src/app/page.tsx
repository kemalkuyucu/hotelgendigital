'use client';

import { useEffect, useRef, useState } from 'react';
import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';
import { TopButtons, FloatingRight, Pagination } from '@/components/landing/SharedUI';
import Slide1 from '@/components/landing/Slide1';
import Slide2 from '@/components/landing/Slide2';
import Slide3 from '@/components/landing/Slide3';
import Slide4 from '@/components/landing/Slide4';
import Slide5 from '@/components/landing/Slide5';
import Slide6 from '@/components/landing/Slide6';
import Slide7 from '@/components/landing/Slide7';

const TOTAL_SLIDES = 7;

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(1);

  const scrollToSlide = (n: number) => {
    const el = document.getElementById(`slide-${n}`);
    const root = rootRef.current;
    if (!el || !root) {
      console.warn('[scrollToSlide] el or root not found', { n });
      return;
    }
    const elRect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const offset = elRect.left - rootRect.left + root.scrollLeft;
    console.log('[scrollToSlide]', { n, offset, rootScrollLeft: root.scrollLeft });
    root.scrollTo({ left: offset, behavior: 'smooth' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.id;
            const n = parseInt(id.replace('slide-', ''), 10);
            if (!isNaN(n)) setActiveSlide(n);
          }
        });
      },
      {
        root: rootRef.current,
        threshold: 0.5,
      }
    );

    const sections = document.querySelectorAll('.slide-section');
    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root" ref={rootRef}>
      <CursorGlow />
      <ParticleBackground />

      <TopButtons />

      <div className="landing-container">
        <Slide1 onContinue={() => scrollToSlide(2)} isActive={activeSlide === 1} />
        <Slide2 onContinue={() => scrollToSlide(3)} isActive={activeSlide === 2} />
        <Slide3 onContinue={() => scrollToSlide(4)} isActive={activeSlide === 3} />
        <Slide4 onContinue={() => scrollToSlide(5)} isActive={activeSlide === 4} />
        <Slide5 onContinue={() => scrollToSlide(6)} isActive={activeSlide === 5} />
        <Slide6 onContinue={() => scrollToSlide(7)} isActive={activeSlide === 6} />
        <Slide7 isActive={activeSlide === 7} />
      </div>

      <Pagination
        total={TOTAL_SLIDES}
        active={activeSlide}
        onDotClick={scrollToSlide}
      />

      <FloatingRight />
    </div>
  );
}
