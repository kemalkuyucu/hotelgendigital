'use client';

import { ContinueButton } from './SharedUI';

interface Slide4Props {
  onContinue: () => void;
  isActive?: boolean;
}

export default function Slide4({ onContinue, isActive }: Slide4Props) {
  return (
    <section id="slide-4" className={`slide-section ${isActive ? 'is-active' : ''}`}>
      <div className="hero-content">
        <div className="hero-icon-wrapper">
          <div className="hero-icon-glow-orange" />
          <svg
            className="hero-icon-bell"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>

        <h1 className="hero-title">
          Anında Doğru Departman: Hata Payı Olmayan Bir Yönlendirme Sistemi
        </h1>

        <p className="hero-paragraph">
          <strong>Otelcilikte hız, en büyük lükstür.</strong> Yanlış departmana iletilen bir
          şikayet, geri dönülemez bir kötü yoruma dönüşebilir. Sistemimiz, misafirin her
          kelimesini anlar ve{' '}
          <strong>ilgili departmanı (F&amp;B, Resepsiyon veya Teknik) anında ayağa kaldırır.</strong>{' '}
          Personeliniz sadece kendi görev alanına giren işlerin bildirimini alırken, yönetim
          olarak siz tüm bu trafiğin kusursuz bir saat gibi işleyişini izlersiniz. Kimse{' '}
          <strong>&ldquo;bana haber gelmedi&rdquo; diyemez;</strong> çünkü{' '}
          <strong>sistem asla unutmaz ve asla yanlış kapıyı çalmaz.</strong>
        </p>

        <ContinueButton onClick={onContinue} />
      </div>
    </section>
  );
}
