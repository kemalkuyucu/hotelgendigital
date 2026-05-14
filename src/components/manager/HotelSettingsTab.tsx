export default function HotelSettingsTab() {
  return (
    <div className="manager-placeholder-card" role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings">
      {/* Büyük İkon */}
      <div className="manager-placeholder-icon manager-placeholder-icon--settings">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M8.46 8.46a5 5 0 0 0 0 7.07" />
        </svg>
      </div>

      <h2 className="manager-placeholder-title">Otel Sistem Ayarları</h2>

      {/* Rozet */}
      <div className="manager-placeholder-badge">
        <span className="manager-placeholder-dot" />
        Yapım Aşamasında
      </div>

      <p className="manager-placeholder-sub">Modül 14&apos;te açılacak</p>
    </div>
  );
}
