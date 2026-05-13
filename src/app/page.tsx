import CursorGlow from '@/components/landing/CursorGlow';
import ParticleBackground from '@/components/landing/ParticleBackground';

export default function LandingPage() {
  return (
    <div className="landing-root">
      <CursorGlow />
      <ParticleBackground />

      <div className="landing-container">
        <div className="top-buttons">
          <button className="btn-top btn-system">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Sisteme Giriş Yapın
          </button>
          <button className="btn-top btn-vip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            VIP Yönetici Girişi
          </button>
        </div>

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

          <button className="btn-cta">
            Devam Et
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>

        <div className="pagination">
          <div className="dot active"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>

        <div className="floating-right">
          <button className="float-btn" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button className="float-btn" aria-label="Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
