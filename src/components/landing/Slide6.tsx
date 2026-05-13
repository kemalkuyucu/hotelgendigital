'use client';

import { ContinueButton } from './SharedUI';

interface Slide6Props {
  onContinue: () => void;
  isActive?: boolean;
}

export default function Slide6({ onContinue, isActive }: Slide6Props) {
  return (
    <section id="slide-6" className={`slide-section ${isActive ? 'is-active' : ''}`}>
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-purple" />
          <svg
            className="hero-icon-chart"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line className="bar-1" x1="7" y1="20" x2="7" y2="13" />
            <line className="bar-2" x1="12" y1="20" x2="12" y2="8" />
            <line className="bar-3" x1="17" y1="20" x2="17" y2="11" />
            <line x1="3" y1="20" x2="21" y2="20" />
          </svg>
        </div>

        <h1 className="hero-title">
          Anlık Raporlama Gücü: Otelinizin Nabzı Bir Cümle Uzağınızda
        </h1>

        <p className="hero-paragraph">
          <strong>Rapor beklemekle vakit kaybetmeyin.</strong> Sesli veya yazılı bir talimatınız yeterli; istediğiniz tarih aralığındaki tüm veriler <strong>saniyeler içinde masanızda.</strong> Siz sadece sorun, <strong>HotelGenDigital anında yanıtlasın.</strong>
        </p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
