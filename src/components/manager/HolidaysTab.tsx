'use client';

export default function HolidaysTab() {
  return (
    <div className="staff-tab-root">
      <div className="manager-placeholder-card" style={{ margin: '0 auto' }}>
        <div className="manager-placeholder-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h3 className="manager-placeholder-title">Tatil Günleri</h3>
        <div className="manager-placeholder-badge">
          <span className="manager-placeholder-dot" />
          MODÜL 13.3.b
        </div>
        <p className="manager-placeholder-sub">
          Resmi tatiller ve özel kapalı günler burada tanımlanacak
        </p>
      </div>
    </div>
  );
}
