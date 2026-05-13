'use client';

import { ContinueButton } from './SharedUI';

interface Slide3Props {
  onContinue: () => void;
}

export default function Slide3({ onContinue }: Slide3Props) {
  return (
    <section id="slide-3" className="slide-section">
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-green"></div>
          <svg className="hero-icon-clock" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <h1 className="hero-title">7/24 Kusursuz Mesai: Mazeretlerin Bittiği, Performansın Başladığı Nokta</h1>
        <p className="hero-paragraph">&ldquo;Bugün hastayım,&rdquo; &ldquo;Geç kaldım&rdquo; veya &ldquo;Yanlış anladım&rdquo; cümlelerini <strong>otelinizin lügatinden siliyoruz.</strong> Operasyonun sürekliliği artık tesadüflere veya bireysel ruh hallerine bağlı değil. HotelGenDigital, <strong>365 gün boyunca aynı enerji ve titizlikle</strong> görevini yerine getirir. Siz uyurken veya başka bir krizle uğraşırken, o nöbet yerini bir saniye bile terk etmeden otelinizi en iyi şekilde temsil etmeye devam eder. <strong>Denetlemeye gerek duymadığınız bir profesyonellik hayal edin.</strong></p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
