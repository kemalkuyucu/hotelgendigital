export default function MasterHubTab() {
  return (
    <div className="manager-placeholder-card" role="tabpanel" id="tabpanel-master-hub" aria-labelledby="tab-master-hub">
      {/* Büyük İkon */}
      <div className="manager-placeholder-icon manager-placeholder-icon--hub">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>

      <h2 className="manager-placeholder-title">Master Hub</h2>

      {/* Rozet */}
      <div className="manager-placeholder-badge">
        <span className="manager-placeholder-dot" />
        Yapım Aşamasında
      </div>

      <p className="manager-placeholder-sub">Modül 13.2&apos;de açılacak</p>
    </div>
  );
}
