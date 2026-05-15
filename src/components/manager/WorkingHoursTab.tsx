'use client';

export default function WorkingHoursTab() {
  return (
    <div className="staff-tab-root">
      <div className="manager-placeholder-card" style={{ margin: '0 auto' }}>
        <div className="manager-placeholder-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <h3 className="manager-placeholder-title">Çalışma Düzeni</h3>
        <div className="manager-placeholder-badge">
          <span className="manager-placeholder-dot" />
          MODÜL 13.3.b
        </div>
        <p className="manager-placeholder-sub">
          Günlük çalışma saatleri ve mesai düzeni burada yapılandırılacak
        </p>
      </div>
    </div>
  );
}
