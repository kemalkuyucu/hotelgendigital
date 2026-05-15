'use client';

interface Slide7Props {
  onContinue: () => void;
  isActive?: boolean;
}

export default function Slide7({ onContinue, isActive }: Slide7Props) {
  return (
    <section id="slide-7" className={`slide-section ${isActive ? 'is-active' : ''}`}>
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-teal" />
          <svg
            className="hero-icon-check"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <h1 className="hero-title">
          Tek Bir Amaç: Kusursuz Misafir Deneyimi ve Memnuniyeti, Sürdürülebilir Başarı
        </h1>

        <p className="hero-paragraph">
          Bizim için başarı; <strong>hatasız bir operasyon, mutlu bir misafir ve her geçen gün büyüyen bir işletmedir.</strong> Amacımız, otelinizi dijital çağın standartlarına taşıyarak size <strong>rakiplerinizin ötesinde bir vizyon kazandırmak.</strong> İşinizi geliştirmek ve yarını bugünden inşa etmek için ihtiyacınız olan her şeyi <strong>tek bir yapıda topladık.</strong> Şimdi, bu değişimin parçası olma zamanı.
        </p>

        <button className="cta-button" onClick={onContinue}>
          Evet, Kesinlikle Doğru.
        </button>
      </div>
    </section>
  );
}
