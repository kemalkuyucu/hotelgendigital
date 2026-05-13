'use client';

import { ContinueButton } from './SharedUI';

interface Slide2Props {
  onContinue: () => void;
}

export default function Slide2({ onContinue }: Slide2Props) {
  return (
    <section id="slide-2" className="slide-section">
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-cyan"></div>
          <svg className="hero-icon-globe" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>

        <h1 className="hero-title">Sınırsız Dil, Sıfır Hata: Dünyanın Tüm Dillerini Konuşan Bir Resepsiyonist</h1>
        <p className="hero-paragraph">Bilgi kirliliği ve yanlış yönlendirme, otelcilikte prestij kaybının en kısa yoludur. Bizim sistemimiz ise verdiğiniz bilgileri bir <strong>&ldquo;anayasa&rdquo; gibi benimser</strong>. Hangi dilde sorulursa sorulsun; kahvaltı saatinden iptal politikasına kadar her şeyi <strong>tam da sizin öğrettiğiniz gibi, sıfır hata payıyla yanıtlar</strong>. Personel yorulur veya unutur, ancak bu sistem sizin <strong>belirlediğiniz sınırların dışına asla çıkmadan</strong>, dünya dillerinde kusursuz bir hizmet sunar.</p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
