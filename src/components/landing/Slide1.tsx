'use client';

import { ContinueButton } from './SharedUI';

interface Slide1Props {
  onContinue: () => void;
  isActive?: boolean;
}

export default function Slide1({ onContinue, isActive }: Slide1Props) {
  return (
    <section id="slide-1" className={`slide-section ${isActive ? 'is-active' : ''}`}>
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow"></div>
          <svg className="hero-icon" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18"/>
            <path d="M5 21V7l8-4v18"/>
            <path d="M19 21V11l-6-4"/>
            <line x1="9" y1="9" x2="9" y2="9.01"/>
            <line x1="9" y1="12" x2="9" y2="12.01"/>
            <line x1="9" y1="15" x2="9" y2="15.01"/>
            <line x1="9" y1="18" x2="9" y2="18.01"/>
          </svg>
        </div>

        <h1 className="hero-title">7/24 Full Performanslı Birini İşe Almak Size ve Otelinize Ne Sağlayabilir?</h1>
        <p className="hero-subtitle">HotelGenDigital ile tanışma zamanı.</p>
        <p className="hero-paragraph">Hiç yorulmayan, asla hata yapmayan ve misafirinizin ne istediğini o daha söylemeden bilen bir ekip arkadaşı hayal edin. HotelGenDigital, operasyonun en karmaşık anlarında bile arka planda sessizce mükemmelliği yönetir. Siz kahvenizi yudumlarken, o her şeyi kontrol altında tutar. Oyunun kuralları artık değişiyor; sadece bir yazılım değil, otelinizin en sadık ve en zeki çalışanını işe alıyorsunuz.</p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
