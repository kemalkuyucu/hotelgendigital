'use client';

export default function SLATab() {
  return (
    <div className="staff-tab-root">
      <div className="manager-placeholder-card" style={{ margin: '0 auto' }}>
        <div className="manager-placeholder-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 className="manager-placeholder-title">SLA Süresi</h3>
        <div className="manager-placeholder-badge">
          <span className="manager-placeholder-dot" />
          MODÜL 13.3.b
        </div>
        <p className="manager-placeholder-sub">
          Yanıt süreleri ve eskalasyon kuralları burada yapılandırılacak
        </p>
      </div>
    </div>
  );
}
