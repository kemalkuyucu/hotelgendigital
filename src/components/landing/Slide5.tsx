'use client';

import { ContinueButton } from './SharedUI';

interface Slide5Props {
  onContinue: () => void;
  isActive?: boolean;
}

export default function Slide5({ onContinue, isActive }: Slide5Props) {
  return (
    <section id="slide-5" className={`slide-section ${isActive ? 'is-active' : ''}`}>
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-pink" />
          <svg
            className="hero-icon-heart"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            <path d="M3.22 12h6l2-3 3 5 2-2h4.56" />
          </svg>
        </div>

        <h1 className="hero-title">
          Misafir Güvenliği: Bir Soruyla Hayat Kurtaran Sistem
        </h1>

        <p className="hero-paragraph">
          Bir misafirin yemek siparişi verdiği an, <strong>sistemimiz otomatik olarak alerjen bilgisini sorar.</strong> Nazik, empatik ve sadece bir kez. Yanıt anında <strong>mutfağa ve misafir ilişkilerine iletilir;</strong> oda servisi olsun, restoran olsun fark etmez. Personel unuttuysa bile <strong>sistem asla unutmaz.</strong> Bir fındık alerjisi bildirilmediğinde yaşanabilecek kriz, sadece bir kötü yorum değildir; <strong>bir hayat meselesidir.</strong> HotelGenDigital, otelinizi korurken misafirinize &ldquo;biz sizi gerçekten önemsiyoruz&rdquo; mesajını verir. <strong>Güvenlik en büyük lükstür ve bu lüks artık otomatiktir.</strong>
        </p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
